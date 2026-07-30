import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuditService } from '../audit/audit.service';
import { entities as ALL_ENTITIES } from '../database/data-source-options';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer die Marke-/Modell-Eingabehilfe (GET /vehicles/suggestions).
 *
 * Bewusst SERVICE-Ebene mit einer ECHTEN better-sqlite3-DataSource (kein Nest-
 * HTTP-Boot): das beweist die tatsaechliche SQL-Semantik (tenant-Filter,
 * GROUP BY, Soft-Delete) schnell und deterministisch. Jeder Test verwendet eine
 * EIGENE tenantId -> null geteilter Zustand, keine Reihenfolge-Abhaengigkeit.
 * Ein schlanker Controller-Unit-Test sichert zusaetzlich die Sicherheits-
 * verdrahtung (tenantId kommt aus dem JWT, nie aus dem Client).
 */

describe('VehiclesService.suggestions · echte SQLite-DataSource', () => {
  let ds: DataSource;
  let svc: VehiclesService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: ALL_ENTITIES,
    });
    await ds.initialize();
    svc = new VehiclesService(
      ds.getRepository(Vehicle),
      ds.getRepository(Order),
      ds.getRepository(Customer),
      audit,
    );
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  /** Legt Kunde + Fahrzeug in einem Tenant an (ueber die Entity-Hooks/Save). */
  async function anlegen(tenantId: string, make: string, model: string): Promise<Vehicle> {
    const kunde = await ds.getRepository(Customer).save(
      ds.getRepository(Customer).create({
        tenantId,
        firstName: 'K',
        lastName: 'unde',
        email: `${Math.random()}@x.de`,
      }),
    );
    return ds.getRepository(Vehicle).save(
      ds.getRepository(Vehicle).create({ tenantId, customerId: kunde.id, make, model }),
    );
  }

  it('liefert die eigenen Marken/Modelle, gaengigste zuerst (Haeufigkeit)', async () => {
    const T = 'tenant-freq';
    await anlegen(T, 'VW', 'Golf');
    await anlegen(T, 'VW', 'Golf');
    await anlegen(T, 'VW', 'Passat');
    await anlegen(T, 'BMW', 'X1');

    const res = await svc.suggestions(T);
    // VW (3x) vor BMW (1x).
    expect(res.makes).toEqual(['VW', 'BMW']);
    expect(res.models).toContainEqual({ make: 'VW', model: 'Golf' });
    expect(res.models).toContainEqual({ make: 'VW', model: 'Passat' });
    expect(res.models).toContainEqual({ make: 'BMW', model: 'X1' });
    // Golf (2x) steht vor Passat (1x).
    const golfIdx = res.models.findIndex((m) => m.model === 'Golf');
    const passatIdx = res.models.findIndex((m) => m.model === 'Passat');
    expect(golfIdx).toBeGreaterThanOrEqual(0);
    expect(golfIdx).toBeLessThan(passatIdx);
  });

  it('TENANT-ISOLATION: fremde Marken/Modelle erscheinen nie', async () => {
    const A = 'tenant-iso-a';
    const B = 'tenant-iso-b';
    await anlegen(A, 'Skoda', 'Octavia');
    await anlegen(B, 'Koenigsegg', 'Jesko');

    const alsA = await svc.suggestions(A);
    expect(alsA.makes).toEqual(['Skoda']);
    expect(alsA.makes).not.toContain('Koenigsegg');
    expect(alsA.models.some((m) => m.make === 'Koenigsegg')).toBe(false);

    const alsB = await svc.suggestions(B);
    expect(alsB.makes).toEqual(['Koenigsegg']);
    expect(alsB.makes).not.toContain('Skoda');
  });

  it('soft-geloeschte Fahrzeuge liefern keine Vorschlaege mehr', async () => {
    const T = 'tenant-soft';
    const opel = await anlegen(T, 'Opel', 'Corsa');
    expect((await svc.suggestions(T)).makes).toContain('Opel');

    await ds.getRepository(Vehicle).softRemove(opel);
    // War Corsa das einzige Opel-Fahrzeug, verschwindet die Marke wieder.
    const nachher = await svc.suggestions(T);
    expect(nachher.makes).not.toContain('Opel');
    expect(nachher.models.some((m) => m.make === 'Opel')).toBe(false);
  });

  it('FREITEXT ohne Listentreffer wird gespeichert und taucht als Vorschlag auf', async () => {
    const T = 'tenant-frei';
    const kunde = await ds.getRepository(Customer).save(
      ds.getRepository(Customer).create({ tenantId: T, firstName: 'Old', lastName: 'Timer', email: 'old@frei.de' }),
    );
    // Exotische Marke/Modell (Oldtimer) ueber den ECHTEN Create-Pfad des Service:
    // keine Validierung gegen eine Liste -> muss klaglos gespeichert werden.
    const user = { id: 'u', tenantId: T } as AuthUser;
    const saved = await svc.create(user, { customerId: kunde.id, make: 'Wartburg', model: '353' });
    expect(saved.id).toBeDefined();

    const res = await svc.suggestions(T);
    expect(res.makes).toContain('Wartburg');
    expect(res.models).toContainEqual({ make: 'Wartburg', model: '353' });
  });

  it('leerer Betrieb liefert leere Listen (kein Fehler)', async () => {
    const res = await svc.suggestions('tenant-leer');
    expect(res.makes).toEqual([]);
    expect(res.models).toEqual([]);
  });

  it('Deckelung: nie mehr als die Limits (Payload klein halten)', async () => {
    const res = await svc.suggestions('tenant-freq');
    expect(res.makes.length).toBeLessThanOrEqual(100);
    expect(res.models.length).toBeLessThanOrEqual(500);
  });
});

describe('VehiclesController.suggestions · Sicherheits-Verdrahtung', () => {
  it('reicht ausschliesslich die tenantId aus dem JWT an den Service durch', async () => {
    const svc = { suggestions: jest.fn().mockResolvedValue({ makes: [], models: [] }) };
    const controller = new VehiclesController(svc as unknown as VehiclesService, {} as never);

    // Der Client koennte im Body/Query eine fremde tenantId mitschicken – der
    // Controller darf NUR user.tenantId (aus dem JWT) verwenden.
    await controller.suggestions({ id: 'u1', tenantId: 'tenant-jwt' } as AuthUser);
    expect(svc.suggestions).toHaveBeenCalledWith('tenant-jwt');
    expect(svc.suggestions).toHaveBeenCalledTimes(1);
  });
});
