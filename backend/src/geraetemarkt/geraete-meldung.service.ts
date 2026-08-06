import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratMeldung } from './entities/geraete-inserat-meldung.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { SICHTBARE_STATUS, SYSTEM_MELDER_ID, DIENSTLEISTUNG_KATEGORIEN } from './geraetemarkt.constants';
import { findeChemieTreffer } from './geraete-chemie-heuristik';
import { MeldeInseratDto } from './dto/meldung.dto';

/**
 * Offengelegter Verkaeufer-Kontakt (Kontakt-Reveal). Wird AUSSCHLIESSLICH ueber
 * den dedizierten, auditierten Reveal-Endpunkt geliefert – NIE in Browse/Detail.
 * Quelle sind die Tenant-Stammdaten des Inserat-Besitzers (nicht auf dem Inserat
 * gedoppelt).
 */
export interface KontaktReveal {
  betriebsname: string;
  email: string | null;
  telefon: string | null;
  /** Impressum-Kurzform (Strasse, PLZ Ort, ggf. Land) – best effort. */
  anschrift: string | null;
}

/**
 * Tenant-seitige Melde-/Kontakt-Logik des Geraetemarkts (PR3):
 *  - Kontakt-Reveal (auditiert, nur fuer sichtbare Inserate),
 *  - Melden eines Inserats (Whitelist-Grund, Doppel-Melden = 409),
 *  - weiche Chemie-Heuristik beim Anlegen (markiert, blockt NICHT).
 *
 * melderTenantId/tenantId stammen IMMER aus dem JWT, nie aus dem Body/Client.
 */
@Injectable()
export class GeraeteMeldungService {
  private readonly logger = new Logger(GeraeteMeldungService.name);

  constructor(
    @InjectRepository(GeraeteInserat)
    private readonly inseratRepo: Repository<GeraeteInserat>,
    @InjectRepository(GeraeteInseratMeldung)
    private readonly meldungRepo: Repository<GeraeteInseratMeldung>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Kontakt-Reveal
  // ---------------------------------------------------------------------------

  /**
   * Legt den Verkaeufer-Kontakt offen – NUR fuer ein sichtbares Inserat (sonst
   * 404, kein Existenz-Orakel). Der Kontakt stammt aus den Tenant-Stammdaten des
   * Besitzers. JEDE Offenlegung wird auditiert (wer/welches Inserat/wann) fuer
   * die Scraping-Nachvollziehbarkeit.
   */
  async kontaktReveal(user: AuthUser, inseratId: string): Promise<KontaktReveal> {
    const inserat = await this.inseratRepo.findOne({ where: { id: inseratId } });
    if (!inserat || !this.istSichtbar(inserat)) {
      throw new NotFoundException('Inserat nicht gefunden');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: inserat.tenantId } });
    if (!tenant) throw new NotFoundException('Inserat nicht gefunden');

