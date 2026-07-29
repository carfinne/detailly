import { OrdersService } from './orders.service';
import { ServiceType } from './entities/order.entity';

/**
 * "Als Vorlage verwenden / Duplizieren" (Welle 1-A, F1) ist reine Frontend-Logik:
 * das Anlege-Formular wird mit Kunde/Fahrzeug/Positionen vorbefuellt und trifft
 * das BESTEHENDE POST /orders. Dieser Test sichert die Vertrags-Invarianten ab,
 * auf die das Duplizieren baut: create() UEBERNIMMT die uebergebenen Positionen,
 * vergibt aber IMMER einen frischen Status (angefragt) und eine serverseitig
 * gezogene Auftragsnummer – ein Client kann weder Status noch Nummer setzen
 * (das DTO kennt diese Felder gar nicht). Unit-Test mit gemockten Repositories.
 */
function makeService() {
  const gespeichert: any[] = [];
  const repo: any = {
    create: jest.fn().mockImplementation((x: any) => ({ ...x })),
    count: jest.fn().mockResolvedValue(0), // nextSequentialNumber -> lfd 0001
    save: jest.fn().mockImplementation(async (o: any) => ({ ...o, id: 'ord-neu' })),
    // findOne am Ende (Rueckgabe) UND fuer nextSequentialNumber nicht genutzt.
    findOne: jest.fn().mockImplementation(async () => ({ ...gespeichert[0], id: 'ord-neu' })),
  };
  const itemRepo: any = { create: jest.fn().mockImplementation((x: any) => ({ ...x })) };
  const customerRepo: any = { findOne: jest.fn().mockResolvedValue({ id: 'c1', tenantId: 't1' }) };
  const audit: any = { log: jest.fn().mockResolvedValue(undefined) };
  // save-Spy fuellt gespeichert[] fuer die finale findOne-Rueckgabe.
  repo.save.mockImplementation(async (o: any) => {
    const s = { ...o, id: 'ord-neu' };
    gespeichert[0] = s;
    return s;
  });
  const svc = new OrdersService(
    repo, // Order
    itemRepo, // OrderItem
    customerRepo, // Customer
    {} as any, // Vehicle
    {} as any, // User
    {} as any, // Location
    {} as any, // Tenant
    {} as any, // Invoice
    audit, // audit
    { send: jest.fn() } as any, // mail
    { get: jest.fn() } as any, // config
    {} as any, // subscriptions
  );
  return { svc, repo, itemRepo };
}

const USER: any = { id: 'u1', tenantId: 't1' };

describe('OrdersService · create (Duplizier-Invarianten, F1)', () => {
  it('uebernimmt alle Positionen aus dem DTO (Beschreibung/Menge/Einzelpreis)', async () => {
    const { svc, itemRepo } = makeService();
    await svc.create(USER, {
      customerId: 'c1',
      serviceType: ServiceType.FOLIERUNG,
      items: [
        { beschreibung: 'Vollfolierung', menge: 1, einzelpreis: 2000 },
        { beschreibung: 'Scheibentoenung', menge: 4, einzelpreis: 75 },
      ],
    } as any);
    // Beide Positionen wurden 1:1 uebernommen.
    expect(itemRepo.create).toHaveBeenCalledTimes(2);
    expect(itemRepo.create.mock.calls[0][0]).toMatchObject({
      beschreibung: 'Vollfolierung',
      menge: 1,
      einzelpreis: 2000,
      gesamtpreis: 2000,
    });
    expect(itemRepo.create.mock.calls[1][0]).toMatchObject({
      beschreibung: 'Scheibentoenung',
      menge: 4,
      einzelpreis: 75,
      gesamtpreis: 300,
    });
  });

  it('vergibt frischen Status (angefragt) + serverseitige Nummer; kein Online-Marker', async () => {
    const { svc, repo } = makeService();
    await svc.create(USER, {
      customerId: 'c1',
      serviceType: ServiceType.FOLIERUNG,
      items: [{ beschreibung: 'X', menge: 1, einzelpreis: 10 }],
    } as any);
    const angelegt = repo.create.mock.calls[0][0];
    // Kein Status aus dem Client -> Entity-Default greift (angefragt); Nummer
    // wird in der Retry-Schleife gezogen (Format AU-<jahr>-0001).
    expect(angelegt.status).toBeUndefined(); // create() setzt keinen Status -> DB-Default angefragt
    const jahr = new Date().getFullYear();
    const saved = repo.save.mock.calls[0][0];
    expect(saved.auftragsnummer).toBe(`AU-${jahr}-0001`);
    // Duplikat ist KEINE Online-Angebotsannahme -> Marker bleibt ungesetzt.
    expect(angelegt.angebotOnlineAngenommenAm).toBeUndefined();
    expect(angelegt.angebotInvoiceId).toBeUndefined();
  });
});
