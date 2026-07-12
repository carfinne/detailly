import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Appointment, AppointmentStatus } from '../../appointments/entities/appointment.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { resolveKalender } from './kalender-config';

/**
 * Doppelbuchungs-Schutz fuer Termine (Kalender 2.0). Zwei Zeitraeume ueberlappen
 * genau dann, wenn (bestehend.start < neu.ende) UND (bestehend.ende > neu.start) –
 * dasselbe Muster wie die Doppelvermietungs-Sperre (shop.service.createRental).
 *
 * Scope:
 *  - Nur wenn `assignedUserId` gesetzt ist, wird gegen andere Termine DESSELBEN
 *    Mitarbeiters geprueft (tenant-scoped). Termine ohne Mitarbeiter kollidieren
 *    nie ueber diese Dimension.
 *  - Zusaetzlich, wenn `locationId` gesetzt ist UND der Standort-Konflikt-Check
 *    aktiv ist, wird gegen andere Termine DESSELBEN Standorts geprueft.
 *  - Der Status `abgesagt` blockt nicht (weder bestehend noch der neue Termin).
 *
 * Alle Lookups sind tenant-scoped; die zurueckgegebene Konfliktliste ist auf
 * KONFLIKT_MAX begrenzt (nur eigene Betriebsdaten).
 */

export interface KonfliktScope {
  /** Eigene id (bei update/patchTime), um den Termin selbst NICHT zu treffen. */
  id?: string;
  start: Date;
  ende: Date;
  assignedUserId?: string | null;
  locationId?: string | null;
  /** Status des NEUEN/geaenderten Termins – bei `abgesagt` entfaellt die Pruefung. */
  status?: AppointmentStatus;
}

export interface KonfliktEintrag {
  id: string;
  titel: string;
  start: Date;
  ende: Date;
  assignedUserId: string | null;
}

export interface KonfliktSettings {
  konfliktverhalten: 'warnen' | 'blockieren';
  standortKonflikt: boolean;
}

export const KONFLIKT_MAX = 5;
export const KONFLIKT_CODE = 'APPOINTMENT_OVERLAP';

/** Liest die konfliktrelevanten Kalender-Settings des Betriebs (defensiv, Defaults). */
export async function ladeKonfliktSettings(
  m: EntityManager,
  tenantId: string,
): Promise<KonfliktSettings> {
  const t = await m.findOne(Tenant, { where: { id: tenantId }, select: ['id', 'settings'] });
  const s = (t?.settings ?? {}) as Record<string, unknown>;
  const k = resolveKalender(s.kalender);
  return { konfliktverhalten: k.konfliktverhalten, standortKonflikt: k.standortKonflikt };
}

/**
 * Findet ueberlappende Termine im Scope (max. KONFLIKT_MAX, aeltester zuerst).
 * Gibt eine leere Liste zurueck, wenn keine Pruefdimension aktiv ist oder der
 * neue Termin abgesagt wird.
 */
export async function findeTerminKonflikte(
  m: EntityManager,
  tenantId: string,
  scope: KonfliktScope,
  standortKonfliktAktiv: boolean,
): Promise<Appointment[]> {
  if (scope.status === AppointmentStatus.ABGESAGT) return [];
  const pruefeUser = !!scope.assignedUserId;
  const pruefeStandort = standortKonfliktAktiv && !!scope.locationId;
  if (!pruefeUser && !pruefeStandort) return [];

  const qb = m
    .createQueryBuilder(Appointment, 'a')
    .where('a.tenantId = :tenantId', { tenantId })
    .andWhere('a.status != :abgesagt', { abgesagt: AppointmentStatus.ABGESAGT })
    // Overlap: bestehend.start < neu.ende UND bestehend.ende > neu.start
    .andWhere('a.start < :neuEnde', { neuEnde: scope.ende })
    .andWhere('a.ende > :neuStart', { neuStart: scope.start });
  if (scope.id) qb.andWhere('a.id != :selfId', { selfId: scope.id });

  const oder: string[] = [];
  const params: Record<string, unknown> = {};
  if (pruefeUser) {
    oder.push('a.assignedUserId = :konfUser');
    params.konfUser = scope.assignedUserId;
  }
  if (pruefeStandort) {
    oder.push('a.locationId = :konfStandort');
    params.konfStandort = scope.locationId;
  }
  qb.andWhere(`(${oder.join(' OR ')})`, params);

  return qb.orderBy('a.start', 'ASC').take(KONFLIKT_MAX).getMany();
}

/** Baut den strukturierten 409-Payload aus den gefundenen Konflikten. */
export function toKonfliktPayload(konflikte: Appointment[]): {
  code: string;
  konflikte: KonfliktEintrag[];
} {
  return {
    code: KONFLIKT_CODE,
    konflikte: konflikte.map((k) => ({
      id: k.id,
      titel: k.titel,
      start: k.start,
      ende: k.ende,
      assignedUserId: k.assignedUserId ?? null,
    })),
  };
}

/**
 * Wirft `ConflictException` (409) mit strukturiertem Payload, wenn ueberlappende
 * Termine bestehen. Ausnahme: bei `konfliktverhalten='warnen'` und
 * `konfliktBestaetigt=true` wird die Warnung uebersteuert (gespeichert). Bei
 * `blockieren` wird das Flag ignoriert (immer 409).
 */
export async function assertKeinTerminKonflikt(
  m: EntityManager,
  tenantId: string,
  scope: KonfliktScope,
  settings: KonfliktSettings,
  konfliktBestaetigt: boolean | undefined,
): Promise<void> {
  const konflikte = await findeTerminKonflikte(m, tenantId, scope, settings.standortKonflikt);
  if (konflikte.length === 0) return;
  if (settings.konfliktverhalten === 'warnen' && konfliktBestaetigt === true) return;
  throw new ConflictException(toKonfliktPayload(konflikte));
}
