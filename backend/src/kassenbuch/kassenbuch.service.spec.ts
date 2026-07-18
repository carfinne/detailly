import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { KassenbuchService } from './kassenbuch.service';
import { KassenbuchExportService } from './kassenbuch-export.service';

/**
 * GoBD-Kernverhalten des Kassenbuchs. Die Jest-Suite bootet bewusst KEINE echte
 * DB (better-sqlite3/pg werden nie geladen) – daher ein schlankes In-Memory-
 * Fake-Repository, das genau die vom Service genutzten Repository-Methoden
 * nachbildet, inklusive der Unique-Constraints (tenantId, laufendeNummer) UND
 * partiell (tenantId, stornoVonId) fuer die Doppelstorno-Sperre.
 */

type Row = Record<string, any>;

/** Where-Match inkl. TypeORM-FindOperatoren In()/LessThanOrEqual() (fuer die Fakes). */
function whereMatch(row: Row, where: Row): boolean {
  return Object.keys(where).every((k) => {
    const cond = where[k];
    if (cond instanceof FindOperator) {
      if (cond.type === 'in') return (cond.value as any[]).includes(row[k]);
      if (cond.type === 'lessThanOrEqual') return row[k] <= cond.value;
      if (cond.type === 'lessThan') return row[k] < cond.value;
      throw new Error(`FakeRepo: FindOperator ${cond.type} nicht unterstuetzt`);
    }
    return row[k] === cond;
  });
}

class FakeQB {
  private params: Row = {};
  private orderField = '';
  private orderDir: 'ASC' | 'DESC' = 'ASC';
  private skipN = 0;
  private takeN = Number.MAX_SAFE_INTEGER;
  private isSummen = false;

  constructor(private readonly rows: Row[]) {}

