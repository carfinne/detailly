import { NotFoundException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  MELDEFRIST_MS,
  meldefristDeadline,
  meldefristRestMs,
  meldefristUeberfaellig,
} from './incident.constants';

const OWNER: AuthUser = { id: 'u1', email: 'o@x.de', role: 'owner', tenantId: 'tenant-1' } as AuthUser;
const PLATFORM: AuthUser = { id: 'p1', email: 'a@detailly.de', role: 'platform_admin', tenantId: '' } as AuthUser;

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => ({ ...(x as object) })),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: x.id ?? 'gen', ...x })),
    ...overrides,
  };
}

describe('72h-Meldefrist-Helfer (Art. 33)', () => {
  const kenntnis = new Date('2026-07-16T00:00:00.000Z');

  it('Deadline = kenntnisAm + 72h', () => {
    expect(meldefristDeadline(kenntnis).getTime()).toBe(kenntnis.getTime() + MELDEFRIST_MS);
  });

  it('restMs positiv vor, negativ nach Ablauf', () => {
    const kurzVor = new Date(kenntnis.getTime() + 71 * 3600_000);
    const kurzNach = new Date(kenntnis.getTime() + 73 * 3600_000);
    expect(meldefristRestMs(kenntnis, kurzVor)).toBeGreaterThan(0);
    expect(meldefristRestMs(kenntnis, kurzNach)).toBeLessThan(0);
    expect(meldefristUeberfaellig(kenntnis, kurzVor)).toBe(false);
    expect(meldefristUeberfaellig(kenntnis, kurzNach)).toBe(true);
  });
});

describe('IncidentsService – Tenant-Isolation', () => {
  it('OWNER: Liste ist auf den eigenen tenantId gescoped', async () => {
    const repo = makeRepo();
    const svc = new IncidentsService(repo as never);
    await svc.list(OWNER);
    const where = (repo.find as jest.Mock).mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant-1');
  });

  it('PLATFORM: Liste sieht NUR plattformweite Vorfaelle (tenantId IS NULL, kein String)', async () => {
    const repo = makeRepo();
    const svc = new IncidentsService(repo as never);
    await svc.list(PLATFORM);
    const where = (repo.find as jest.Mock).mock.calls[0][0].where;
    // FindOperator (IsNull) statt eines konkreten Tenant-Strings.
    expect(typeof where.tenantId).toBe('object');
    expect(where.tenantId).not.toBe('tenant-1');
  });

  it('getOne wirft NotFound bei fremdem/nicht existierendem Vorfall', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new IncidentsService(repo as never);
    await expect(svc.getOne(OWNER, 'x')).rejects.toBeInstanceOf(NotFoundException);
    const where = (repo.findOne as jest.Mock).mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant-1'); // Scope auch beim Einzel-Load
  });
});

describe('IncidentsService – manuelle Anlage (kein Auto-Versand)', () => {
  it('setzt tenantId aus dem Nutzer, Status "erkannt", KEINE Melde-Zeitstempel', async () => {
    const repo = makeRepo();
    const svc = new IncidentsService(repo as never);
    const view = await svc.create(OWNER, { beschreibung: 'Laptop verloren' } as never);
    expect(view.tenantId).toBe('tenant-1');
    expect(view.quelle).toBe('manuell');
    expect(view.status).toBe('erkannt');
    // Review-before-send: nichts wurde "gemeldet".
    expect(view.verantwortlicherInformiertAm).toBeUndefined();
    expect(view.aufsichtsbehoerdeGemeldetAm).toBeUndefined();
    expect(view.betroffeneInformiertAm).toBeUndefined();
    // 72h-Ableitung ist im View enthalten.
    expect(view.frist.deadline).toBeDefined();
  });
});

describe('IncidentsService – Eskalations-Checkliste (Zeitstempel-Toggle)', () => {
  const base = () => ({
    id: 'i1',
    tenantId: 'tenant-1',
    status: 'in_pruefung',
    schweregrad: 'mittel',
    kenntnisAm: new Date('2026-07-16T00:00:00.000Z'),
    verantwortlicherInformiertAm: null,
    aufsichtsbehoerdeGemeldetAm: null,
    betroffeneInformiertAm: null,
  });

  it('true setzt den Zeitstempel, false loescht ihn wieder', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(base()) });
    const svc = new IncidentsService(repo as never);
    const gesetzt = await svc.update(OWNER, 'i1', { aufsichtsbehoerdeGemeldet: true } as never);
    expect(gesetzt.aufsichtsbehoerdeGemeldetAm).toBeInstanceOf(Date);

    const wiederLeer = base();
    wiederLeer.aufsichtsbehoerdeGemeldetAm = new Date() as never;
    const repo2 = makeRepo({ findOne: jest.fn().mockResolvedValue(wiederLeer) });
    const svc2 = new IncidentsService(repo2 as never);
    const geleert = await svc2.update(OWNER, 'i1', { aufsichtsbehoerdeGemeldet: false } as never);
    expect(geleert.aufsichtsbehoerdeGemeldetAm).toBeNull();
  });
});

