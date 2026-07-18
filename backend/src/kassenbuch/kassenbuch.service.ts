import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { KassenbuchEintrag } from './entities/kassenbuch-eintrag.entity';
import { KassenbuchTyp } from './kassenbuch.constants';
import {
  berechneKassenbestandNach,
  gegenTyp,
  round2,
  wuerdeBestandNegativ,
} from './kassenbuch-rules';
import {
  berlinMonatsGrenzen,
  berlinTagesGrenzen,
  berlinYMDvonInstant,
  berlinYMDvonString,
} from './kassenbuch-zeit';
import {
  CreateKassenbuchEintragDto,
  UpdateKassenbuchEintragDto,
  StornoKassenbuchDto,
  ListKassenbuchQueryDto,
} from './dto/kassenbuch.dto';
import { KassenbuchExportService, KassenbuchExportRow } from './kassenbuch-export.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { clampPageQuery } from '../common/util/pagination';
import { withUniqueRetry, isUniqueViolation } from '../common/unique-retry';
import { MAX_EXPORT_EINTRAEGE } from './kassenbuch.constants';

@Injectable()
export class KassenbuchService {
  private readonly logger = new Logger(KassenbuchService.name);

  constructor(
    @InjectRepository(KassenbuchEintrag)
    private readonly repo: Repository<KassenbuchEintrag>,
    private readonly audit: AuditService,
    private readonly exportService: KassenbuchExportService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lesen
  // ---------------------------------------------------------------------------

  /** Paginierte, tenant-scoped Liste mit Zeitraum-/Typ-Filter (neueste zuerst). */
  async findAll(tenantId: string, query: ListKassenbuchQueryDto = {}) {
    const qb = this.repo
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId });
    if (query.typ) qb.andWhere('k.typ = :typ', { typ: query.typ });
    const zeitraum = this.zeitraum(query.von, query.bis);
    if (zeitraum) qb.andWhere('k.datum BETWEEN :von AND :bis', zeitraum);

    const { page, limit, skip, take } = clampPageQuery(query);
    const [data, total] = await qb
      .orderBy('k.laufendeNummer', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return { data, total, page, limit, kassenbestand: await this.aktuellerBestand(tenantId) };
  }

  /** Einzelner Eintrag (tenant-scoped). */
  async findOne(tenantId: string, id: string): Promise<KassenbuchEintrag> {
    const eintrag = await this.repo.findOne({ where: { id, tenantId } });
    if (!eintrag) throw new NotFoundException('Kassenbuch-Eintrag nicht gefunden');
    return eintrag;
  }

  /** Aktueller Kassenbestand = Saldo NACH dem letzten Eintrag (0 = leere Kasse). */
  async aktuellerBestand(tenantId: string): Promise<number> {
    const last = await this.loadLetzten(tenantId);
    return last ? Number(last.kassenbestandNach) : 0;
  }

  /**
   * Tages- und Monatssaldo (plus aktueller Gesamtbestand). `datum` optional
   * (Default heute). Einnahmen/Ausgaben je Zeitraum tenant-scoped summiert –
   * Storno-Gegenbuchungen zaehlen als normale Bewegungen mit und netzen korrekt.
   *
   * Tages-/Monatsgrenzen werden in Berliner Wanduhrzeit gebildet (nicht Server-
   * Lokalzeit): eine Buchung um 00:30 Berlin faellt auf UTC-Prod sonst in den
   * falschen Tag/Monat.
   */
  async saldo(tenantId: string, datumStr?: string) {
    const ymd = datumStr ? berlinYMDvonString(datumStr) : berlinYMDvonInstant(new Date());
    if (!ymd) {
      throw new BadRequestException('Ungueltiges Datum (Format YYYY-MM-DD erwartet).');
    }
    const tag = berlinTagesGrenzen(ymd);
    const monat = berlinMonatsGrenzen(ymd);
    return {
      kassenbestand: await this.aktuellerBestand(tenantId),
      tag: await this.summen(tenantId, tag.von, tag.bis),
      monat: await this.summen(tenantId, monat.von, monat.bis),
    };
  }

