import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import {
  Subscription,
  OEFFENTLICH_SICHTBARE_ABO_STATUS,
} from '../subscriptions/entities/subscription.entity';
import { resolveMitgliedProfil } from '../common/mitglied-profil';
import {
  koordinateFuerRegion,
  plzRegionAusPostalCode,
} from './plz-region-geo';

/**
 * EIN Punkt auf der oeffentlichen Betriebskarte (STRIKTE Whitelist). Enthaelt
 * AUSSCHLIESSLICH zur Veroeffentlichung freigegebene, PII-arme Felder:
 *  - `firmenname`  (der Betrieb hat selbst zugestimmt, oeffentlich zu erscheinen)
 *  - `stadt`       grobe Ortsangabe (optional, vom Betrieb selbst gepflegt)
 *  - `plzRegion`   NUR die 2-stellige Leitregion – NIE die volle PLZ/Adresse
 *  - `x`/`y`       grobe Karten-Koordinate (Regions-Zentroid, viewBox 600x800)
 * NIEMALS: E-Mail, Telefon, Strasse, volle PLZ, interne id, Bank-/Steuerdaten.
 */
export interface BetriebskartePunkt {
  firmenname: string;
  stadt: string | null;
  plzRegion: string;
  x: number;
  y: number;
}

/**
 * Antwort des oeffentlichen Betriebskarten-Endpunkts.
 *  - `betriebe`       nur Betriebe mit (oeffentlich sichtbarem Abo: aktiv ODER
 *                     Pilot) UND (Opt-in) UND bekannter Leitregion-Koordinate;
 *                     PII-arm (siehe BetriebskartePunkt).
 *  - `gesamtZahlend`  anonyme Gesamtzahl aller oeffentlich sichtbaren Betriebe
 *                     (aktiv ODER Pilot; historischer Feldname) fuer den Zaehler
 *                     „X Betriebe bundesweit" – KEINE Zuordnung, nur eine Zahl.
 */
export interface BetriebskarteResponse {
  betriebe: BetriebskartePunkt[];
  gesamtZahlend: number;
}

@Injectable()
export class PublicBetriebskarteService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /**
   * Baut die oeffentliche Betriebskarte. Zwei Bedingungen – und NUR diese – lassen
   * einen Betrieb als benannten Punkt erscheinen:
   *   (1) oeffentlich sichtbares Abo (OEFFENTLICH_SICHTBARE_ABO_STATUS = active
   *       ODER pilot – bewusst NICHT trial) UND
   *   (2) ausdrueckliches Opt-in (settings.mitgliedProfil.zeigen === true).
   * Zusaetzlich braucht der Punkt eine ableitbare Leitregion-Koordinate (sonst
   * weggelassen – kein Punkt ohne bekannte Region, kein Crash).
   *
   * `gesamtZahlend` zaehlt ALLE oeffentlich sichtbaren Abos anonym (unabhaengig
   * vom Opt-in) – rein die Zahl, keine Zuordnung; DASSELBE Status-Kriterium wie die
   * Punkte, damit Zaehler und Karte konsistent sind (im Pilotbetrieb also inkl.
   * Pilot). BEWUSST OHNE Tenant-Scope: eine oeffentliche, tenant-neutrale Karte;
   * es fliessen aber NUR die vom Betrieb selbst freigegebenen, PII-armen Felder
   * nach aussen (strikte Whitelist).
   *
   * WICHTIG (TypeORM-null-Falle): `settings` ist verschluesseltes JSON (nicht
   * SQL-durchsuchbar) -> der `zeigen`-Filter wird in der Anwendung ausgewertet.
   * Inaktive Betriebe werden bereits per Query ausgeschlossen.
   */
  async getBetriebskarte(): Promise<BetriebskarteResponse> {
    // Anonyme Gesamtzahl aller oeffentlich sichtbaren Abos (active ODER pilot) –
    // nur eine Zahl, keine PII; deckungsgleich mit dem Punkt-Kriterium.
    const gesamtZahlend = await this.subscriptionRepo.count({
      where: { status: In([...OEFFENTLICH_SICHTBARE_ABO_STATUS]) },
    });

    const tenants = await this.tenantRepo.find({
      where: { status: Not(TenantStatus.INACTIVE) },
      // Nur die serverseitig benoetigten Felder. `settings` zum Entschluesseln/
      // Filtern, `postalCode` NUR zur Ableitung der 2-stelligen Leitregion – beide
      // verlassen das Backend NIE im Rohzustand (keine volle PLZ/Adresse).
      select: ['id', 'name', 'postalCode', 'settings'],
      order: { name: 'ASC' },
    });

    // Erst Opt-in filtern; nur fuer diese wird der (zahlende) Abo-Status gebraucht.
    const optin = tenants.filter((t) => {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      return resolveMitgliedProfil(s.mitgliedProfil).zeigen;
    });

    // Oeffentlich sichtbare (active ODER pilot) der Opt-in-Betriebe BATCH laden (ein
    // find mit id IN (...), kein N+1). Leere Liste -> gar keine Query.
    const aktivZahlend = new Set<string>();
    if (optin.length > 0) {
      const subs = await this.subscriptionRepo.find({
        where: {
          tenantId: In(optin.map((t) => t.id)),
          status: In([...OEFFENTLICH_SICHTBARE_ABO_STATUS]),
        },
        select: ['tenantId', 'status'],
      });
      for (const sub of subs) aktivZahlend.add(sub.tenantId);
    }

    const betriebe: BetriebskartePunkt[] = [];
    for (const t of optin) {
      if (!aktivZahlend.has(t.id)) continue; // kein sichtbares Abo -> kein Punkt
      const region = plzRegionAusPostalCode(t.postalCode);
      const pos = koordinateFuerRegion(region);
      if (!region || !pos) continue; // keine/unbekannte Region -> weglassen
      const s = (t.settings ?? {}) as Record<string, unknown>;
      const profil = resolveMitgliedProfil(s.mitgliedProfil);
      betriebe.push({
        firmenname: t.name,
        stadt: profil.stadt || null,
        plzRegion: region,
        x: pos.x,
        y: pos.y,
      });
    }

    // Deterministische Reihenfolge (Nordost -> Suedwest) -> cache-freundlich stabil.
    betriebe.sort((a, b) => a.y - b.y || a.x - b.x || a.firmenname.localeCompare(b.firmenname));

    return { betriebe, gesamtZahlend };
  }
}