    // Offenlegung protokollieren – unter dem ANFRAGENDEN Betrieb (wer greift
    // wie oft auf Kontakte zu -> Scraping-Erkennung). verkaeuferTenantId im
    // Payload macht das betroffene Inserat/den Betrieb nachvollziehbar.
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'kontakt_reveal',
      entityType: 'GeraeteInserat',
      entityId: inserat.id,
      payload: { verkaeuferTenantId: inserat.tenantId },
    });

    return {
      betriebsname: tenant.name,
      email: this.leerZuNull(tenant.email),
      telefon: this.leerZuNull(tenant.phone),
      anschrift: this.baueAnschrift(tenant),
    };
  }

  // ---------------------------------------------------------------------------
  // Melden
  // ---------------------------------------------------------------------------

  /**
   * Meldet ein Inserat. Nur fuer ein sichtbares Inserat moeglich (sonst 404).
   * Doppel-Melden desselben Betriebs verletzt UNIQUE(inseratId, melderTenantId)
   * -> 409 (idempotent: es entsteht keine zweite Meldung).
   */
  async melden(
    user: AuthUser,
    inseratId: string,
    dto: MeldeInseratDto,
  ): Promise<GeraeteInseratMeldung> {
    const inserat = await this.inseratRepo.findOne({ where: { id: inseratId } });
    if (!inserat || !this.istSichtbar(inserat)) {
      throw new NotFoundException('Inserat nicht gefunden');
    }

    // Vorab-Pruefung (klarer 409, kein DB-Fehler im Normalfall).
    const vorhanden = await this.meldungRepo.findOne({
      where: { inseratId, melderTenantId: user.tenantId },
    });
    if (vorhanden) {
      throw new ConflictException('Dieses Inserat wurde von Ihrem Betrieb bereits gemeldet');
    }

    try {
      const meldung = await this.meldungRepo.save(
        this.meldungRepo.create({
          inseratId,
          melderTenantId: user.tenantId,
          melderUserId: user.id,
          grund: dto.grund,
          kommentar: dto.kommentar ?? null,
          status: 'offen',
        }),
      );
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'melden',
        entityType: 'GeraeteInserat',
        entityId: inseratId,
        payload: { grund: dto.grund },
      });
      return meldung;
    } catch (err) {
      // Race: parallele Doppel-Meldung trifft die UNIQUE-Constraint erst hier.
      if (this.istUniqueVerletzung(err)) {
        throw new ConflictException('Dieses Inserat wurde von Ihrem Betrieb bereits gemeldet');
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Chemie-Heuristik (weich, KEIN Block)
  // ---------------------------------------------------------------------------

  /**
   * Prueft ein FRISCH angelegtes Inserat auf Chemie-Stichworte und legt bei
   * Verdacht eine offene System-Meldung (grund=chemie_verboten) fuer die
   * Betreiber-Moderation an. Das Inserat wird NICHT abgelehnt/verborgen – nur
   * vorgemerkt. Best-effort: darf den Anlage-Vorgang NIE blockieren.
   */
  async pruefeChemieVerdacht(inserat: GeraeteInserat): Promise<void> {
    try {
      // DIENSTLEISTUNGS-Kategorien (auftragshilfe/freie_kapazitaet) ueberspringen:
      // Hier wird ARBEIT angeboten/gesucht, kein Warenverkauf. „Keramikversiegelung"
      // o. Ae. beschreibt dann den Arbeitsschritt, nicht den Verkauf von Chemie ->
      // sonst nur Rauschen. Warenkategorien (Geraete + restmaterial) bleiben geprueft;
      // so faellt z. B. „5 Liter Keramikversiegelung" unter Restmaterial weiter auf.
      if (DIENSTLEISTUNG_KATEGORIEN.includes(inserat.kategorie)) return;

      const treffer = findeChemieTreffer(inserat.titel, inserat.beschreibung);
      if (treffer.length === 0) return;

      // Idempotent: genau eine System-Meldung je Inserat (UNIQUE-Absicherung).
      const schon = await this.meldungRepo.findOne({
        where: { inseratId: inserat.id, melderTenantId: SYSTEM_MELDER_ID },
      });
      if (schon) return;

      await this.meldungRepo.save(
        this.meldungRepo.create({
          inseratId: inserat.id,
          melderTenantId: SYSTEM_MELDER_ID,
          melderUserId: SYSTEM_MELDER_ID,
          grund: 'chemie_verboten',
          kommentar: `Automatische Vorpruefung: moegliche Chemie/Verbrauchsstoffe (Stichworte: ${treffer.join(', ')}).`,
          status: 'offen',
        }),
      );
    } catch (err) {
      // Auch eine Race auf die UNIQUE-Constraint ist ok -> nur protokollieren.
      this.logger.warn(`Chemie-Heuristik fehlgeschlagen: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helfer
  // ---------------------------------------------------------------------------

  /** Sichtbarkeit wie im Browse-Filter: moderiert ok + Status + nicht abgelaufen. */
  private istSichtbar(i: GeraeteInserat): boolean {
    if (i.moderationStatus !== 'ok') return false;
    if (!SICHTBARE_STATUS.includes(i.status as (typeof SICHTBARE_STATUS)[number])) return false;
    if (i.ablaufAm && i.ablaufAm.getTime() <= Date.now()) return false;
    return true;
  }

  private leerZuNull(v: string | null | undefined): string | null {
    const t = (v ?? '').trim();
    return t.length ? t : null;
  }

  /** Impressum-Kurzform aus den Stammdaten (Strasse, PLZ Ort, ggf. Land). */
  private baueAnschrift(t: Tenant): string | null {
    const plzOrt = [t.postalCode, t.city].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
    const land = (t.country ?? '').trim();
    const teile = [
      (t.street ?? '').trim(),
      plzOrt,
      land && land.toUpperCase() !== 'DE' ? land : '',
    ].filter(Boolean);
    return teile.length ? teile.join(', ') : null;
  }

  private istUniqueVerletzung(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const e = err as QueryFailedError & { code?: string };
    // Postgres: 23505 (unique_violation); SQLite: Meldung enthaelt „UNIQUE".
    return e.code === '23505' || /unique/i.test(e.message ?? '');
  }
}
