import { InvoicesService } from './invoices.service';
import { InvoiceItemDto } from './dto/invoice.dto';

/**
 * Tests fuer die geschaeftskritische Rechnungs-Rundung (MWSt 19%).
 *
 * `buildItems` und `totals` sind private Methoden, deren Mathe aber rein ist
 * (kein DB-Zugriff). Wir instanziieren den Service mit gemockten Deps:
 *   - `itemRepo.create` als Identity-Funktion (TypeORM erzeugt sonst eine Entity-
 *     Instanz; fuer die Rundung reicht das Plain-Objekt mit den gleichen Feldern).
 *   - alle uebrigen 7 Deps als leere Platzhalter ({}), da buildItems/totals sie
 *     nicht beruehren.
 * Es wird KEINE DataSource/DB gebootet (invoices.service importiert nur Entities
 * + Typen, keinen nativen Treiber).
 */
describe('InvoicesService Rundung (buildItems / totals)', () => {
  // itemRepo.create gibt sein Argument 1:1 zurueck -> Zeilenobjekt mit gesamtpreis.
  const itemRepo = { create: (x: any) => x } as any;

  const svc = new InvoicesService(
    {} as any, // repo (Invoice)
    itemRepo, // itemRepo (InvoiceItem) - einzige genutzte Dep
    {} as any, // orderRepo
    {} as any, // customerRepo
    {} as any, // tenantRepo
    {} as any, // audit
    {} as any, // sevdesk
    {} as any, // pdf
    {} as any, // mail
  );

  const buildItems = (items: InvoiceItemDto[]): any[] => (svc as any).buildItems(items);
  const totals = (items: any[], satz?: number): { netto: number; mwst: number; brutto: number } =>
    (svc as any).totals(items, satz);

  describe('buildItems - Zeilensumme kaufmaennisch auf Cent', () => {
    it('menge x einzelpreis wird auf 2 Nachkommastellen gerundet', () => {
      const [item] = buildItems([{ beschreibung: 'Politur', menge: 3, einzelpreis: 9.999 }]);
      // 3 * 9.999 = 29.997 -> kaufmaennisch 30.00
      expect(item.gesamtpreis).toBe(30);
    });

    it('uebernimmt beschreibung/menge/einzelpreis unveraendert', () => {
      const [item] = buildItems([{ beschreibung: 'Wäsche', menge: 2, einzelpreis: 12.5 }]);
      expect(item.beschreibung).toBe('Wäsche');
      expect(item.menge).toBe(2);
      expect(item.einzelpreis).toBe(12.5);
      expect(item.gesamtpreis).toBe(25);
    });

    it('rundet krumme Float-Produkte korrekt (0.1 * 0.2)', () => {
      const [item] = buildItems([{ beschreibung: 'Mini', menge: 0.1, einzelpreis: 0.2 }]);
      // 0.1 * 0.2 = 0.020000000000000004 (Float) -> gerundet 0.02
      expect(item.gesamtpreis).toBe(0.02);
    });
  });

  describe('totals - netto / mwst / brutto', () => {
    it('einzelne Position: netto = Zeilensumme, mwst = 19%, brutto = netto + mwst', () => {
      const items = buildItems([{ beschreibung: 'A', menge: 1, einzelpreis: 100 }]);
      const t = totals(items);
      expect(t.netto).toBe(100);
      expect(t.mwst).toBe(19); // round(100 * 0.19 * 100)/100
      expect(t.brutto).toBe(119);
    });

    it('mehrere Positionen: netto = Summe der (bereits gerundeten) Zeilensummen', () => {
      const items = buildItems([
        { beschreibung: 'A', menge: 2, einzelpreis: 10 }, // 20.00
        { beschreibung: 'B', menge: 1, einzelpreis: 5.55 }, // 5.55
      ]);
      const t = totals(items);
      expect(t.netto).toBeCloseTo(25.55, 10);
      expect(t.mwst).toBe(4.85); // round(25.55 * 0.19 * 100)/100 = round(4.8545) = 4.85
      expect(t.brutto).toBe(30.4); // round((25.55 + 4.85) * 100)/100
    });

    it('Invariante: round((netto + mwst) * 100)/100 === brutto (cent-genau)', () => {
      const items = buildItems([
        { beschreibung: 'A', menge: 3, einzelpreis: 9.99 },
        { beschreibung: 'B', menge: 7, einzelpreis: 1.49 },
        { beschreibung: 'C', menge: 1, einzelpreis: 0.01 },
      ]);
      const t = totals(items);
      expect(Math.round((t.netto + t.mwst) * 100) / 100).toBe(t.brutto);
    });

    it('leere Positionsliste -> 0 / 0 / 0', () => {
      const t = totals([]);
      expect(t).toEqual({ netto: 0, mwst: 0, brutto: 0 });
    });

    it('ohne Satz-Argument -> Default 19 %', () => {
      const items = buildItems([{ beschreibung: 'A', menge: 1, einzelpreis: 100 }]);
      expect(totals(items).mwst).toBe(19);
    });
  });

  describe('totals - variabler MwSt-Satz', () => {
    it('7 %: netto 100 -> mwst 7.00, brutto 107.00', () => {
      const items = buildItems([{ beschreibung: 'A', menge: 1, einzelpreis: 100 }]);
      const t = totals(items, 7);
      expect(t.netto).toBe(100);
      expect(t.mwst).toBe(7);
      expect(t.brutto).toBe(107);
    });

    it('0 %: keine MwSt (Kleinunternehmer §19) -> mwst 0, brutto = netto', () => {
      const items = buildItems([{ beschreibung: 'A', menge: 1, einzelpreis: 100 }]);
      const t = totals(items, 0);
      expect(t.mwst).toBe(0);
      expect(t.brutto).toBe(100);
    });

    it('7 % cent-genau gerundet: netto 25.55 -> mwst 1.79', () => {
      const items = buildItems([
        { beschreibung: 'A', menge: 2, einzelpreis: 10 }, // 20.00
        { beschreibung: 'B', menge: 1, einzelpreis: 5.55 }, // 5.55
      ]);
      const t = totals(items, 7);
      expect(t.netto).toBeCloseTo(25.55, 10);
      expect(t.mwst).toBe(1.79); // round(25.55 * 0.07 * 100)/100 = round(1.7885) -> 1.79
      expect(t.brutto).toBe(27.34);
    });

    it('Invariante haelt fuer jeden Satz: round((netto+mwst)*100)/100 === brutto', () => {
      const items = buildItems([
        { beschreibung: 'A', menge: 3, einzelpreis: 9.99 },
        { beschreibung: 'B', menge: 7, einzelpreis: 1.49 },
      ]);
      for (const satz of [0, 7, 19]) {
        const t = totals(items, satz);
        expect(Math.round((t.netto + t.mwst) * 100) / 100).toBe(t.brutto);
      }
    });

    it('dokumentiert Ist-Verhalten: brutto bleibt cent-genau auch bei vielen Positionen', () => {
      // 12 Positionen je 0.10 -> jede Zeilensumme exakt 0.10, netto-Summe = 1.20
      const items = buildItems(
        Array.from({ length: 12 }, (_, n) => ({
          beschreibung: `P${n}`,
          menge: 1,
          einzelpreis: 0.1,
        })),
      );
      const t = totals(items);
      expect(t.netto).toBeCloseTo(1.2, 10);
      expect(t.brutto).toBe(1.43); // round(1.2 * 1.19 * ...) -> 1.20 + round(0.228)=0.23 = 1.43
    });
  });
});