  /** Summiert Einnahmen/Ausgaben (tenant-scoped) im Zeitraum und bildet den Saldo. */
  private async summen(tenantId: string, von: Date, bis: Date) {
    const rows = await this.repo
      .createQueryBuilder('k')
      .select('k.typ', 'typ')
      .addSelect('COALESCE(SUM(k.betrag), 0)', 'summe')
      .where('k.tenantId = :tenantId', { tenantId })
      .andWhere('k.datum BETWEEN :von AND :bis', { von, bis })
      .groupBy('k.typ')
      .getRawMany<{ typ: string; summe: string }>();
    let einnahmen = 0;
    let ausgaben = 0;
    for (const r of rows) {
      if (r.typ === 'einnahme') einnahmen = round2(Number(r.summe));
      if (r.typ === 'ausgabe') ausgaben = round2(Number(r.summe));
    }
    return { einnahmen, ausgaben, saldo: round2(einnahmen - ausgaben) };
  }

  // ---------------------------------------------------------------------------
  // Schreiben (Entwurf)
  // ---------------------------------------------------------------------------

  /**
   * Legt einen Eintrag an (Entwurf). laufendeNummer (lueckenlos) und
   * kassenbestandNach werden SERVERSEITIG aus dem letzten Eintrag berechnet und
   * per withUniqueRetry gegen Parallel-Kollisionen (Unique-Index tenantId,
   * laufendeNummer) gesichert: bei Kollision werden Nummer UND Saldo aus dem dann
   * committeten Vorgaenger neu abgeleitet. Ausgabe > Bestand -> 400 (Barkasse
   * kann nicht negativ werden). Rueckdatieren vor den Vorgaenger -> 400.
   */
  async create(user: AuthUser, dto: CreateKassenbuchEintragDto): Promise<KassenbuchEintrag> {
    const typ = dto.typ as KassenbuchTyp;
    const betrag = round2(Number(dto.betrag));
    if (!(betrag > 0)) throw new BadRequestException('Der Betrag muss groesser als 0 sein.');
    const gewuenschtesDatum = dto.datum ? new Date(dto.datum) : null;
    if (gewuenschtesDatum && Number.isNaN(gewuenschtesDatum.getTime())) {
      throw new BadRequestException('Ungueltiges Buchungsdatum.');
    }

    const saved = await withUniqueRetry(async () => {
      const last = await this.loadLetzten(user.tenantId);
      const vorherBestand = last ? Number(last.kassenbestandNach) : 0;
      const datum = gewuenschtesDatum ?? new Date();
      // GoBD/Chronologie: nicht hinter den Vorgaenger zurueckdatieren.
      if (last && datum.getTime() < new Date(last.datum).getTime()) {
        throw new BadRequestException(
          'Das Buchungsdatum darf nicht vor dem letzten Eintrag liegen (keine Rueckdatierung).',
        );
      }
      if (wuerdeBestandNegativ(vorherBestand, typ, betrag)) {
        throw new BadRequestException(
          `Die Ausgabe (${betrag.toFixed(2)} €) uebersteigt den Kassenbestand (${vorherBestand.toFixed(2)} €). Eine Barkasse kann nicht negativ werden.`,
        );
      }
      const eintrag = this.repo.create({
        tenantId: user.tenantId,
        laufendeNummer: (last?.laufendeNummer ?? 0) + 1,
        datum,
        typ,
        betrag,
        mwstSatz: dto.mwstSatz ?? 0,
        zweck: dto.zweck,
        belegNummer: dto.belegNummer ?? null,
        kategorie: dto.kategorie ?? null,
        kassenbestandNach: berechneKassenbestandNach(vorherBestand, typ, betrag),
        erfasstVonUserId: user.id,
        festgeschrieben: false,
        stornoVonId: null,
      });
      return this.repo.save(eintrag);
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'KassenbuchEintrag',
      entityId: saved.id,
      payload: { laufendeNummer: saved.laufendeNummer, typ, betrag },
    });
    return saved;
  }

