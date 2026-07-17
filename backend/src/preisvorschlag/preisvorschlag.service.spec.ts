import { PreisvorschlagService } from './preisvorschlag.service';
import { OrderItemType } from '../orders/entities/order-item.entity';
import { ServiceType } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Tests fuer den Preisvorschlag-Service.
 *
 * Konform zur DB-freien Jest-Konfiguration (kein DataSource/better-sqlite3):
 * Das Repository wird durch einen QueryBuilder-Mock ersetzt, der die per
 * `where/andWhere` gesetzten Parameter aufzeichnet und die Fixture GENAU nach
 * diesen Parametern filtert. Dadurch ist der Mandanten-Isolationstest echt:
 * Liesse der Service den `tenantId`-Filter weg, saehe Betrieb A die Preise von
 * Betrieb B – und der Test wuerde fehlschlagen.
 *
 * Der `serviceType`-Filter ist OPTIONAL: der Mock filtert nur danach, wenn der
 * Service den Parameter tatsaechlich gesetzt hat (gueltiges Gewerk).
 */

interface FakeItem {
  tenantId: string;
  serviceType: ServiceType;
  typ: OrderItemType;
  beschreibung: string;
  einzelpreis: number;
  createdAt: number; // ms – juengste zuerst nach DESC-Sortierung
}

