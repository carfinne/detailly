import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral } from 'typeorm';
import type { AddressInfo } from 'net';

import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesImportService } from './vehicles-import.service';
import { Vehicle } from './entities/vehicle.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { entities as ALL_ENTITIES } from '../database/data-source-options';

/**
 * ENDPOINT-Integrationstest fuer den umlautfesten Kennzeichen-Lookup
 * (GET /vehicles/lookup): echte better-sqlite3-DataSource + echter HTTP-
 * Roundtrip via fetch (kein supertest im Projekt, neue Pakete sind tabu).
 *
 * Warum kein Mock: Der Bug sass genau in der DB-Schicht — SQLites UPPER()
 * uppercased keine Umlaute, gespeicherte Kennzeichen mit kleinen Umlauten
 * ("lö-ab 123") traf der alte DB-seitige Vergleich nie. Nur eine echte
 * SQLite-DataSource beweist, dass der Spaltenweg (kennzeichenNormalisiert,
 * befuellt ueber die Entity-Hooks) das Problem loest.
 *
 * Auth: JwtAuthGuard wird durch einen Fake ersetzt, der req.user auf den
 * jeweils "eingeloggten" Test-Nutzer setzt (tenant-wechselbar fuer den
 * Isolations-Test). Subscription-/Rollen-Guard: durchwinken (hier nicht Thema).
 */

const T1 = 'tenant-1';
const T2 = 'tenant-2';