  where(_sql: string, params?: Row) {
    Object.assign(this.params, params ?? {});
    return this;
  }
  andWhere(_sql: string, params?: Row) {
    Object.assign(this.params, params ?? {});
    return this;
  }
  select(sql: string, _alias?: string) {
    if (/SUM\(/i.test(sql)) this.isSummen = true;
    return this;
  }
  addSelect(sql: string, _alias?: string) {
    if (/SUM\(/i.test(sql)) this.isSummen = true;
    return this;
  }
  groupBy() {
    return this;
  }
  orderBy(field: string, dir: 'ASC' | 'DESC') {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }
  skip(n: number) {
    this.skipN = n;
    return this;
  }
  take(n: number) {
    this.takeN = n;
    return this;
  }

  private filtered(): Row[] {
    let out = this.rows.filter((r) => {
      if (this.params.tenantId !== undefined && r.tenantId !== this.params.tenantId) return false;
      if (this.params.typ !== undefined && r.typ !== this.params.typ) return false;
      if (this.params.nr !== undefined && !(r.laufendeNummer < this.params.nr)) return false;
      if (this.params.von !== undefined && this.params.bis !== undefined) {
        const d = new Date(r.datum).getTime();
        if (d < new Date(this.params.von).getTime() || d > new Date(this.params.bis).getTime()) {
          return false;
        }
      }
      return true;
    });
    if (this.orderField.includes('laufendeNummer')) {
      out = [...out].sort((a, b) =>
        this.orderDir === 'DESC'
          ? b.laufendeNummer - a.laufendeNummer
          : a.laufendeNummer - b.laufendeNummer,
      );
    }
    return out;
  }

  async getOne(): Promise<Row | null> {
    return this.filtered()[0] ?? null;
  }
  async getMany(): Promise<Row[]> {
    return this.filtered().slice(this.skipN, this.skipN + this.takeN);
  }
  async getManyAndCount(): Promise<[Row[], number]> {
    const all = this.filtered();
    return [all.slice(this.skipN, this.skipN + this.takeN), all.length];
  }
  async getRawMany(): Promise<Row[]> {
    // summen(): nach typ gruppieren und betrag summieren.
    const byTyp = new Map<string, number>();
    for (const r of this.filtered()) {
      byTyp.set(r.typ, (byTyp.get(r.typ) ?? 0) + Number(r.betrag));
    }
    return [...byTyp.entries()].map(([typ, summe]) => ({ typ, summe: String(summe) }));
  }
}

class FakeRepo {
  rows: Row[] = [];
  private seq = 0;

  create(obj: Row): Row {
    return { ...obj };
  }

  async save(entity: Row): Promise<Row> {
    // Unique-Constraint (tenantId, laufendeNummer) treibernah nachbilden.
    const nummerKollision = this.rows.find(
      (r) =>
        r.tenantId === entity.tenantId &&
        r.laufendeNummer === entity.laufendeNummer &&
        r.id !== entity.id,
    );
    if (nummerKollision) {
      throw new Error(
        'SQLITE_CONSTRAINT: UNIQUE constraint failed: kassenbuch_eintraege.tenantId, kassenbuch_eintraege.laufendeNummer',
      );
    }
    // Partieller Unique-Index (tenantId, stornoVonId) WHERE stornoVonId IS NOT NULL.
    if (entity.stornoVonId != null) {
      const stornoKollision = this.rows.find(
        (r) =>
          r.tenantId === entity.tenantId &&
          r.stornoVonId === entity.stornoVonId &&
          r.id !== entity.id,
      );
      if (stornoKollision) {
        throw new Error(
          'SQLITE_CONSTRAINT: UNIQUE constraint failed: kassenbuch_eintraege.tenantId, kassenbuch_eintraege.stornoVonId',
        );
      }
    }
    if (!entity.id) entity.id = `id-${++this.seq}`;
    const idx = this.rows.findIndex((r) => r.id === entity.id);
    if (idx >= 0) this.rows[idx] = entity;
    else this.rows.push(entity);
    return entity;
  }

  async remove(entity: Row): Promise<Row> {
    this.rows = this.rows.filter((r) => r.id !== entity.id);
    return entity;
  }

  async update(where: Row, patch: Row): Promise<{ affected: number }> {
    let affected = 0;
    for (const r of this.rows) {
      if (whereMatch(r, where)) {
        Object.assign(r, patch);
        affected++;
      }
    }
    return { affected };
  }

  async find(opts: { where?: Row }): Promise<Row[]> {
    const w = opts.where ?? {};
    return this.rows.filter((r) => whereMatch(r, w));
  }

  async findOne(opts: { where?: Row; order?: Row }): Promise<Row | null> {
    const w = opts.where ?? {};
    let candidates = this.rows.filter((r) => {
      if (w.id !== undefined && r.id !== w.id) return false;
      if (w.tenantId !== undefined && r.tenantId !== w.tenantId) return false;
      if (w.stornoVonId !== undefined && r.stornoVonId !== w.stornoVonId) return false;
      if (w.festgeschrieben !== undefined && r.festgeschrieben !== w.festgeschrieben) return false;
      return true;
    });
    if (opts.order?.laufendeNummer === 'DESC') {
      candidates = [...candidates].sort((a, b) => b.laufendeNummer - a.laufendeNummer);
    }
    return candidates[0] ?? null;
  }

  createQueryBuilder(_alias?: string): FakeQB {
    return new FakeQB(this.rows);
  }
}

function makeService() {
  const repo = new FakeRepo();
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const svc = new KassenbuchService(repo as any, audit, new KassenbuchExportService());
  return { svc, repo, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };
const USER2: any = { id: 'u2', tenantId: 't2' };

describe('KassenbuchService', () => {
  // -------------------------------------------------------------------------
  // Verkettung: lueckenlose Nummer + fortgeschriebener Saldo
  // -------------------------------------------------------------------------
  describe('create · Verkettung', () => {
    it('vergibt lueckenlose laufende Nummern und schreibt den Kassenbestand fort', async () => {
      const { svc } = makeService();
      const a = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Barverkauf' });
      const b = await svc.create(USER, { typ: 'ausgabe', betrag: 30, zweck: 'Material' });
      const c = await svc.create(USER, { typ: 'einnahme', betrag: 50, zweck: 'Trinkgeld' });
      expect([a.laufendeNummer, b.laufendeNummer, c.laufendeNummer]).toEqual([1, 2, 3]);
      expect([Number(a.kassenbestandNach), Number(b.kassenbestandNach), Number(c.kassenbestandNach)]).toEqual([
        100, 70, 120,
      ]);
    });

    it('lehnt eine Ausgabe ueber dem Kassenbestand ab (400, Kasse nie negativ)', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 20, zweck: 'Start' });
      await expect(
        svc.create(USER, { typ: 'ausgabe', betrag: 30, zweck: 'zu viel' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('erlaubt eine Ausgabe exakt bis auf 0', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 50, zweck: 'Start' });
      const e = await svc.create(USER, { typ: 'ausgabe', betrag: 50, zweck: 'alles raus' });
      expect(Number(e.kassenbestandNach)).toBe(0);
    });

    it('ist kollisionsfest: bei Unique-Kollision zieht die Nummer nach dem Konkurrenz-Commit neu', async () => {
      const { svc, repo } = makeService();
      // Bestand: letzter Eintrag Nr. 2 (Saldo 50).
      repo.rows.push({
        id: 'e2',
        tenantId: 't1',
        laufendeNummer: 2,
        datum: new Date('2026-07-18T08:00:00'),
        typ: 'einnahme',
        betrag: 50,
        kassenbestandNach: 50,
        festgeschrieben: true,
        stornoVonId: null,
      });
      // Beim ersten save eine konkurrierende Nr. 3 unterschieben -> Unique-Kollision,
      // withUniqueRetry muss neu zaehlen (Nr. 4) und danach erfolgreich speichern.
      let calls = 0;
      const origSave = repo.save.bind(repo);
      jest.spyOn(repo, 'save').mockImplementation(async (e: any) => {
        calls++;
        if (calls === 1) {
          repo.rows.push({
            id: 'concurrent',
            tenantId: 't1',
            laufendeNummer: 3,
            datum: new Date('2026-07-18T09:00:00'),
            typ: 'einnahme',
            betrag: 100,
            kassenbestandNach: 150,
            festgeschrieben: true,
            stornoVonId: null,
          });
        }
        return origSave(e);
      });

      const neu = await svc.create(USER, { typ: 'einnahme', betrag: 10, zweck: 'nach Race' });
      expect(calls).toBe(2); // ein Retry
      expect(neu.laufendeNummer).toBe(4); // hinter dem Konkurrenz-Commit (3)
      expect(Number(neu.kassenbestandNach)).toBe(160); // 150 + 10, aus dem echten Vorgaenger
    });

    it('verbietet Rueckdatieren hinter den letzten Eintrag (400)', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'heute', datum: '2026-07-18T10:00:00' });
      await expect(
        svc.create(USER, { typ: 'einnahme', betrag: 10, zweck: 'gestern', datum: '2026-07-01T10:00:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Unveraenderbarkeit: festgeschrieben -> 409
  // -------------------------------------------------------------------------
  describe('Unveraenderbarkeit (festgeschrieben)', () => {
    it('festgeschriebener Eintrag: update -> 409 und keine Aenderung', async () => {
      const { svc } = makeService();
      const e = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Kasse' });
      await svc.festschreiben(USER, e.id);
      await expect(svc.update(USER, e.id, { betrag: 999 })).rejects.toBeInstanceOf(ConflictException);
      const nachher = await svc.findOne('t1', e.id);
      expect(Number(nachher.betrag)).toBe(100);
    });

    it('festgeschriebener Eintrag: delete -> 409', async () => {
      const { svc } = makeService();
      const e = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Kasse' });
      await svc.festschreiben(USER, e.id);
      await expect(svc.remove(USER, e.id)).rejects.toBeInstanceOf(ConflictException);
    });

    it('nur der LETZTE Entwurf ist aenderbar (aelterer -> 409)', async () => {
      const { svc } = makeService();
      const a = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'A' });
      await svc.create(USER, { typ: 'einnahme', betrag: 50, zweck: 'B' });
      await expect(svc.update(USER, a.id, { betrag: 5 })).rejects.toBeInstanceOf(ConflictException);
    });

    it('festschreiben ist idempotent/monoton (zweiter Aufruf aendert nichts)', async () => {
      const { svc } = makeService();
      const e = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Kasse' });
      const f1 = await svc.festschreiben(USER, e.id);
      const stamp = f1.festgeschriebenAm;
      const f2 = await svc.festschreiben(USER, e.id);
      expect(f2.festgeschrieben).toBe(true);
      expect(f2.festgeschriebenAm).toEqual(stamp);
    });

    it('festschreiben schreibt den PRAEFIX bis inkl. Ziel fest (kein verwaister Entwurf)', async () => {
      const { svc } = makeService();
      const a = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'A' });
      const b = await svc.create(USER, { typ: 'einnahme', betrag: 50, zweck: 'B' });
      const c = await svc.create(USER, { typ: 'einnahme', betrag: 20, zweck: 'C' });
      // Festschreiben bis B -> A und B fest, C bleibt Entwurf (der letzte, editierbar).
      const ziel = await svc.festschreiben(USER, b.id);
      expect(ziel.festgeschrieben).toBe(true);
      expect((await svc.findOne('t1', a.id)).festgeschrieben).toBe(true);
      expect((await svc.findOne('t1', b.id)).festgeschrieben).toBe(true);
      expect((await svc.findOne('t1', c.id)).festgeschrieben).toBe(false);
      // C ist weiterhin aenderbar (letzter, nicht festgeschrieben).
      const cGeaendert = await svc.update(USER, c.id, { betrag: 25 });
      expect(Number(cGeaendert.betrag)).toBe(25);
    });

    it('update des letzten Entwurfs schreibt den Saldo korrekt neu fort', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'A' });
      const b = await svc.create(USER, { typ: 'ausgabe', betrag: 30, zweck: 'B' });
      const geaendert = await svc.update(USER, b.id, { betrag: 40 });
      expect(Number(geaendert.kassenbestandNach)).toBe(60); // 100 - 40
    });
  });

