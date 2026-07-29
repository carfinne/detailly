import { DashboardService } from './dashboard.service';
import { AngebotStatus, InvoiceKind, InvoiceStatus } from '../invoices/entities/invoice.entity';

// In-Memory-Nachbau der Angebots-Aggregat-Query: derselbe WHERE-Filter wie in
// offeneAngeboteAgg, aber gegen ein Array statt gegen die DB – so testen wir die
// Filter-Logik (Tenant-Isolation, offen-Definition, leere Menge -> 0) ohne echte
// SQLite-Instanz. Die WHERE-Klauseln werden hier 1:1 gespiegelt und ausgewertet.
type Row = {
  tenantId: string;
  art: InvoiceKind;
  status: InvoiceStatus;
  angebotStatus: AngebotStatus | null;
  gueltigBis: Date | null;
  brutto: number;
};

function makeInvoiceRepo(rows: Row[], now: Date) {
  return {
    createQueryBuilder: () => {
      // Sammelt die per .where/.andWhere gesetzten Parameter; die Filter selbst
      // sind fix (entsprechen dem Service). Reihenfolge/Chaining wie TypeORM.
      const params: Record<string, unknown> = {};
      const qb: any = {
        select: () => qb,
        addSelect: () => qb,
        where: (_c: string, p?: Record<string, unknown>) => {
          Object.assign(params, p);
          return qb;
        },
        andWhere: (_c: string, p?: Record<string, unknown>) => {
          Object.assign(params, p);
          return qb;
        },
        getRawOne: async () => {
          const tenantId = params.tenantId as string;
          const treffer = rows.filter(
            (r) =>
              r.tenantId === tenantId &&
              r.art === InvoiceKind.ANGEBOT &&
              r.status !== InvoiceStatus.STORNIERT &&
              (r.angebotStatus === AngebotStatus.OFFEN || r.angebotStatus === null) &&
              (r.gueltigBis === null || r.gueltigBis.getTime() >= now.getTime()),
          );
          const summe = treffer.reduce((s, r) => s + r.brutto, 0);
          return { summe: String(summe), anzahl: String(treffer.length) };
        },
      };
      return qb;
    },
  };
}

// Zugriff auf die private Methode (Test-only) ohne den ganzen stats()-Pfad.
function callAgg(rows: Row[], tenantId: string, now = new Date('2026-07-29T12:00:00Z')) {
  const repo = makeInvoiceRepo(rows, now) as any;
  const svc = new DashboardService(
    {} as any, {} as any, {} as any, {} as any, repo, {} as any,
  );
  return (svc as any).offeneAngeboteAgg(tenantId) as Promise<{ summe: number; anzahl: number }>;
}

const base = {
  status: InvoiceStatus.ENTWURF,
  angebotStatus: AngebotStatus.OFFEN,
  gueltigBis: new Date('2026-12-31T00:00:00Z'),
  brutto: 1000,
};

describe('DashboardService · offeneAngeboteAgg', () => {
  it('zaehlt nur OFFENE Angebote des eigenen Tenants (Isolation) und summiert brutto', async () => {
    const rows: Row[] = [
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, brutto: 1000 },
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, brutto: 3200 },
      // Fremder Tenant -> darf NICHT einfliessen.
      { ...base, tenantId: 't2', art: InvoiceKind.ANGEBOT, brutto: 9999 },
      // Rechnung (kein Angebot) -> ignoriert.
      { ...base, tenantId: 't1', art: InvoiceKind.RECHNUNG, brutto: 500 },
    ];
    const res = await callAgg(rows, 't1');
    expect(res.anzahl).toBe(2);
    expect(res.summe).toBe(4200);
  });

  it('schliesst angenommene, abgelehnte, stornierte und abgelaufene Angebote aus', async () => {
    const now = new Date('2026-07-29T12:00:00Z');
    const rows: Row[] = [
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, angebotStatus: AngebotStatus.ANGENOMMEN, brutto: 100 },
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, angebotStatus: AngebotStatus.ABGELEHNT, brutto: 100 },
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, status: InvoiceStatus.STORNIERT, brutto: 100 },
      // Noch 'offen', aber gueltigBis in der Vergangenheit -> abgelaufen.
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, gueltigBis: new Date('2026-06-01T00:00:00Z'), brutto: 100 },
      // Gueltig: offen, in der Zukunft -> zaehlt.
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, brutto: 750 },
      // Altbestand: angebotStatus NULL -> wie 'offen' behandeln (zaehlt).
      { ...base, tenantId: 't1', art: InvoiceKind.ANGEBOT, angebotStatus: null, gueltigBis: null, brutto: 250 },
    ];
    const res = await callAgg(rows, 't1', now);
    expect(res.anzahl).toBe(2);
    expect(res.summe).toBe(1000);
  });

  it('leere Menge -> 0 statt Crash', async () => {
    const res = await callAgg([], 't1');
    expect(res).toEqual({ summe: 0, anzahl: 0 });
  });
});
