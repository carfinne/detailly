import { NotFoundException } from '@nestjs/common';
import {
  buildInspektionUebernahme,
  schadenBeschreibung,
} from './inspektion-uebernahme';
import { InspectionService } from './inspection.service';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Welle 2-A: Bruecke Inspektion -> Auftrag ("Als Auftrag uebernehmen").
 * Zwei Ebenen:
 *  1. Reine Abbildung (buildInspektionUebernahme/schadenBeschreibung): Positionen
 *     aus der Schadensliste, fehlende kostenSchaetzung -> 0, Kunde/Fahrzeug.
 *  2. Service (buildAuftragUebernahme): tenant-Isolation (fremde Inspektion -> 404)
 *     und READ-ONLY (keine stille Doppelanlage – es wird NICHTS gespeichert).
 */
describe('Inspektion -> Auftrag: reine Abbildung', () => {
  it('erzeugt je Schaden EINE Position (Menge 1) mit Beschreibung aus Bauteil + Art', () => {
    const res = buildInspektionUebernahme(
      { customerId: 'c1', vehicleId: 'v1' },
      [
        { partLabel: 'Kotflügel vorne links', art: 'kratzer', kostenSchaetzung: '120.00' },
        { partLabel: 'Stoßfänger hinten', art: 'delle', kostenSchaetzung: '80' },
      ],
    );

    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toEqual({
      beschreibung: 'Kotflügel vorne links — Kratzer',
      menge: 1,
      einzelpreis: 120,
      preisFehlt: false,
    });
    expect(res.items[1].beschreibung).toBe('Stoßfänger hinten — Delle');
    expect(res.items[1].einzelpreis).toBe(80);
    expect(res.preiseUnvollstaendig).toBe(false);
  });

  it('setzt Einzelpreis 0 + preisFehlt, wenn keine kostenSchaetzung gepflegt ist (nichts erfinden)', () => {
    const res = buildInspektionUebernahme({ customerId: 'c1' }, [
      { partLabel: 'Tür vorne rechts', art: 'lackschaden', kostenSchaetzung: null },
      { partLabel: 'Dach', art: 'steinschlag' /* kostenSchaetzung undefined */ },
      { partLabel: 'Motorhaube', art: 'delle', kostenSchaetzung: '' },
    ]);

    for (const it of res.items) {
      expect(it.einzelpreis).toBe(0);
      expect(it.preisFehlt).toBe(true);
    }
    // Mindestens ein fehlender Preis -> Gesamt-Flag fuer den UI-Hinweis.
    expect(res.preiseUnvollstaendig).toBe(true);
  });

  it('negative/ungueltige kostenSchaetzung faellt sicher auf 0 (preisFehlt) zurueck', () => {
    const res = buildInspektionUebernahme({ customerId: 'c1' }, [
      { partLabel: 'Schweller', art: 'rost', kostenSchaetzung: -5 },
      { partLabel: 'Spiegel', art: 'bruch', kostenSchaetzung: 'abc' },
    ]);
    expect(res.items.every((it) => it.einzelpreis === 0 && it.preisFehlt)).toBe(true);
  });

  it('uebernimmt Kunde + Fahrzeug aus der Inspektion; serviceType-Default = aufbereitung', () => {
    const res = buildInspektionUebernahme({ customerId: 'c-42', vehicleId: 'v-7' }, []);
    expect(res.customerId).toBe('c-42');
    expect(res.vehicleId).toBe('v-7');
    expect(res.serviceType).toBe('aufbereitung');
    expect(res.items).toEqual([]);
    // Ohne Positionen ist auch nichts unvollstaendig.
    expect(res.preiseUnvollstaendig).toBe(false);
  });

  it('vehicleId ohne Fahrzeug an der Inspektion wird null (nicht undefined)', () => {
    const res = buildInspektionUebernahme({ customerId: 'c1' }, []);
    expect(res.vehicleId).toBeNull();
  });

  it('schadenBeschreibung haengt die Notiz in Klammern an und faellt auf Rohwerte zurueck', () => {
    expect(
      schadenBeschreibung({ partLabel: 'Kotflügel vorne links', art: 'kratzer', notiz: 'Streifer 20 cm' }),
    ).toBe('Kotflügel vorne links — Kratzer (Streifer 20 cm)');
    // Ohne partLabel -> partId; unbekannte Art -> Rohwert; leere Notiz ignoriert.
    expect(schadenBeschreibung({ partId: 'tuer_vl', art: 'sonderart', notiz: '  ' })).toBe(
      'tuer_vl — sonderart',
    );
    // Ganz ohne Angaben bleibt eine sinnvolle Zeile.
    expect(schadenBeschreibung({})).toBe('Fahrzeug — Schaden');
  });
});

