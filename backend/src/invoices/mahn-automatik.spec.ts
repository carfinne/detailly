import { Logger } from '@nestjs/common';
import { MahnAutomatikService } from './mahn-automatik.service';

/**
 * Tests der Auto-Mahn-Job-Logik (C1-B) mit reinen Mocks (keine DB, kein Timer).
 * Fokus: richtige Stufe je Fristen, Idempotenz, autoMahnen=false -> nichts,
 * Feature-Gate `mahnwesen`, strikter Tenant-Scope, Fehler-Isolierung, NIE
 * falsche/bezahlte Rechnungen.
 *
 * `subscriptions.getTenantPlan` liefert per Default `null` (kein Tarif) – laut
 * `hasFeature` = Vollzugriff/Backward-compat, sodass die Kern-Tests unveraendert
 * greifen; die Gate-Tests setzen gezielt einen Plan mit/ohne `mahnwesen`.
 */
describe('MahnAutomatikService.runDaily', () => {
  const NOW = new Date(2026, 6, 7, 10, 0, 0); // fixe "Jetzt"-Zeit fuer Determinismus
  const gestern = new Date(2026, 6, 6, 10, 0, 0);
  const heuteFrueh = new Date(2026, 6, 7, 8, 0, 0);

  let tenantRepo: { find: jest.Mock };
  let invoices: { mahnliste: jest.Mock; sendMahnung: jest.Mock };
  let subscriptions: { getTenantPlan: jest.Mock };
  let svc: MahnAutomatikService;

  beforeAll(() => {
    // Job-Logger stummschalten (Warnungen bei Fehler-Tests nicht in die Konsole).
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    tenantRepo = { find: jest.fn() };
    invoices = { mahnliste: jest.fn().mockResolvedValue([]), sendMahnung: jest.fn().mockResolvedValue({}) };
    // Default: kein Tarif -> hasFeature(null) === true (Vollzugriff, Backward-compat).
    subscriptions = { getTenantPlan: jest.fn().mockResolvedValue(null) };
    svc = new MahnAutomatikService(tenantRepo as any, invoices as any, subscriptions as any);
  });

  const tenant = (id: string, mahnwesen?: unknown) => ({ id, settings: mahnwesen ? { mahnwesen } : {} });
  const rechnung = (id: string, tageUeberfaellig: number, over: Record<string, unknown> = {}) => ({
    id,
    tageUeberfaellig,
    mahnstufe: 0,
    versendetAm: null,
    ...over,
  });

  it('autoMahnen=false -> Betrieb wird uebersprungen (keine Mahnliste, kein Versand)', async () => {
    tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: false })]);
    const r = await svc.runDaily(NOW);
    expect(invoices.mahnliste).not.toHaveBeenCalled();
    expect(invoices.sendMahnung).not.toHaveBeenCalled();
    expect(r.tenants).toBe(0);
  });

  it('fehlende Mahnwesen-Konfig (Default) -> autoMahnen AUS -> nichts', async () => {
    tenantRepo.find.mockResolvedValue([tenant('t1')]); // settings ohne mahnwesen
    const r = await svc.runDaily(NOW);
    expect(invoices.sendMahnung).not.toHaveBeenCalled();
    expect(r.tenants).toBe(0);
  });

  it('mahnt nur Rechnungen, deren faellige Stufe > aktueller Mahnstufe ist (Default-Fristen 7/14/28)', async () => {
    tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
    invoices.mahnliste.mockResolvedValue([
      rechnung('A', 10, { mahnstufe: 0 }), // faellig 1 > 0 -> mahnen
      rechnung('B', 3, { mahnstufe: 0 }), //  faellig 0        -> nichts (noch nicht faellig)
      rechnung('C', 30, { mahnstufe: 3 }), // faellig 3, nicht > 3 -> nichts (bereits max)
      rechnung('D', 20, { mahnstufe: 1 }), // faellig 2 > 1 -> mahnen (eine Stufe)
    ]);
    const r = await svc.runDaily(NOW);
    expect(invoices.sendMahnung).toHaveBeenCalledTimes(2);
    expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'A');
    expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'D');
    expect(r).toMatchObject({ tenants: 1, geprueft: 4, gemahnt: 2, fehler: 0 });
  });

  it('eskaliert nur EINE Stufe pro Lauf (mahnstufe wird nicht uebersprungen)', async () => {
    // Sehr alte Rechnung (faellig 3) bei mahnstufe 0 -> nur EIN sendMahnung-Aufruf.
    tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
    invoices.mahnliste.mockResolvedValue([rechnung('A', 60, { mahnstufe: 0 })]);
    await svc.runDaily(NOW);
    expect(invoices.sendMahnung).toHaveBeenCalledTimes(1);
  });

  it('Idempotenz: heute bereits versendet -> uebersprungen; Vortag -> gemahnt', async () => {
    tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
    invoices.mahnliste.mockResolvedValue([
      rechnung('E', 10, { mahnstufe: 0, versendetAm: heuteFrueh }), // heute schon -> skip
      rechnung('F', 10, { mahnstufe: 0, versendetAm: gestern }), //    gestern     -> mahnen
    ]);
    const r = await svc.runDaily(NOW);
    expect(invoices.sendMahnung).toHaveBeenCalledTimes(1);
    expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'F');
    expect(r.gemahnt).toBe(1);
  });

  it('strikter Tenant-Scope: nur autoMahnen=true-Betrieb wird verarbeitet, korrekte tenantId', async () => {
    tenantRepo.find.mockResolvedValue([
      tenant('t1', { autoMahnen: true }),
      tenant('t2', { autoMahnen: false }),
    ]);
    invoices.mahnliste.mockImplementation((tid: string) =>
      Promise.resolve(tid === 't1' ? [rechnung('A', 10, { mahnstufe: 0 })] : []),
    );
    await svc.runDaily(NOW);
    expect(invoices.mahnliste).toHaveBeenCalledTimes(1);
    expect(invoices.mahnliste).toHaveBeenCalledWith('t1');
    expect(invoices.mahnliste).not.toHaveBeenCalledWith('t2');
    expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'A');
  });

  it('Fehler je Rechnung stoppt den Rest nicht (Fehler wird gezaehlt)', async () => {
    tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
    invoices.mahnliste.mockResolvedValue([
      rechnung('G', 10, { mahnstufe: 0 }),
      rechnung('H', 10, { mahnstufe: 0 }),
    ]);
    invoices.sendMahnung
      .mockRejectedValueOnce(new Error('kein E-Mail-Empfaenger'))
      .mockResolvedValueOnce({});
    const r = await svc.runDaily(NOW);
    expect(invoices.sendMahnung).toHaveBeenCalledTimes(2); // beide versucht
    expect(r).toMatchObject({ geprueft: 2, gemahnt: 1, fehler: 1 });
  });

  it('individuelle Fristen: Erinnerung erst ab Tag 14 -> Tag 10 wird nicht gemahnt', async () => {
    tenantRepo.find.mockResolvedValue([
      tenant('t1', { autoMahnen: true, fristen: { erinnerung: 14, mahnung1: 28, mahnung2: 56 } }),
    ]);
    invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
    const r = await svc.runDaily(NOW);
    expect(invoices.sendMahnung).not.toHaveBeenCalled();
    expect(r.gemahnt).toBe(0);
  });

  it('Fehler beim Laden der Betriebsliste -> leeres Ergebnis, kein Throw', async () => {
    tenantRepo.find.mockRejectedValue(new Error('db down'));
    await expect(svc.runDaily(NOW)).resolves.toMatchObject({ tenants: 0, gemahnt: 0 });
    expect(invoices.sendMahnung).not.toHaveBeenCalled();
  });

  // --- Feature-Gate `mahnwesen` (Umsatzsicherung) ---------------------------
  describe('Feature-Gate mahnwesen', () => {
    it('Tarif OHNE mahnwesen -> Betrieb komplett uebersprungen (kein Mahnlauf)', async () => {
      tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
      invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
      // Starter-artiger Tarif: fuehrt `mahnwesen` NICHT.
      subscriptions.getTenantPlan.mockResolvedValue({ features: ['kunden', 'rechnungen'] });
      const r = await svc.runDaily(NOW);
      expect(subscriptions.getTenantPlan).toHaveBeenCalledWith('t1');
      expect(invoices.mahnliste).not.toHaveBeenCalled();
      expect(invoices.sendMahnung).not.toHaveBeenCalled();
      expect(r.tenants).toBe(0);
    });

    it('Tarif MIT mahnwesen -> Betrieb wird gemahnt', async () => {
      tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
      invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
      subscriptions.getTenantPlan.mockResolvedValue({ features: ['rechnungen', 'mahnwesen'] });
      const r = await svc.runDaily(NOW);
      expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'A');
      expect(r).toMatchObject({ tenants: 1, gemahnt: 1 });
    });

    it('features == null (nicht gepflegt) -> Vollzugriff, Betrieb wird gemahnt', async () => {
      tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
      invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
      subscriptions.getTenantPlan.mockResolvedValue({ features: null });
      const r = await svc.runDaily(NOW);
      expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'A');
      expect(r.gemahnt).toBe(1);
    });

    it('nur autoMahnen=true-Betriebe loesen einen Tarif-Lookup aus (keine unnoetige Last)', async () => {
      tenantRepo.find.mockResolvedValue([
        tenant('t1', { autoMahnen: false }),
        tenant('t2', { autoMahnen: true }),
      ]);
      subscriptions.getTenantPlan.mockResolvedValue({ features: ['mahnwesen'] });
      await svc.runDaily(NOW);
      expect(subscriptions.getTenantPlan).toHaveBeenCalledTimes(1);
      expect(subscriptions.getTenantPlan).toHaveBeenCalledWith('t2');
    });

    it('Cron-Kontext: getTenantPlan wird OHNE Request-Scope-State aufgerufen (direkter Aufruf von runDaily)', async () => {
      // runDaily laeuft hier ohne HTTP-Request / request-memo-Middleware. Der
      // Lookup darf nicht auf Request-Scope-State angewiesen sein -> er muss
      // schlicht (asynchron) aufgeloest werden. Beweis: der gemockte Loader wird
      // aufgerufen und sein Ergebnis steuert das Gate.
      tenantRepo.find.mockResolvedValue([tenant('t1', { autoMahnen: true })]);
      invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
      subscriptions.getTenantPlan.mockResolvedValue({ features: ['mahnwesen'] });
      await svc.runDaily(NOW);
      expect(subscriptions.getTenantPlan).toHaveBeenCalledWith('t1');
      expect(invoices.sendMahnung).toHaveBeenCalledWith('t1', 'A');
    });

    it('Tarif-Lookup-Fehler -> Betrieb uebersprungen, Lauf laeuft weiter (kein Throw)', async () => {
      tenantRepo.find.mockResolvedValue([
        tenant('t1', { autoMahnen: true }),
        tenant('t2', { autoMahnen: true }),
      ]);
      invoices.mahnliste.mockResolvedValue([rechnung('A', 10, { mahnstufe: 0 })]);
      subscriptions.getTenantPlan
        .mockRejectedValueOnce(new Error('plan lookup down')) // t1 faellt aus
        .mockResolvedValueOnce({ features: ['mahnwesen'] }); //  t2 laeuft durch
      const r = await svc.runDaily(NOW);
      expect(invoices.mahnliste).toHaveBeenCalledTimes(1);
      expect(invoices.mahnliste).toHaveBeenCalledWith('t2');
      expect(r).toMatchObject({ tenants: 1, gemahnt: 1 });
    });
  });
});