describe('IncidentsService – Auto-Vorfall De-Duplizierung', () => {
  it('legt bei fehlendem offenen Vorfall einen NEUEN an (created=true), ohne Melde-Zeitstempel', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new IncidentsService(repo as never);
    const res = await svc.upsertAutoIncident({
      tenantId: 'tenant-1',
      signalTyp: 'login_bruteforce',
      beobachtet: 25,
      detail: '25 in 15 min',
      now: new Date('2026-07-16T12:00:00.000Z'),
    });
    expect(res.created).toBe(true);
    expect(repo.create).toHaveBeenCalledTimes(1);
    // Auto-Vorfall meldet nichts automatisch.
    expect(res.incident.verantwortlicherInformiertAm).toBeUndefined();
    expect(res.incident.aufsichtsbehoerdeGemeldetAm).toBeUndefined();
    expect(res.incident.quelle).toBe('auto_signal');
  });

  it('aktualisiert bei bereits OFFENEM (tenant, signal) statt neu anzulegen (created=false)', async () => {
    const bestehend = {
      id: 'i9',
      tenantId: 'tenant-1',
      signalTyp: 'login_bruteforce',
      status: 'erkannt',
      betroffeneDatensaetzeAnzahl: 20,
      beschreibung: 'alt',
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(bestehend) });
    const svc = new IncidentsService(repo as never);
    const res = await svc.upsertAutoIncident({
      tenantId: 'tenant-1',
      signalTyp: 'login_bruteforce',
      beobachtet: 40,
      detail: '40 in 15 min',
    });
    expect(res.created).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(res.incident.betroffeneDatensaetzeAnzahl).toBe(40); // Zaehler aktualisiert
  });

  it('ueberschreibt menschliche Edits eines in_pruefung-Vorfalls NICHT (Fix #1)', async () => {
    // Der OWNER hat den Vorfall in Pruefung genommen und beschreibung/Count gepflegt.
    const inPruefung = {
      id: 'i10',
      tenantId: 'tenant-1',
      signalTyp: 'login_bruteforce',
      status: 'in_pruefung',
      betroffeneDatensaetzeAnzahl: 27,
      beschreibung: 'Ermittlungsnotiz des OWNER – bitte nicht anfassen',
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(inPruefung) });
    const svc = new IncidentsService(repo as never);
    const res = await svc.upsertAutoIncident({
      tenantId: 'tenant-1',
      signalTyp: 'login_bruteforce',
      beobachtet: 999,
      detail: '999 in 15 min',
    });
    // De-Dup greift (kein neuer Vorfall), aber die menschlich gepflegten Felder
    // bleiben unangetastet und es wird NICHT gespeichert.
    expect(res.created).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(res.incident.betroffeneDatensaetzeAnzahl).toBe(27);
    expect(res.incident.beschreibung).toBe('Ermittlungsnotiz des OWNER – bitte nicht anfassen');
  });
});

describe('IncidentsService – Melde-Vorlage (Review-before-send)', () => {
  it('erzeugt Art.-33-Text mit Nicht-Versand-Hinweis und persistiert ihn (kein Mail-Versand)', async () => {
    const inc = {
      id: 'i1',
      tenantId: 'tenant-1',
      schweregrad: 'hoch',
      kenntnisAm: new Date('2026-07-16T00:00:00.000Z'),
      betroffeneDatenkategorien: ['kontaktdaten'],
      betroffenePersonenAnzahl: 12,
      beschreibung: 'Test',
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(inc) });
    const svc = new IncidentsService(repo as never);
    const { entwurf } = await svc.generateMeldungEntwurf(OWNER, 'i1');
    expect(entwurf).toContain('Art. 33');
    expect(entwurf).toContain('NICHT automatisch versendet');
    expect(repo.save).toHaveBeenCalledTimes(1); // nur DB-Persistenz, KEIN Versand
  });
});
