import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Welle 2-C: privates Kunden-Feedback zur Uebergabe-Mappe. Fokus:
 *  - tenant-korrekte Speicherung (tenantId/orderId AUS dem Token, nie aus dem Body),
 *  - Doppel-Absenden ist idempotent (ein Feedback je Auftrag wird aktualisiert),
 *  - Bewertungslink OHNE Gating zurueckgegeben (positiv = Betonung, nicht Zugang),
 *  - ungueltiges/gesperrtes Token -> 404,
 *  - Betreiber-Liste + gelesen-Markierung sind tenant-scoped.
 */
const VALID_TOKEN = 'd'.repeat(48);

const fertigOrder = {
  id: 'o1', tenantId: 't1', auftragsnummer: 'AU-2026-0007', serviceType: 'folierung',
  status: 'fertig', customerId: 'c1', vehicleId: 'v1', createdAt: new Date(),
  bilderNachher: ['a.jpg'], items: [],
};

function makeService(over: {
  order?: any;
  tenant?: any;
  feature?: boolean;
  feedback?: any;
} = {}) {
  const repo: any = {
    findOne: jest.fn().mockResolvedValue(over.order ?? null),
    find: jest.fn().mockResolvedValue([]),
  };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const subscriptions: any = {
    hasFeatureForTenant: jest.fn().mockResolvedValue(over.feature ?? true),
  };
  const feedbackRepo: any = over.feedback ?? {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => ({ id: 'fb1', ...v })),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const svc = new OrdersService(
    repo, {} as any, customerRepo, vehicleRepo, {} as any, {} as any, tenantRepo,
    {} as any, {} as any, { send: jest.fn() } as any, { get: jest.fn() } as any, subscriptions,
    undefined, undefined, feedbackRepo,
  );
  return { svc, repo, feedbackRepo };
}

describe('OrdersService · submitFeedbackByToken', () => {
  it('speichert tenant-korrekt (tenantId/orderId AUS dem Token, nicht aus dem Body)', async () => {
    const { svc, feedbackRepo } = makeService({
      order: fertigOrder,
      feature: true,
      tenant: { id: 't1', settings: { bewertung: { googleUrl: 'https://g.page/x' } } },
    });
    const res = await svc.submitFeedbackByToken(VALID_TOKEN, { sterne: 5, kommentar: 'Top!' } as any);

    expect(feedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', orderId: 'o1', sterne: 5, kommentar: 'Top!' }),
    );
    expect(feedbackRepo.save).toHaveBeenCalled();
    expect(res).toEqual({ success: true, positiv: true, bewertungslink: 'https://g.page/x' });
  });

  it('niedrige Bewertung: positiv=false, Bewertungslink dennoch zurueckgegeben (kein Gating)', async () => {
    const { svc } = makeService({
      order: fertigOrder,
      feature: true,
      tenant: { id: 't1', settings: { bewertung: { googleUrl: 'https://g.page/x' } } },
    });
    const res = await svc.submitFeedbackByToken(VALID_TOKEN, { sterne: 2 } as any);
    expect(res.positiv).toBe(false);
    // Kein Review-Gating: der Link kommt AUCH bei negativer Rueckmeldung zurueck.
    expect(res.bewertungslink).toBe('https://g.page/x');
  });

  it('Doppel-Absenden idempotent: bestehendes Feedback wird aktualisiert (kein zweiter Datensatz)', async () => {
    const bestehend = { id: 'fb1', tenantId: 't1', orderId: 'o1', sterne: 3, kommentar: 'alt', gelesen: true };
    const feedbackRepo: any = {
      findOne: jest.fn().mockResolvedValue(bestehend),
      create: jest.fn(),
      save: jest.fn(async (v: any) => v),
      count: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };
    const { svc } = makeService({
      order: fertigOrder,
      feature: true,
      tenant: { id: 't1', settings: {} },
      feedback: feedbackRepo,
    });
    await svc.submitFeedbackByToken(VALID_TOKEN, { sterne: 5, kommentar: 'neu' } as any);
    expect(feedbackRepo.create).not.toHaveBeenCalled();
    expect(feedbackRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fb1', sterne: 5, kommentar: 'neu', gelesen: false }),
    );
  });

  it('unplausibles Token -> 404 (kein Speichern)', async () => {
    const { svc, feedbackRepo } = makeService({ order: fertigOrder, feature: true, tenant: { id: 't1' } });
    await expect(svc.submitFeedbackByToken('xyz', { sterne: 5 } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(feedbackRepo.save).not.toHaveBeenCalled();
  });

  it('OHNE Feature (trotz Status fertig) -> 404 (kein Orakel)', async () => {
    const { svc } = makeService({ order: fertigOrder, feature: false, tenant: { id: 't1' } });
    await expect(svc.submitFeedbackByToken(VALID_TOKEN, { sterne: 5 } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('OrdersService · Betreiber-Feedback (tenant-scoped)', () => {
  it('listFeedback reichert die Auftragsnummer an und bleibt tenant-scoped', async () => {
    const rows = [
      { id: 'fb1', tenantId: 't1', orderId: 'o1', sterne: 5, kommentar: 'Top', gelesen: false, createdAt: new Date() },
    ];
    const feedbackRepo: any = { find: jest.fn().mockResolvedValue(rows) };
    const { svc, repo } = makeService({ feedback: feedbackRepo });
    repo.find.mockResolvedValue([{ id: 'o1', auftragsnummer: 'AU-2026-0007' }]);

    const list = await svc.listFeedback('t1');
    expect(feedbackRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    );
    expect(list[0]).toMatchObject({ id: 'fb1', auftragsnummer: 'AU-2026-0007', sterne: 5 });
  });

  it('markFeedbackGelesen ist tenant-scoped und 404 bei Fremd-/Nichtexistenz', async () => {
    const feedbackRepo: any = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
    const { svc } = makeService({ feedback: feedbackRepo });
    await expect(
      svc.markFeedbackGelesen({ id: 'u1', tenantId: 't1' } as any, 'fb-fremd'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(feedbackRepo.update).toHaveBeenCalledWith(
      { id: 'fb-fremd', tenantId: 't1' },
      { gelesen: true },
    );
  });
});