  /**
   * Aendert einen Entwurf. Nur der ZULETZT erfasste, noch nicht festgeschriebene
   * Eintrag ist aenderbar – so bleiben laufendeNummer-Kette UND Saldo-Verkettung
   * trivial korrekt (aeltere Korrekturen laufen ueber Storno). Der Saldo wird aus
   * dem Vorgaenger neu berechnet; Ausgabe > Bestand -> 400.
   */
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateKassenbuchEintragDto,
  ): Promise<KassenbuchEintrag> {
    // Serialisiert wie create/storno: Eintrag frisch laden, Aenderbarkeit
    // (festgeschrieben + ist-letzter) UND Saldo-Neuberechnung erfolgen unmittelbar
    // vor dem Speichern (schmales TOCTOU-Fenster gegen paralleles create/festschreiben).
    const saved = await withUniqueRetry(async () => {
      const eintrag = await this.findOne(user.tenantId, id);
      await this.assertBearbeitbar(user.tenantId, eintrag);

      const typ = (dto.typ as KassenbuchTyp) ?? (eintrag.typ as KassenbuchTyp);
      const betrag = dto.betrag != null ? round2(Number(dto.betrag)) : Number(eintrag.betrag);
      if (!(betrag > 0)) throw new BadRequestException('Der Betrag muss groesser als 0 sein.');

      const vorherBestand = await this.vorgaengerBestand(user.tenantId, eintrag.laufendeNummer);
      if (wuerdeBestandNegativ(vorherBestand, typ, betrag)) {
        throw new BadRequestException(
          `Die Ausgabe (${betrag.toFixed(2)} €) uebersteigt den Kassenbestand (${vorherBestand.toFixed(2)} €). Eine Barkasse kann nicht negativ werden.`,
        );
      }

      eintrag.typ = typ;
      eintrag.betrag = betrag;
      if (dto.zweck !== undefined) eintrag.zweck = dto.zweck;
      if (dto.mwstSatz !== undefined) eintrag.mwstSatz = dto.mwstSatz;
      if (dto.belegNummer !== undefined) eintrag.belegNummer = dto.belegNummer;
      if (dto.kategorie !== undefined) eintrag.kategorie = dto.kategorie;
      eintrag.kassenbestandNach = berechneKassenbestandNach(vorherBestand, typ, betrag);
      return this.repo.save(eintrag);
    });

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'KassenbuchEintrag',
      entityId: saved.id,
      payload: { laufendeNummer: saved.laufendeNummer, typ: saved.typ, betrag: Number(saved.betrag) },
    });
    return saved;
  }

  /**
   * Loescht einen Entwurf. Nur der ZULETZT erfasste, nicht festgeschriebene
   * Eintrag ist loeschbar (haelt laufendeNummer lueckenlos: die frei werdende
   * Nummer wird vom naechsten Eintrag wiederverwendet, ohne Luecke/Kollision).
   * Die Aenderbarkeit wird unmittelbar vor dem Loeschen re-validiert.
   */
  async remove(user: AuthUser, id: string): Promise<{ deleted: true }> {
    const eintrag = await withUniqueRetry(async () => {
      const e = await this.findOne(user.tenantId, id);
      await this.assertBearbeitbar(user.tenantId, e);
      await this.repo.remove(e);
      return e;
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'KassenbuchEintrag',
      entityId: id,
      payload: { laufendeNummer: eintrag.laufendeNummer },
    });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Festschreiben (Unveraenderbarkeit)
  // ---------------------------------------------------------------------------

  /**
   * Schreibt den zusammenhaengenden PRAEFIX bis inkl. diesem Eintrag fest, d. h.
   * alle noch offenen Entwuerfe mit laufendeNummer <= Ziel (tenant-scoped).
   *
   * Bewusst als Praefix (nicht als Einzel-Eintrag): wuerde man einen NICHT-letzten
   * Eintrag isoliert festschreiben, waere ein aelterer Entwurf danach weder
   * aenderbar (nicht der letzte) noch loeschbar noch direkt festschreibbar –
   * ein unintuitiver Sonderfall. Der Praefix-Abschluss ("bis hier festschreiben")
   * entspricht dem Kassenbuch-Alltag und laesst nie eine ueberholte Luecke offen.
   * Idempotent/monoton: bereits festgeschriebene Eintraege bleiben unveraendert.
   */
  async festschreiben(user: AuthUser, id: string): Promise<KassenbuchEintrag> {
    const eintrag = await this.findOne(user.tenantId, id);
    if (!eintrag.festgeschrieben) {
      const res = await this.repo.update(
        {
          tenantId: user.tenantId,
          festgeschrieben: false,
          laufendeNummer: LessThanOrEqual(eintrag.laufendeNummer),
        },
        { festgeschrieben: true, festgeschriebenAm: new Date() },
      );
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'festschreiben',
        entityType: 'KassenbuchEintrag',
        entityId: eintrag.id,
        payload: { bisLaufendeNummer: eintrag.laufendeNummer, anzahl: res.affected ?? 0 },
      });
    }
    return this.findOne(user.tenantId, id);
  }

  /**
   * Tagesabschluss: schreibt ALLE noch offenen Entwuerfe des Betriebs fest.
   * Idempotent (keine offenen -> 0). Ein Update mit fixem WHERE, damit kein
   * bereits festgeschriebener Eintrag beruehrt wird.
   */
  async festschreibenAlle(user: AuthUser): Promise<{ festgeschrieben: number }> {
    const res = await this.repo.update(
      { tenantId: user.tenantId, festgeschrieben: false },
      { festgeschrieben: true, festgeschriebenAm: new Date() },
    );
    const anzahl = res.affected ?? 0;
    if (anzahl > 0) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        action: 'festschreiben_alle',
        entityType: 'KassenbuchEintrag',
        payload: { anzahl },
      });
    }
    return { festgeschrieben: anzahl };
  }

  // ---------------------------------------------------------------------------
  // Storno (Gegenbuchung)
  // ---------------------------------------------------------------------------

  /**
   * Korrigiert einen FESTGESCHRIEBENEN Eintrag per Gegenbuchung: ein NEUER
   * Eintrag mit umgekehrter Buchungsart und gleichem Betrag, Verweis
   * `stornoVonId` auf das Original. Das Original bleibt UNVERAENDERT (GoBD). Die
   * Gegenbuchung ist selbst sofort festgeschrieben (eine Korrektur ist endgueltig).
   * Doppel-Storno wird verhindert (409). Ausgabe-Gegenbuchung > Bestand -> 400.
   */
  async storno(
    user: AuthUser,
    id: string,
    dto: StornoKassenbuchDto = {},
  ): Promise<KassenbuchEintrag> {
    const original = await this.findOne(user.tenantId, id);
    if (!original.festgeschrieben) {
      throw new BadRequestException(
        'Nur festgeschriebene Eintraege werden per Storno korrigiert – Entwuerfe bitte direkt bearbeiten oder loeschen.',
      );
    }
    if (original.stornoVonId) {
      throw new BadRequestException('Eine Storno-Buchung kann nicht erneut storniert werden.');
    }

    const typ = gegenTyp(original.typ as KassenbuchTyp);
    const betrag = Number(original.betrag);
    const zweck =
      dto.zweck?.trim() || `Storno zu Nr. ${original.laufendeNummer}: ${original.zweck}`;

    let saved: KassenbuchEintrag;
    try {
      saved = await withUniqueRetry(async () => {
        // Doppelstorno-Guard INNERHALB des Retrys (bei jedem Versuch neu pruefen).
        // Zusammen mit dem partiellen Unique-Index (tenantId, stornoVonId) ist der
        // Race geschlossen: gewinnt eine parallele Storno-Anfrage das Rennen, sieht
        // der naechste Versuch deren committete Gegenbuchung und bricht mit 409 ab
        // (bzw. der Insert kollidiert am Unique-Index -> unten in 409 uebersetzt).
        const bereitsStorniert = await this.repo.findOne({
          where: { tenantId: user.tenantId, stornoVonId: id },
        });
        if (bereitsStorniert) {
          throw new ConflictException('Dieser Eintrag wurde bereits storniert.');
        }
        const last = await this.loadLetzten(user.tenantId);
        const vorherBestand = last ? Number(last.kassenbestandNach) : 0;
        if (wuerdeBestandNegativ(vorherBestand, typ, betrag)) {
          throw new BadRequestException(
            `Die Storno-Gegenbuchung (${betrag.toFixed(2)} €) uebersteigt den Kassenbestand (${vorherBestand.toFixed(2)} €).`,
          );
        }
        const gegen = this.repo.create({
          tenantId: user.tenantId,
          laufendeNummer: (last?.laufendeNummer ?? 0) + 1,
          datum: new Date(),
          typ,
          betrag,
          mwstSatz: Number(original.mwstSatz),
          zweck: zweck.slice(0, 200),
          belegNummer: original.belegNummer,
          kategorie: original.kategorie,
          kassenbestandNach: berechneKassenbestandNach(vorherBestand, typ, betrag),
          erfasstVonUserId: user.id,
          // Eine Korrektur ist endgueltig -> Gegenbuchung sofort festschreiben.
          festgeschrieben: true,
          festgeschriebenAm: new Date(),
          stornoVonId: original.id,
        });
        return this.repo.save(gegen);
      });
    } catch (e) {
      // Ueberlebt eine Unique-Verletzung die Retries, war es der partielle
      // (tenantId, stornoVonId)-Index -> es existiert bereits eine Gegenbuchung.
      if (isUniqueViolation(e)) {
        throw new ConflictException('Dieser Eintrag wurde bereits storniert.');
      }
      throw e;
    }

    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'storno',
      entityType: 'KassenbuchEintrag',
      entityId: saved.id,
      payload: { stornoVonId: id, laufendeNummer: saved.laufendeNummer, betrag },
    });
    return saved;
  }

  // ---------------------------------------------------------------------------
  // Export (GoBD-CSV)
  // ---------------------------------------------------------------------------

  /**
   * Baut den GoBD-tauglichen CSV-Export (Zeitraum optional). Chronologisch
   * (laufendeNummer ASC). Loest fuer Storno-Zeilen die Nummer des Originals auf.
   */
  async buildExport(
    tenantId: string,
    opts: { von?: string; bis?: string } = {},
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const qb = this.repo
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId });
    const zeitraum = this.zeitraum(opts.von, opts.bis);
    if (zeitraum) qb.andWhere('k.datum BETWEEN :von AND :bis', zeitraum);
    const eintraege = await qb
      .orderBy('k.laufendeNummer', 'ASC')
      .take(MAX_EXPORT_EINTRAEGE)
      .getMany();

    // Storno-Referenzen (id -> laufendeNummer) fuer die Lesbarkeit aufloesen.
    const nummerById = new Map(eintraege.map((e) => [e.id, e.laufendeNummer]));
    // Bei Zeitraum-Filter kann das stornierte ORIGINAL ausserhalb der Auswahl
    // liegen (Gegenbuchung drin, Original davor) -> referenzierte Originale
    // separat tenant-scoped nachladen, damit "Storno zu Nr." nie leer bleibt.
    const fehlendeOriginalIds = [
      ...new Set(
        eintraege
          .filter((e) => e.stornoVonId && !nummerById.has(e.stornoVonId))
          .map((e) => e.stornoVonId as string),
      ),
    ];
    if (fehlendeOriginalIds.length > 0) {
      const originale = await this.repo.find({
        where: { tenantId, id: In(fehlendeOriginalIds) },
        select: ['id', 'laufendeNummer'],
      });
      for (const o of originale) nummerById.set(o.id, o.laufendeNummer);
    }
    const rows: KassenbuchExportRow[] = eintraege.map((e) => ({
      laufendeNummer: e.laufendeNummer,
      datum: e.datum,
      typ: e.typ,
      zweck: e.zweck,
      belegNummer: e.belegNummer,
      kategorie: e.kategorie,
      betrag: e.betrag,
      mwstSatz: e.mwstSatz,
      kassenbestandNach: e.kassenbestandNach,
      festgeschrieben: e.festgeschrieben,
      stornoVonNummer: e.stornoVonId ? nummerById.get(e.stornoVonId) ?? null : null,
    }));

    const buffer = this.exportService.buildCsv(rows);
    const spanne = opts.von && opts.bis ? `_${opts.von}_${opts.bis}` : '';
    return {
      buffer,
      filename: `Kassenbuch${spanne}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  // ---------------------------------------------------------------------------
  // Interne Helfer
  // ---------------------------------------------------------------------------

  /** Letzter Eintrag (hoechste laufendeNummer) des Tenants, sonst null. */
  private loadLetzten(tenantId: string): Promise<KassenbuchEintrag | null> {
    return this.repo.findOne({
      where: { tenantId },
      order: { laufendeNummer: 'DESC' },
    });
  }

  /** Kassenbestand des unmittelbaren Vorgaengers (gap-sicher), sonst 0. */
  private async vorgaengerBestand(tenantId: string, laufendeNummer: number): Promise<number> {
    const vorgaenger = await this.repo
      .createQueryBuilder('k')
      .where('k.tenantId = :tenantId', { tenantId })
      .andWhere('k.laufendeNummer < :nr', { nr: laufendeNummer })
      .orderBy('k.laufendeNummer', 'DESC')
      .getOne();
    return vorgaenger ? Number(vorgaenger.kassenbestandNach) : 0;
  }

  /**
   * Aenderbarkeit (Update/Delete): NUR der letzte, noch nicht festgeschriebene
   * Eintrag. Festgeschrieben -> 409 (GoBD, Korrektur per Storno); nicht der
   * letzte -> 409 (aeltere Korrektur per Storno, sonst braeche die Saldo-Kette).
   */
  private async assertBearbeitbar(tenantId: string, eintrag: KassenbuchEintrag): Promise<void> {
    if (eintrag.festgeschrieben) {
      throw new ConflictException(
        'Festgeschriebener Eintrag ist unveraenderlich – bitte per Storno-Gegenbuchung korrigieren.',
      );
    }
    const last = await this.loadLetzten(tenantId);
    if (!last || last.id !== eintrag.id) {
      throw new ConflictException(
        'Nur der zuletzt erfasste Eintrag ist im Entwurf aenderbar/loeschbar – aeltere Korrektur bitte per Storno.',
      );
    }
  }

  /**
   * von/bis (YYYY-MM-DD) -> Between-Parameter oder null (kein Zeitraum). Die
   * Tagesgrenzen werden in Berliner Wanduhrzeit gebildet (nicht Server-Lokalzeit),
   * damit der Filter auf UTC-Prod dieselben Buchungen umfasst wie in der Anzeige.
   */
  private zeitraum(von?: string, bis?: string): { von: Date; bis: Date } | null {
    if (!von && !bis) return null;
    let vonD = new Date('1970-01-01T00:00:00Z');
    let bisD = new Date('2999-12-31T23:59:59.999Z');
    if (von) {
      const ymd = berlinYMDvonString(von);
      if (!ymd) throw new BadRequestException('Ungueltiges Datum (Format YYYY-MM-DD erwartet).');
      vonD = berlinTagesGrenzen(ymd).von;
    }
    if (bis) {
      const ymd = berlinYMDvonString(bis);
      if (!ymd) throw new BadRequestException('Ungueltiges Datum (Format YYYY-MM-DD erwartet).');
      bisD = berlinTagesGrenzen(ymd).bis;
    }
    if (bisD < vonD) {
      throw new BadRequestException('Das Bis-Datum darf nicht vor dem Von-Datum liegen.');
    }
    return { von: vonD, bis: bisD };
  }
}