function makeService(fixture: FakeItem[]) {
  const erfassteParams: Record<string, unknown> = {};

  const qb: any = {
    innerJoin: () => qb,
    where: (_cond: string, p?: Record<string, unknown>) => {
      Object.assign(erfassteParams, p ?? {});
      return qb;
    },
    andWhere: (_cond: string, p?: Record<string, unknown>) => {
      Object.assign(erfassteParams, p ?? {});
      return qb;
    },
    select: () => qb,
    addSelect: () => qb,
    orderBy: () => qb,
    limit: () => qb,
    getRawMany: async () => {
      const worte = Object.keys(erfassteParams)
        .filter((k) => /^w\d+$/.test(k))
        .map((k) => String(erfassteParams[k]).replace(/%/g, ''));

      // serviceType nur beruecksichtigen, wenn der Service ihn gesetzt hat (optional).
      const hatServiceType = 'serviceType' in erfassteParams;

      return fixture
        .filter(
          (it) =>
            it.tenantId === erfassteParams.tenantId &&
            (!hatServiceType || it.serviceType === erfassteParams.serviceType) &&
            it.typ === erfassteParams.typ &&
            it.einzelpreis > 0 &&
            worte.every((w) => it.beschreibung.toLowerCase().includes(w)),
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((it) => ({ einzelpreis: it.einzelpreis }));
    },
  };

  const itemRepo: any = { createQueryBuilder: jest.fn(() => qb) };
  const service = new PreisvorschlagService(itemRepo);
  return { service, erfassteParams, itemRepo };
}

const userA: AuthUser = { id: 'uA', email: 'a@a.de', role: UserRole.MANAGER, tenantId: 'betrieb-A' };
const userB: AuthUser = { id: 'uB', email: 'b@b.de', role: UserRole.MANAGER, tenantId: 'betrieb-B' };

const L = OrderItemType.LEISTUNG;
const M = OrderItemType.MATERIAL;
const AUF = ServiceType.AUFBEREITUNG;
const FOL = ServiceType.FOLIERUNG;

const FIXTURE: FakeItem[] = [
  // Betrieb A – "Politur", Aufbereitung. Juengster (t=30) = 130.
  { tenantId: 'betrieb-A', serviceType: AUF, typ: L, beschreibung: 'Lackpolitur Stufe 2', einzelpreis: 100, createdAt: 10 },
  { tenantId: 'betrieb-A', serviceType: AUF, typ: L, beschreibung: 'Lackpolitur komplett', einzelpreis: 120, createdAt: 20 },
  { tenantId: 'betrieb-A', serviceType: AUF, typ: L, beschreibung: 'Politur Frontpartie', einzelpreis: 130, createdAt: 30 },
  // Betrieb A – anderes Gewerk / Material / Nullpreis (duerfen NICHT einfliessen bei AUF-Filter).
  { tenantId: 'betrieb-A', serviceType: FOL, typ: L, beschreibung: 'Politur nach Folierung', einzelpreis: 999, createdAt: 40 },
  { tenantId: 'betrieb-A', serviceType: AUF, typ: M, beschreibung: 'Politur-Paste', einzelpreis: 777, createdAt: 41 },
  { tenantId: 'betrieb-A', serviceType: AUF, typ: L, beschreibung: 'Politur Kulanz', einzelpreis: 0, createdAt: 42 },
  // Betrieb B – "Politur", Aufbereitung, voellig andere Preise.
  { tenantId: 'betrieb-B', serviceType: AUF, typ: L, beschreibung: 'Lackpolitur', einzelpreis: 500, createdAt: 15 },
  { tenantId: 'betrieb-B', serviceType: AUF, typ: L, beschreibung: 'Politur premium', einzelpreis: 600, createdAt: 25 },
];

describe('PreisvorschlagService', () => {
  describe('Mandantentrennung (Isolation)', () => {
    it('Betrieb A sieht NUR eigene Preise – nie die von Betrieb B', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Politur', 'aufbereitung');

      expect(res.treffer).toBe(3); // nur A-Leistungen, Aufbereitung, Preis > 0
      expect(res.median).toBe(120); // Median von [100,120,130]
      expect(res.letzterPreis).toBe(130); // juengster Treffer (createdAt 30)
      // Kein einziger Fremd-Preis darf durchschlagen:
      expect(res.median).not.toBe(550);
      expect(res.letzterPreis).not.toBe(500);
      expect(res.letzterPreis).not.toBe(600);
    });

    it('Betrieb B sieht seine eigenen Preise (spiegelbildlich)', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userB, 'Politur', 'aufbereitung');

      expect(res.treffer).toBe(2);
      expect(res.median).toBe(550); // Median von [500,600]
      expect(res.letzterPreis).toBe(600); // juengster Treffer (createdAt 25)
    });

    it('setzt den tenantId-Filter immer aus dem Nutzer (nicht aus dem Client)', async () => {
      const { service, erfassteParams } = makeService(FIXTURE);
      await service.ermittleVorschlag(userA, 'Politur', 'aufbereitung');
      expect(erfassteParams.tenantId).toBe('betrieb-A');
    });
  });

  describe('Aggregation & Filter', () => {
    it('unbekannte Leistung -> kein Vorschlag (treffer 0, Zahlen null)', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Raketenstart Mondlandung', 'aufbereitung');
      expect(res).toEqual({ median: null, letzterPreis: null, treffer: 0 });
    });

    it('serviceType filtert das Gewerk (Folierung trennt sauber)', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Politur', 'folierung');
      // In Folierung existiert bei A genau eine Politur-Position (999).
      expect(res.treffer).toBe(1);
      expect(res.letzterPreis).toBe(999);
      expect(res.median).toBe(999);
    });

    it('serviceType ist OPTIONAL: ohne Gewerk gewerkeuebergreifend, aber weiter tenant-isoliert', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Politur', '');
      // A: 100,120,130 (Aufbereitung) + 999 (Folierung) – Material/Nullpreis raus, B raus.
      expect(res.treffer).toBe(4);
      expect(res.median).toBe(125); // Median von [100,120,130,999]
      expect(res.letzterPreis).toBe(999); // juengster Treffer (createdAt 40)
    });

    it('unbekanntes/ungueltiges Gewerk verhaelt sich wie "ohne Gewerk" (kein Filter)', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Politur', 'phantasie-gewerk');
      expect(res.treffer).toBe(4);
    });

    it('ignoriert Material-Positionen und Nullpreise', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Politur', 'aufbereitung');
      // 777 (Material) und 0 (Kulanz) sind draussen -> weiterhin 3 Treffer.
      expect(res.treffer).toBe(3);
    });

    it('leere Beschreibung -> kein Vorschlag, ohne DB-Zugriff', async () => {
      const { service, itemRepo } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, '   ', 'aufbereitung');
      expect(res).toEqual({ median: null, letzterPreis: null, treffer: 0 });
      expect(itemRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('mehrere Suchwoerter muessen ALLE vorkommen (AND)', async () => {
      const { service } = makeService(FIXTURE);
      const res = await service.ermittleVorschlag(userA, 'Lackpolitur komplett', 'aufbereitung');
      // Nur "Lackpolitur komplett" (120) enthaelt beide Woerter.
      expect(res.treffer).toBe(1);
      expect(res.median).toBe(120);
    });
  });
});
