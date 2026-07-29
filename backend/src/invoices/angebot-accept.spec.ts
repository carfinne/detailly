import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AngebotStatus, Invoice, InvoiceKind } from './entities/invoice.entity';
import { Order } from '../orders/entities/order.entity';

/**
 * Welle 1 (F2): Angebot annehmen -> Auftrag. Unit-Test mit gemockter Transaktion.
 * repo.manager.transaction ruft den Callback mit einem Manager auf, dessen
 * getRepository(Invoice|Order) die gemockten Transaktions-Repos liefert.
 * (isSqlite() ist im Test true -> der Postgres-Lock-Zweig wird nicht ausgefuehrt.)
 */
function makeService(over: {
  angebot?: any;
  gruppe?: any[]; // invRepo.find -> Gruppen-Mitglieder-IDs
  gruppenAuftrag?: any; // ordRepo.findOne (Gruppen-Auftrags-Lookup)
  quelle?: any;
  saveThrows?: any; // ordRepo.save wirft (Unique-Verletzung)
  outerBestehend?: any; // this.orderRepo.findOne nach Unique-Verletzung
} = {}) {
  const invRepo: any = {
    findOne: jest.fn().mockResolvedValue(over.angebot ?? null),
    find: jest.fn().mockResolvedValue(over.gruppe ?? (over.angebot ? [{ id: over.angebot.id }] : [])),
    save: jest.fn().mockImplementation(async (x: any) => x),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const ordRepo: any = {
    findOne: jest
      .fn()
      .mockResolvedValueOnce(over.gruppenAuftrag ?? null) // Gruppen-Auftrags-Lookup
      .mockResolvedValueOnce(over.quelle ?? null), // Quell-Auftrag
    create: jest.fn().mockImplementation((x: any) => x),
    save: over.saveThrows
      ? jest.fn().mockRejectedValue(over.saveThrows)
      : jest.fn().mockImplementation(async (o: any) => ({ ...o, id: 'ord-neu' })),
    count: jest.fn().mockResolvedValue(0),
  };
  const manager = {
    getRepository: (e: any) => (e === Invoice ? invRepo : e === Order ? ordRepo : null),
  };
  // repo.findOne wird NUR vom oeffentlichen Token-Pfad genutzt (resolveAngebotToken
  // + Ziel-Lookup); der eingeloggte Pfad (acceptAngebot) beruehrt es nicht.
  const repo: any = { findOne: jest.fn(), manager: { transaction: (cb: any) => cb(manager) } };
  const outerOrderRepo: any = { findOne: jest.fn().mockResolvedValue(over.outerBestehend ?? null) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, outerOrderRepo, {} as any, {} as any, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, repo, invRepo, ordRepo, outerOrderRepo, audit };
}

const USER: any = { id: 'u1', tenantId: 't1' };
const inZukunft = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const inVergangenheit = new Date(Date.now() - 24 * 3600 * 1000);

function angebot(over: any = {}) {
  return {
    id: 'a1',
    tenantId: 't1',
    art: InvoiceKind.ANGEBOT,
    customerId: 'c1',
    varianteGruppeId: 'g1',
    gueltigBis: inZukunft,
    items: [{ beschreibung: 'Folierung', menge: 1, einzelpreis: 2000 }],
    ...over,
  };
}

describe('InvoicesService · Angebot annehmen (F2)', () => {
  it('erzeugt Auftrag, markiert gewaehlte Variante, lehnt Geschwister ab', async () => {
    const { svc, invRepo, ordRepo } = makeService({ angebot: angebot(), gruppe: [{ id: 'a1' }, { id: 'a2' }] });
    const order = await svc.acceptAngebot(USER, 'a1');

    expect(order.id).toBe('ord-neu');
    expect(ordRepo.save).toHaveBeenCalledTimes(1);
    const gespeicherterAuftrag = ordRepo.create.mock.calls[0][0];
    expect(gespeicherterAuftrag.angebotInvoiceId).toBe('a1');
    expect(gespeicherterAuftrag.tenantId).toBe('t1');

    const gesichert = invRepo.save.mock.calls[0][0];
    expect(gesichert.istGewaehlt).toBe(true);
    expect(gesichert.angebotStatus).toBe(AngebotStatus.ANGENOMMEN);

    expect(invRepo.update).toHaveBeenCalledTimes(1);
    const [where, patch] = invRepo.update.mock.calls[0];
    expect(where.tenantId).toBe('t1');
    expect(where.varianteGruppeId).toBe('g1');
    expect(patch.angebotStatus).toBe(AngebotStatus.ABGELEHNT);
  });

  it('idempotent (dieselbe Variante): existiert bereits ein Auftrag -> diesen zurueckgeben', async () => {
    const { svc, invRepo, ordRepo } = makeService({
      angebot: angebot(),
      gruppenAuftrag: { id: 'ord-alt', tenantId: 't1', angebotInvoiceId: 'a1' },
    });
    const order = await svc.acceptAngebot(USER, 'a1');
    expect(order.id).toBe('ord-alt');
    expect(ordRepo.save).not.toHaveBeenCalled();
    expect(invRepo.save).not.toHaveBeenCalled();
    expect(invRepo.update).not.toHaveBeenCalled();
  });

  // Finding 1 (KRITISCH): zweite Variante derselben Gruppe darf NICHT annehmbar sein.
  it('zweite Variante der Gruppe -> 409; Auftrag-A bleibt, A bleibt ANGENOMMEN', async () => {
    const { svc, invRepo, ordRepo } = makeService({
      angebot: angebot({ id: 'a2', angebotStatus: AngebotStatus.ABGELEHNT }),
      gruppe: [{ id: 'a1' }, { id: 'a2' }],
      gruppenAuftrag: { id: 'ord-a', tenantId: 't1', angebotInvoiceId: 'a1' },
    });
    await expect(svc.acceptAngebot(USER, 'a2')).rejects.toBeInstanceOf(ConflictException);
    // Kein neuer Auftrag, keine Statusaenderung an A (invRepo.save/update unberuehrt).
    expect(ordRepo.save).not.toHaveBeenCalled();
    expect(invRepo.save).not.toHaveBeenCalled();
    expect(invRepo.update).not.toHaveBeenCalled();
  });

  // Finding 1 (Zweitschutz): bereits abgelehnte Variante, selbst ohne gefundenen Auftrag.
  it('bereits abgelehnte Variante -> 409 (Zweitschutz ueber angebotStatus)', async () => {
    const { svc, ordRepo } = makeService({
      angebot: angebot({ angebotStatus: AngebotStatus.ABGELEHNT }),
      gruppenAuftrag: null,
    });
    await expect(svc.acceptAngebot(USER, 'a1')).rejects.toBeInstanceOf(ConflictException);
    expect(ordRepo.save).not.toHaveBeenCalled();
  });

  // Finding 2: Doppelklick/Race auf dieselbe Variante -> Unique-Index-Backstop.
  it('Unique-Verletzung beim Insert -> liefert denselben Auftrag, nie zwei', async () => {
    const uniqueErr = new Error(
      'UNIQUE constraint failed: orders.tenantId, orders.angebotInvoiceId',
    );
    const { svc, outerOrderRepo } = makeService({
      angebot: angebot(),
      saveThrows: uniqueErr,
      outerBestehend: { id: 'ord-gewinner', tenantId: 't1', angebotInvoiceId: 'a1' },
    });
    const order = await svc.acceptAngebot(USER, 'a1');
    expect(order.id).toBe('ord-gewinner');
    expect(outerOrderRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 't1', angebotInvoiceId: 'a1' },
    });
  });

  it('abgelaufenes Angebot -> 410 (Gone), kein Auftrag', async () => {
    const { svc, ordRepo } = makeService({ angebot: angebot({ gueltigBis: inVergangenheit }) });
    await expect(svc.acceptAngebot(USER, 'a1')).rejects.toBeInstanceOf(GoneException);
    expect(ordRepo.save).not.toHaveBeenCalled();
  });

  it('kein Angebot (Rechnung) -> 400', async () => {
    const { svc } = makeService({ angebot: angebot({ art: InvoiceKind.RECHNUNG }) });
    await expect(svc.acceptAngebot(USER, 'a1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fremder/nicht existierender Tenant -> 404 (Angebot nicht gefunden)', async () => {
    const { svc, ordRepo } = makeService({ angebot: null });
    await expect(svc.acceptAngebot(USER, 'a1')).rejects.toBeInstanceOf(NotFoundException);
    expect(ordRepo.save).not.toHaveBeenCalled();
  });

  // Welle 1-A (F3): Online-Annahme-Marker fuer die Glocke.
  it('Betrieb nimmt selbst an (eingeloggt) -> angebotOnlineAngenommenAm bleibt null', async () => {
    const { svc, ordRepo } = makeService({ angebot: angebot() });
    await svc.acceptAngebot(USER, 'a1');
    expect(ordRepo.create.mock.calls[0][0].angebotOnlineAngenommenAm).toBeNull();
  });

  it('Kunde nimmt ONLINE an (Token, ohne actorUserId) -> angebotOnlineAngenommenAm gesetzt', async () => {
    const { svc, repo, ordRepo } = makeService({ angebot: angebot() });
    const token = 'a'.repeat(48);
    // resolveAngebotToken -> Treffer; danach Ziel-Lookup (id+tenantId).
    (repo.findOne as jest.Mock)
      .mockResolvedValueOnce({ id: 'a1', tenantId: 't1', varianteGruppeId: 'g1' })
      .mockResolvedValueOnce({ id: 'a1', tenantId: 't1' });
    await svc.acceptAngebotByToken(token, 'a1');
    const marker = ordRepo.create.mock.calls[0][0].angebotOnlineAngenommenAm;
    expect(marker).toBeInstanceOf(Date);
  });
});
