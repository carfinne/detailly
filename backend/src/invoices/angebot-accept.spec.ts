import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AngebotStatus, Invoice, InvoiceKind } from './entities/invoice.entity';
import { Order } from '../orders/entities/order.entity';

/**
 * Welle 1 (F2): Angebot annehmen -> Auftrag. Unit-Test mit gemockter Transaktion.
 * repo.manager.transaction ruft den Callback mit einem Manager auf, dessen
 * getRepository(Invoice|Order) die gemockten Transaktions-Repos liefert.
 */
function makeService(over: {
  angebot?: any;
  bestehenderAuftrag?: any;
  quelle?: any;
} = {}) {
  const invRepo: any = {
    findOne: jest.fn().mockResolvedValue(over.angebot ?? null),
    save: jest.fn().mockImplementation(async (x: any) => x),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const ordRepo: any = {
    // 1. Aufruf = Idempotenz-Check, 2. Aufruf (falls Quelle) = Quell-Auftrag.
    findOne: jest
      .fn()
      .mockResolvedValueOnce(over.bestehenderAuftrag ?? null)
      .mockResolvedValueOnce(over.quelle ?? null),
    create: jest.fn().mockImplementation((x: any) => x),
    save: jest.fn().mockImplementation(async (o: any) => ({ ...o, id: 'ord-neu' })),
    count: jest.fn().mockResolvedValue(0),
  };
  const manager = {
    getRepository: (e: any) => (e === Invoice ? invRepo : e === Order ? ordRepo : null),
  };
  const repo: any = {
    manager: { transaction: (cb: any) => cb(manager) },
  };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new InvoicesService(
    repo, {} as any, {} as any, {} as any, {} as any, audit,
    {} as any, {} as any, {} as any, {} as any,
  );
  return { svc, invRepo, ordRepo, audit };
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
    const { svc, invRepo, ordRepo } = makeService({ angebot: angebot() });
    const order = await svc.acceptAngebot(USER, 'a1');

    expect(order.id).toBe('ord-neu');
    expect(ordRepo.save).toHaveBeenCalledTimes(1);
    // Auftrag traegt den Rueckverweis + ist tenant-scoped.
    const gespeicherterAuftrag = ordRepo.create.mock.calls[0][0];
    expect(gespeicherterAuftrag.angebotInvoiceId).toBe('a1');
    expect(gespeicherterAuftrag.tenantId).toBe('t1');

    // Gewaehlte Variante: istGewaehlt + angenommen.
    const gesichert = invRepo.save.mock.calls[0][0];
    expect(gesichert.istGewaehlt).toBe(true);
    expect(gesichert.angebotStatus).toBe(AngebotStatus.ANGENOMMEN);

    // Geschwister der Gruppe -> abgelehnt (tenant + Gruppe scoped, nicht die gewaehlte).
    expect(invRepo.update).toHaveBeenCalledTimes(1);
    const [where, patch] = invRepo.update.mock.calls[0];
    expect(where.tenantId).toBe('t1');
    expect(where.varianteGruppeId).toBe('g1');
    expect(patch.angebotStatus).toBe(AngebotStatus.ABGELEHNT);
  });

  it('idempotent: existiert bereits ein Auftrag -> diesen zurueckgeben, nichts erzeugen', async () => {
    const { svc, invRepo, ordRepo } = makeService({
      angebot: angebot(),
      bestehenderAuftrag: { id: 'ord-alt', tenantId: 't1', angebotInvoiceId: 'a1' },
    });
    const order = await svc.acceptAngebot(USER, 'a1');
    expect(order.id).toBe('ord-alt');
    expect(ordRepo.save).not.toHaveBeenCalled();
    expect(invRepo.save).not.toHaveBeenCalled();
    expect(invRepo.update).not.toHaveBeenCalled();
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
});