  // -------------------------------------------------------------------------
  // Storno-Gegenbuchung
  // -------------------------------------------------------------------------
  describe('storno · Gegenbuchung', () => {
    it('erzeugt eine Gegenbuchung mit Referenz und laesst das Original unveraendert', async () => {
      const { svc } = makeService();
      const original = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Falschbuchung' });
      await svc.festschreiben(USER, original.id);
      const storno = await svc.storno(USER, original.id, {});

      // Gegenbuchung: umgekehrte Richtung, gleicher Betrag, Referenz, sofort festgeschrieben.
      expect(storno.typ).toBe('ausgabe');
      expect(Number(storno.betrag)).toBe(100);
      expect(storno.stornoVonId).toBe(original.id);
      expect(storno.festgeschrieben).toBe(true);
      expect(storno.laufendeNummer).toBe(2);
      expect(Number(storno.kassenbestandNach)).toBe(0); // 100 - 100

      // Original bleibt exakt wie zuvor (GoBD-Unveraenderbarkeit).
      const orig = await svc.findOne('t1', original.id);
      expect(orig.typ).toBe('einnahme');
      expect(Number(orig.betrag)).toBe(100);
      expect(orig.stornoVonId).toBeNull();
    });

    it('verhindert doppeltes Stornieren (409)', async () => {
      const { svc } = makeService();
      const original = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'x' });
      await svc.festschreiben(USER, original.id);
      await svc.storno(USER, original.id, {});
      await expect(svc.storno(USER, original.id, {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('Doppel-Storno-Race: paralleler Storno commited zuerst -> genau EINE Gegenbuchung, zweiter 409', async () => {
      const { svc, repo } = makeService();
      const original = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'race' });
      await svc.festschreiben(USER, original.id);

      // Waehrend UNSER Storno speichert, committet eine konkurrierende Storno-
      // Gegenbuchung fuers selbe Original -> der partielle Unique-Index (tenantId,
      // stornoVonId) weist unseren Insert ab; withUniqueRetry prueft neu und findet
      // die fremde Gegenbuchung -> ConflictException.
      let calls = 0;
      const origSave = repo.save.bind(repo);
      jest.spyOn(repo, 'save').mockImplementation(async (e: any) => {
        calls++;
        if (calls === 1 && e.stornoVonId === original.id) {
          repo.rows.push({
            id: 'rival-storno',
            tenantId: 't1',
            laufendeNummer: 99,
            datum: new Date(),
            typ: 'ausgabe',
            betrag: 100,
            mwstSatz: 0,
            zweck: 'Rivale',
            belegNummer: null,
            kategorie: null,
            kassenbestandNach: 0,
            erfasstVonUserId: 'u9',
            festgeschrieben: true,
            festgeschriebenAm: new Date(),
            stornoVonId: original.id,
          });
        }
        return origSave(e);
      });

      await expect(svc.storno(USER, original.id, {})).rejects.toBeInstanceOf(ConflictException);
      // GENAU eine Gegenbuchung fuer das Original (die des Rivalen), keine zweite.
      const gegenbuchungen = repo.rows.filter((r) => r.stornoVonId === original.id);
      expect(gegenbuchungen).toHaveLength(1);
      expect(gegenbuchungen[0].id).toBe('rival-storno');
    });

    it('storniert nur festgeschriebene Eintraege (Entwurf -> 400)', async () => {
      const { svc } = makeService();
      const entwurf = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'x' });
      await expect(svc.storno(USER, entwurf.id, {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Mandantentrennung
  // -------------------------------------------------------------------------
  describe('Tenant-Isolation', () => {
    it('findOne liefert einen fremden Eintrag NICHT (404)', async () => {
      const { svc } = makeService();
      const e = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'privat' });
      await expect(svc.findOne('t2', e.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('festschreiben/storno eines fremden Eintrags scheitert (404)', async () => {
      const { svc } = makeService();
      const e = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'privat' });
      await expect(svc.festschreiben(USER2, e.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Nummernkreise sind je Tenant getrennt (beide starten bei 1)', async () => {
      const { svc } = makeService();
      const t1 = await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 't1' });
      const t2 = await svc.create(USER2, { typ: 'einnahme', betrag: 100, zweck: 't2' });
      expect(t1.laufendeNummer).toBe(1);
      expect(t2.laufendeNummer).toBe(1);
    });

    it('Saldo/Liste sind tenant-scoped', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 't1' });
      await svc.create(USER2, { typ: 'einnahme', betrag: 999, zweck: 't2' });
      const liste = await svc.findAll('t1', {});
      expect(liste.total).toBe(1);
      expect(liste.kassenbestand).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Saldo + Export
  // -------------------------------------------------------------------------
  describe('saldo + export', () => {
    it('summiert Einnahmen/Ausgaben und liefert den aktuellen Bestand', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'A' });
      await svc.create(USER, { typ: 'ausgabe', betrag: 40, zweck: 'B' });
      const s = await svc.saldo('t1');
      expect(s.kassenbestand).toBe(60);
      expect(s.monat.einnahmen).toBe(100);
      expect(s.monat.ausgaben).toBe(40);
      expect(s.monat.saldo).toBe(60);
    });

    it('exportiert das Kassenbuch als CSV (BOM + Zeilen)', async () => {
      const { svc } = makeService();
      await svc.create(USER, { typ: 'einnahme', betrag: 100, zweck: 'Barverkauf' });
      const { buffer, filename, contentType } = await svc.buildExport('t1', {});
      const text = buffer.toString('utf-8');
      expect(filename).toBe('Kassenbuch.csv');
      expect(contentType).toContain('text/csv');
      expect(text.startsWith('﻿')).toBe(true);
      expect(text).toContain('Barverkauf');
    });

    it('Tages-/Monatssaldo nutzt Berliner Tagesgrenzen (00:30 Berlin faellt in den richtigen Tag)', async () => {
      const { svc, repo } = makeService();
      // 2026-07-17 22:30 UTC = 2026-07-18 00:30 Berlin (Sommerzeit, UTC+2).
      repo.rows.push({
        id: 'e-boundary',
        tenantId: 't1',
        laufendeNummer: 1,
        datum: new Date('2026-07-17T22:30:00Z'),
        typ: 'einnahme',
        betrag: 50,
        mwstSatz: 0,
        zweck: 'Nacht',
        belegNummer: null,
        kategorie: null,
        kassenbestandNach: 50,
        erfasstVonUserId: 'u1',
        festgeschrieben: false,
        stornoVonId: null,
      });
      // Berliner Tag 18. enthaelt die Buchung, Tag 17. nicht.
      expect((await svc.saldo('t1', '2026-07-18')).tag.einnahmen).toBe(50);
      expect((await svc.saldo('t1', '2026-07-17')).tag.einnahmen).toBe(0);
      // Monat Juli enthaelt sie, Juni nicht (Grenzfall zum Vormonat via Berlin).
      expect((await svc.saldo('t1', '2026-07-01')).monat.einnahmen).toBe(50);
      expect((await svc.saldo('t1', '2026-06-30')).monat.einnahmen).toBe(0);
    });

    it('Export loest die Storno-Original-Nummer auch bei Zeitraum-Filter auf', async () => {
      const { svc, repo } = makeService();
      // Original im Juni (ausserhalb des Filters), Gegenbuchung im Juli (im Filter).
      repo.rows.push({
        id: 'orig',
        tenantId: 't1',
        laufendeNummer: 1,
        datum: new Date('2026-06-15T10:00:00Z'),
        typ: 'einnahme',
        betrag: 100,
        mwstSatz: 0,
        zweck: 'Original',
        belegNummer: null,
        kategorie: null,
        kassenbestandNach: 100,
        erfasstVonUserId: 'u1',
        festgeschrieben: true,
        festgeschriebenAm: new Date('2026-06-15T10:00:00Z'),
        stornoVonId: null,
      });
      repo.rows.push({
        id: 'gegen',
        tenantId: 't1',
        laufendeNummer: 2,
        datum: new Date('2026-07-15T10:00:00Z'),
        typ: 'ausgabe',
        betrag: 100,
        mwstSatz: 0,
        zweck: 'Storno zu Nr. 1: Original',
        belegNummer: null,
        kategorie: null,
        kassenbestandNach: 0,
        erfasstVonUserId: 'u1',
        festgeschrieben: true,
        festgeschriebenAm: new Date('2026-07-15T10:00:00Z'),
        stornoVonId: 'orig',
      });
      const { buffer } = await svc.buildExport('t1', { von: '2026-07-01', bis: '2026-07-31' });
      const zeilen = buffer.toString('utf-8').replace(/^﻿/, '').split('\r\n').filter(Boolean);
      // Nur die Gegenbuchung (Nr. 2) liegt im Filter – Original (Nr. 1) ist raus.
      const stornoZeile = zeilen.find((z) => z.startsWith('2;'));
      expect(stornoZeile).toBeDefined();
      // Letzte Spalte "Storno zu Nr." = 1 (Original separat nachgeladen).
      expect(stornoZeile!.split(';').pop()).toBe('1');
      // Das Original selbst ist NICHT im Export (Zeitraum-Filter).
      expect(zeilen.some((z) => z.startsWith('1;'))).toBe(false);
    });
  });
});