describe('GET /vehicles/lookup · Endpoint-Integration (echte SQLite-DataSource)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let svc: VehiclesService;
  // Der Fake-Guard liest diesen Nutzer bei jedem Request (Tenant umschaltbar).
  let aktuellerUser: { id: string; email: string; role: string; tenantId: string };

  const repo = <T extends ObjectLiteral>(e: { new (): T }) =>
    app.get(DataSource).getRepository<T>(e);

  beforeAll(async () => {
    aktuellerUser = { id: 'u1', email: 'chef@t1.de', role: 'owner', tenantId: T1 };

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          entities: ALL_ENTITIES,
        }),
        TypeOrmModule.forFeature([Vehicle, Order, Customer]),
      ],
      controllers: [VehiclesController],
      providers: [
        VehiclesService,
        VehiclesImportService,
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: import('@nestjs/common').ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = aktuellerUser;
          return true;
        },
      })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    // Gleiche Pipe-Konfiguration wie main.ts — beweist nebenbei, dass Clients
    // kennzeichenNormalisiert nicht selbst setzen koennen (forbidNonWhitelisted).
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    svc = app.get(VehiclesService);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function lookup(kennzeichen: string): Promise<any> {
    const res = await fetch(
      `${baseUrl}/vehicles/lookup?kennzeichen=${encodeURIComponent(kennzeichen)}`,
    );
    expect(res.status).toBe(200);
    return res.json();
  }

  async function post(pfad: string, body: unknown): Promise<Response> {
    return fetch(baseUrl + pfad, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('findet ein mit kleinen Umlauten angelegtes Kennzeichen ueber den Endpoint (LÖ)', async () => {
    const kunde = await repo(Customer).save(
      repo(Customer).create({ tenantId: T1, firstName: 'Lisa', lastName: 'Lörrach', email: 'lisa@t1.de' }),
    );
    // Anlage wie in der Schnellerfassung getippt: klein + Umlaut. Der alte
    // DB-seitige UPPER()-Vergleich fand genau diese Zeile nie (SQLite laesst
    // 'ö' klein); jetzt fuellt der BeforeInsert-Hook kennzeichenNormalisiert.
    const anlage = await post('/vehicles', {
      customerId: kunde.id,
      make: 'VW',
      model: 'Golf',
      licensePlate: 'lö-ab 123',
    });
    expect(anlage.status).toBe(201);

    for (const eingabe of ['LÖ-AB 123', 'lö-ab 123', 'löab123', 'LÖ AB-123']) {
      const res = await lookup(eingabe);
      expect(res.found).toBe(true);
      expect(res.vehicle?.licensePlate).toBe('lö-ab 123');
      expect(res.customer?.id).toBe(kunde.id);
    }
  });

  it('findet weitere Umlaut-Staedtekuerzel (MÜ, SÜW) — Hook-Pfad ueber repo.save', async () => {
    const kunde = await repo(Customer).save(
      repo(Customer).create({ tenantId: T1, firstName: 'Max', lastName: 'Müller', email: 'max@t1.de' }),
    );
    await repo(Vehicle).save(
      repo(Vehicle).create({ tenantId: T1, customerId: kunde.id, make: 'BMW', model: 'X1', licensePlate: 'Mü-C 45' }),
    );
    await repo(Vehicle).save(
      repo(Vehicle).create({ tenantId: T1, customerId: kunde.id, make: 'Audi', model: 'A3', licensePlate: 'süw-de 6' }),
    );

    expect((await lookup('MÜ-C 45')).found).toBe(true);
    expect((await lookup('mü c 45')).found).toBe(true);
    expect((await lookup('SÜW-DE 6')).found).toBe(true);
    expect((await lookup('süw de-6')).found).toBe(true);
  });

  it('TENANT-ISOLATION bleibt erhalten: fremdes Umlaut-Kennzeichen liefert found=false', async () => {
    const kundeT2 = await repo(Customer).save(
      repo(Customer).create({ tenantId: T2, firstName: 'Fremd', lastName: 'Betrieb', email: 'chef@t2.de' }),
    );
    await repo(Vehicle).save(
      repo(Vehicle).create({ tenantId: T2, customerId: kundeT2.id, make: 'Tesla', model: '3', licensePlate: 'lö-zz 777' }),
    );

    // T1 sucht das T2-Kennzeichen -> kein Treffer, kein Leak.
    const fremd = await lookup('LÖ-ZZ 777');
    expect(fremd.found).toBe(false);
    expect(fremd.vehicle).toBeNull();

    // Gegenprobe: als T2 eingeloggt wird es gefunden.
    aktuellerUser = { id: 'u2', email: 'chef@t2.de', role: 'owner', tenantId: T2 };
    try {
      const eigen = await lookup('LÖ-ZZ 777');
      expect(eigen.found).toBe(true);
      expect(eigen.vehicle?.licensePlate).toBe('lö-zz 777');
    } finally {
      aktuellerUser = { id: 'u1', email: 'chef@t1.de', role: 'owner', tenantId: T1 };
    }
  });

  it('Update pflegt die Normalform nach (BeforeUpdate-Hook)', async () => {
    const kunde = await repo(Customer).save(
      repo(Customer).create({ tenantId: T1, firstName: 'Nina', lastName: 'Neu', email: 'nina@t1.de' }),
    );
    const anlage = await post('/vehicles', {
      customerId: kunde.id,
      make: 'Skoda',
      model: 'Octavia',
      licensePlate: 'B-XX 1',
    });
    expect(anlage.status).toBe(201);
    const { id } = await anlage.json();

    const update = await fetch(`${baseUrl}/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ licensePlate: 'ö-neu 9' }),
    });
    expect(update.status).toBe(200);

    expect((await lookup('Ö-NEU 9')).found).toBe(true);
    // Das alte Kennzeichen ist nach dem Update nicht mehr auffindbar.
    expect((await lookup('B-XX 1')).found).toBe(false);
  });

  it('Boot-Backfill zieht Bestandszeilen ohne Normalform nach (insert am Hook vorbei)', async () => {
    const kunde = await repo(Customer).save(
      repo(Customer).create({ tenantId: T1, firstName: 'Alt', lastName: 'Bestand', email: 'alt@t1.de' }),
    );
    // .insert() umgeht BeforeInsert (wie Alt-/Loadtest-Daten vor der Spalte):
    // die Zeile liegt mit kennzeichenNormalisiert = NULL in der DB.
    await repo(Vehicle).insert({
      tenantId: T1,
      customerId: kunde.id,
      make: 'Opel',
      model: 'Corsa',
      licensePlate: 'Lö-ALT 1',
    });
    expect((await lookup('LÖ-ALT 1')).found).toBe(false);

    // Boot-Backfill (laeuft normal via onModuleInit) idempotent nachziehen.
    await svc.onModuleInit();
    expect((await lookup('LÖ-ALT 1')).found).toBe(true);
  });

  it('Clients koennen kennzeichenNormalisiert nicht selbst setzen (forbidNonWhitelisted -> 400)', async () => {
    const res = await post('/vehicles', {
      customerId: '00000000-0000-4000-8000-000000000000',
      make: 'Hack',
      model: 'Versuch',
      licensePlate: 'B-HA 1',
      kennzeichenNormalisiert: 'MANIPULIERT',
    });
    expect(res.status).toBe(400);
  });
});