describe('InspectionService.buildAuftragUebernahme – Tenant-Isolation & Read-only', () => {
  const user: AuthUser = { id: 'u1', email: 'a@b.de', role: UserRole.MANAGER, tenantId: 't1' };
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  function makeService(overrides: { inspectionFindOne?: any; items?: any[] } = {}) {
    const inspectionRepo: any = {
      findOne: jest.fn().mockResolvedValue(overrides.inspectionFindOne ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const itemRepo: any = {
      find: jest.fn().mockResolvedValue(overrides.items ?? []),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const stub = () => ({
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    });
    const photoRepo: any = stub();
    const itemPhotoRepo: any = stub();
    const customerRepo: any = stub();
    const vehicleRepo: any = stub();
    const orderRepo: any = stub();
    const svc = new InspectionService(
      inspectionRepo,
      itemRepo,
      photoRepo,
      itemPhotoRepo,
      customerRepo,
      vehicleRepo,
      orderRepo,
      audit,
    );
    return { svc, inspectionRepo, itemRepo, orderRepo };
  }

  beforeEach(() => jest.clearAllMocks());

  it('fremde/nicht existierende Inspektion -> 404 (findOneScoped scoped auf tenantId)', async () => {
    const { svc, inspectionRepo, itemRepo } = makeService({ inspectionFindOne: null });
    await expect(svc.buildAuftragUebernahme(user, 'fremd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Lookup war strikt tenant-scoped.
    expect(inspectionRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'fremd', tenantId: 't1' },
    });
    // Bei Fremd-Treffer werden gar keine Schaeden geladen.
    expect(itemRepo.find).not.toHaveBeenCalled();
  });

  it('laedt Schaeden tenant-scoped und liefert Kunde/Fahrzeug + Positionen', async () => {
    const { svc, itemRepo } = makeService({
      inspectionFindOne: { id: 'insp1', tenantId: 't1', customerId: 'c1', vehicleId: 'v1' },
      items: [{ partLabel: 'Dach', art: 'delle', kostenSchaetzung: '50.00' }],
    });
    const res = await svc.buildAuftragUebernahme(user, 'insp1');

    expect(itemRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', inspectionId: 'insp1' },
      order: { createdAt: 'ASC' },
    });
    expect(res.customerId).toBe('c1');
    expect(res.vehicleId).toBe('v1');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].einzelpreis).toBe(50);
  });

  it('READ-ONLY: legt keinen Auftrag an und speichert nichts (keine Doppelanlage)', async () => {
    const { svc, inspectionRepo, itemRepo, orderRepo } = makeService({
      inspectionFindOne: { id: 'insp1', tenantId: 't1', customerId: 'c1', vehicleId: null },
      items: [{ partLabel: 'Tür', art: 'kratzer', kostenSchaetzung: null }],
    });
    // Mehrfacher Aufruf (Doppelklick-Analogon) darf nichts anlegen.
    await svc.buildAuftragUebernahme(user, 'insp1');
    await svc.buildAuftragUebernahme(user, 'insp1');

    expect(orderRepo.create).not.toHaveBeenCalled();
    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(inspectionRepo.save).not.toHaveBeenCalled();
    expect(itemRepo.save).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });
});
