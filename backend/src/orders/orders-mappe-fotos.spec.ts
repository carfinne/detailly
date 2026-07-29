import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { storage } from '../common/storage';

/**
 * Welle 2-C: Nachher-/Vorher-Fotos in der oeffentlichen Uebergabe-Mappe. Fokus:
 *  - der PII-arme Payload liefert token-scoped INDEX-URLs (keine Order-ID/Dateinamen),
 *  - der Bild-Endpunkt greift NUR in die auftragseigene Liste (Tenant aus dem Token),
 *  - Directory-Traversal wird ueber basename neutralisiert,
 *  - Index ausserhalb / falsches Token -> 404 (kein Orakel).
 */
const VALID_TOKEN = 'c'.repeat(48);

function makeService(over: {
  order?: any;
  tenant?: any;
  vehicle?: any;
  feature?: boolean;
} = {}) {
  const repo: any = { findOne: jest.fn().mockResolvedValue(over.order ?? null) };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
  const vehicleRepo: any = { findOne: jest.fn().mockResolvedValue(over.vehicle ?? null) };
  const tenantRepo: any = { findOne: jest.fn().mockResolvedValue(over.tenant ?? null) };
  const subscriptions: any = {
    hasFeatureForTenant: jest.fn().mockResolvedValue(over.feature ?? true),
  };
  const svc = new OrdersService(
    repo, {} as any, customerRepo, vehicleRepo, {} as any, {} as any, tenantRepo,
    {} as any, {} as any, { send: jest.fn() } as any, { get: jest.fn() } as any, subscriptions,
  );
  return { svc };
}

const baseOrder = {
  id: 'o1', tenantId: 't1', auftragsnummer: 'AU-2026-0007', serviceType: 'folierung',
  status: 'fertig', customerId: 'c1', vehicleId: 'v1', createdAt: new Date(),
  bilderVorher: ['v1.jpg'],
  bilderNachher: ['a.jpg', 'b.jpg'],
  items: [],
};

describe('OrdersService · mappeWebByToken · Fotos + Bewertungslink', () => {
  it('liefert token-scoped Index-URLs (Nachher/Vorher) und den Bewertungslink', async () => {
    const { svc } = makeService({
      order: baseOrder,
      feature: true,
      tenant: { id: 't1', name: 'Folienprofi', settings: { bewertung: { aktiv: true, googleUrl: 'https://g.page/r/xyz' } } },
    });
    const view = await svc.mappeWebByToken(VALID_TOKEN);

    expect(view.fotosNachher).toEqual([
      `/public/orders/${VALID_TOKEN}/foto/nachher/0`,
      `/public/orders/${VALID_TOKEN}/foto/nachher/1`,
    ]);
    expect(view.fotosVorher).toEqual([`/public/orders/${VALID_TOKEN}/foto/vorher/0`]);
    expect(view.nachherAnzahl).toBe(2);
    expect(view.bewertungslink).toBe('https://g.page/r/xyz');
  });

  it('PII-arm: KEINE interne Order-ID / kein Dateiname / keine tenantId im Payload', async () => {
    const { svc } = makeService({
      order: baseOrder,
      feature: true,
      tenant: { id: 't1', name: 'X', settings: {} },
    });
    const view = await svc.mappeWebByToken(VALID_TOKEN);
    const flat = JSON.stringify(view);
    expect(flat).not.toContain('o1'); // Order-ID
    expect(flat).not.toContain('a.jpg'); // Dateiname
    expect(flat).not.toContain('v1.jpg');
    // tenantId taucht nicht auf (der Token ist die einzige oeffentliche Referenz).
    expect(view.bewertungslink).toBeNull();
  });

  it('unsicherer Bewertungslink (nicht https) -> null', async () => {
    const { svc } = makeService({
      order: baseOrder,
      feature: true,
      tenant: { id: 't1', name: 'X', settings: { bewertung: { googleUrl: 'javascript:alert(1)' } } },
    });
    const view = await svc.mappeWebByToken(VALID_TOKEN);
    expect(view.bewertungslink).toBeNull();
  });
});

describe('OrdersService · mappeFotoContextByToken (token-scoped Bild)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('gueltiger Index -> Storage-Key aus dem Token-Tenant + Content-Type', async () => {
    const { svc } = makeService({ order: baseOrder, feature: true, tenant: { id: 't1', settings: {} } });
    jest.spyOn(storage, 'exists').mockResolvedValue(true);
    const res = await svc.mappeFotoContextByToken(VALID_TOKEN, 'nachher', '0');
    expect(res.key).toBe('orders/t1/a.jpg');
    expect(res.contentType).toBe('image/jpeg');
  });

  it('Directory-Traversal im DB-Wert wird ueber basename neutralisiert', async () => {
    const order = { ...baseOrder, bilderNachher: ['../../etc/passwd.png'] };
    const { svc } = makeService({ order, feature: true, tenant: { id: 't1', settings: {} } });
    jest.spyOn(storage, 'exists').mockResolvedValue(true);
    const res = await svc.mappeFotoContextByToken(VALID_TOKEN, 'nachher', '0');
    expect(res.key).toBe('orders/t1/passwd.png'); // bleibt im Tenant-Ordner
  });

  it('Index ausserhalb der Liste -> 404 (kein Storage-Zugriff)', async () => {
    const { svc } = makeService({ order: baseOrder, feature: true, tenant: { id: 't1', settings: {} } });
    const spy = jest.spyOn(storage, 'exists').mockResolvedValue(true);
    await expect(svc.mappeFotoContextByToken(VALID_TOKEN, 'nachher', '9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('unplausibles Token -> 404 (kein Auftrag geladen)', async () => {
    const { svc } = makeService({ order: baseOrder, feature: true, tenant: { id: 't1', settings: {} } });
    await expect(svc.mappeFotoContextByToken('xyz', 'nachher', '0')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('OHNE Feature -> 404 (kein Orakel)', async () => {
    const { svc } = makeService({ order: baseOrder, feature: false, tenant: { id: 't1', settings: {} } });
    await expect(svc.mappeFotoContextByToken(VALID_TOKEN, 'nachher', '0')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('Datei fehlt im Storage -> 404', async () => {
    const { svc } = makeService({ order: baseOrder, feature: true, tenant: { id: 't1', settings: {} } });
    jest.spyOn(storage, 'exists').mockResolvedValue(false);
    await expect(svc.mappeFotoContextByToken(VALID_TOKEN, 'nachher', '0')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
