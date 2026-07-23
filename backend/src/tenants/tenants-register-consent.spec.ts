import { BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { AGB_VERSION, AVV_VERSION, DSE_VERSION } from '../common/legal-versions';
import { RegisterTenantDto } from './dto/register-tenant.dto';

/**
 * Registrierungs-Zustimmung (GO-LIVE-BLOCKER): der Server erzwingt die Zustimmung
 * zu AGB / Datenschutzerklaerung / AVV HART. Fehlt eine, wird 400 geworfen und
 * NICHTS angelegt (keine Transaktion, kein bcrypt, kein Tenant). Mit Zustimmung
 * werden Zeitstempel (SERVERSEITIG) + Versions-Strings als Nachweis gespeichert.
 *
 * Reine Mocks: der DataSource-Transaction-Callback wird mit einem Manager-Stub
 * ausgefuehrt; wir pruefen, was der Service in `manager.save(Tenant, ...)` legt.
 */
function makeService() {
  const savedTenant: { value: any } = { value: null };

  const manager = {
    // User-Existenzpruefung + Slug-Eindeutigkeit -> beide „nicht vorhanden".
    findOne: jest.fn(async () => null),
    create: jest.fn((_entity: any, data: any) => ({ ...data })),
    save: jest.fn(async (obj: any) => {
      if (!obj.id) obj.id = `id-${Math.random().toString(36).slice(2)}`;
      // Erstes gespeichertes Objekt mit slug ist der Tenant -> festhalten.
      if (obj.slug && !savedTenant.value) savedTenant.value = obj;
      return obj;
    }),
  };

  const dataSource = {
    transaction: jest.fn(async (cb: any) => cb(manager)),
  };

  const authService = {
    hashPassword: jest.fn().mockResolvedValue('hashed'),
    buildEmailVerification: jest.fn().mockReturnValue({
      rawToken: 'raw',
      tokenHash: 'hash',
      expiresAt: new Date(),
    }),
    buildAuthResult: jest.fn().mockReturnValue({ accessToken: 'jwt', user: { id: 'u1' } }),
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  };

  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tenantRepo = { findOne: jest.fn(), save: jest.fn() };
  const mail = {};
  const sevdesk = {};
  const subscriptions = {};

  const svc = new TenantsService(
    dataSource as any,
    tenantRepo as any,
    authService as any,
    audit as any,
    mail as any,
    sevdesk as any,
    subscriptions as any,
  );

  return { svc, dataSource, authService, audit, manager, savedTenant };
}

const baseDto = (over: Partial<RegisterTenantDto> = {}): RegisterTenantDto =>
  ({
    firmenname: 'Muster Aufbereitung',
    firstName: 'Max',
    lastName: 'Muster',
    email: 'max@example.com',
    password: 'SicheresPasswort1',
    agbAkzeptiert: true,
    datenschutzAkzeptiert: true,
    avvAkzeptiert: true,
    ...over,
  }) as RegisterTenantDto;

describe('TenantsService · Registrierungs-Zustimmung', () => {
  it.each([
    ['agbAkzeptiert', { agbAkzeptiert: false }],
    ['datenschutzAkzeptiert', { datenschutzAkzeptiert: false }],
    ['avvAkzeptiert', { avvAkzeptiert: false }],
  ])('ohne %s -> 400, KEIN Tenant angelegt (keine Transaktion, kein bcrypt)', async (_name, over) => {
    const { svc, dataSource, authService } = makeService();
    await expect(svc.register(baseDto(over as any))).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(authService.hashPassword).not.toHaveBeenCalled();
  });

  it('alle Zustimmungen fehlen -> 400, nichts angelegt', async () => {
    const { svc, dataSource } = makeService();
    await expect(
      svc.register(baseDto({ agbAkzeptiert: false, datenschutzAkzeptiert: false, avvAkzeptiert: false })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('mit Zustimmung -> Tenant angelegt; Zeitstempel (serverseitig) + Versionen gespeichert', async () => {
    const { svc, manager, savedTenant, audit } = makeService();
    const vorher = Date.now();
    await svc.register(baseDto());
    const nachher = Date.now();

    // Der Tenant wurde ueber manager.create(Tenant, {...}) erzeugt.
    const createTenantCall = manager.create.mock.calls.find((c: any[]) => c[0] === Tenant);
    expect(createTenantCall).toBeTruthy();

    const t = savedTenant.value;
    expect(t).toBeTruthy();
    // Versionen aus common/legal-versions (Nachweis) – fuer ALLE drei Dokumente,
    // insbesondere die datenschutzrechtlich zentrale DSE (Art. 7 Abs. 1 Rechenschaft).
    expect(t.agbVersion).toBe(AGB_VERSION);
    expect(t.dseVersion).toBe(DSE_VERSION);
    expect(t.avvVersion).toBe(AVV_VERSION);
    // Zeitstempel SERVERSEITIG gesetzt (im Aufruf-Zeitfenster), fuer alle drei.
    for (const feld of ['agbAkzeptiertAm', 'dseAkzeptiertAm', 'avvAkzeptiertAm'] as const) {
      expect(t[feld]).toBeInstanceOf(Date);
      const ms = (t[feld] as Date).getTime();
      expect(ms).toBeGreaterThanOrEqual(vorher);
      expect(ms).toBeLessThanOrEqual(nachher);
    }

    // Registrierungs-Audit haelt die geltenden Versionen fest.
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.register',
        payload: expect.objectContaining({ agbVersion: AGB_VERSION, dseVersion: DSE_VERSION, avvVersion: AVV_VERSION }),
      }),
    );
  });

  it('Client-Zeitwerte werden ignoriert: Server setzt eigene Zeitstempel', async () => {
    const { svc, savedTenant } = makeService();
    // Selbst wenn ein Angreifer Zeitfelder mitschickt (DTO wuerde sie ohnehin per
    // forbidNonWhitelisted verwerfen), darf der Service NUR den Server-Zeitpunkt nehmen.
    const boese = { ...baseDto(), agbAkzeptiertAm: new Date('2000-01-01') } as any;
    await svc.register(boese);
    const jahr = (savedTenant.value.agbAkzeptiertAm as Date).getFullYear();
    expect(jahr).toBeGreaterThanOrEqual(new Date().getFullYear());
  });
});
