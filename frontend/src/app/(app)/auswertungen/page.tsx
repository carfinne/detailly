'use client';

// Schlanke betriebswirtschaftliche Auswertung (Berichte). Zeitraum-Filter +
// KPIs + Umsatz nach Leistungsart + Top-Kunden. Leitung-only (Backend gated).

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { SERVICE_TYPE_LABEL } from '@/lib/labels';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty } from '@/components/ui';

interface Overview {
  auftragsvolumen: number;
  anzahlAuftraege: number;
  schnittAuftragswert: number;
  umsatzBezahlt: number;
  nachLeistungsart: { serviceType: string; summe: number; anzahl: number }[];
  topKunden: { name: string; summe: number; anzahl: number }[];
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AuswertungenPage() {
  const [von, setVon] = useState(iso(new Date(new Date().getFullYear(), 0, 1)));
  const [bis, setBis] = useState(iso(new Date()));
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<Overview>(`/reports/overview?von=${von}&bis=${bis}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auswertung konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [von, bis]);

  useEffect(() => {
    void load();
  }, [load]);

  const leistungMax = data ? Math.max(1, ...data.nachLeistungsart.map((l) => l.summe)) : 1;
  const kundenMax = data ? Math.max(1, ...data.topKunden.map((k) => k.summe)) : 1;

  return (
    <div>
      <PageHeader title="Auswertungen" subtitle="Volumen, Umsatz, Leistungsmix und Top-Kunden im Zeitraum." />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="label" htmlFor="von">Von</label>
          <input id="von" type="date" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bis">Bis</label>
          <input id="bis" type="date" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Auftragsvolumen" value={eur(data.auftragsvolumen)} />
            <Kpi label="Aufträge" value={String(data.anzahlAuftraege)} />
            <Kpi label="⌀ Auftragswert" value={eur(data.schnittAuftragswert)} />
            <Kpi label="Bezahlter Umsatz" value={eur(data.umsatzBezahlt)} accent />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Umsatz nach Leistungsart" subtitle="Auftragsvolumen im Zeitraum">
              {data.nachLeistungsart.length === 0 ? (
                <Empty text="Keine Aufträge im Zeitraum." />
              ) : (
                <ul className="space-y-3">
                  {data.nachLeistungsart.map((l) => {
                    const pct = data.auftragsvolumen > 0 ? Math.round((l.summe / data.auftragsvolumen) * 100) : 0;
                    return (
                      <li key={l.serviceType}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-chrome-100">
                            {SERVICE_TYPE_LABEL[l.serviceType] ?? l.serviceType}
                            <span className="ml-2 text-xs text-chrome-500">{l.anzahl} Auftr.</span>
                          </span>
                          <span className="tabular-nums text-chrome-200">{eur(l.summe)} · {pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-ink-750">
                          <div className="h-full rounded-full bg-copper" style={{ width: `${(l.summe / leistungMax) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Top-Kunden" subtitle="Nach Auftragsvolumen im Zeitraum">
              {data.topKunden.length === 0 ? (
                <Empty text="Keine Aufträge im Zeitraum." />
              ) : (
                <ul className="space-y-3">
                  {data.topKunden.map((k, i) => (
                    <li key={`${k.name}-${i}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-chrome-100">
                          <span className="mr-2 text-chrome-500">{i + 1}.</span>
                          {k.name}
                          <span className="ml-2 text-xs text-chrome-500">{k.anzahl} Auftr.</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-chrome-200">{eur(k.summe)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-750">
                        <div className="h-full rounded-full bg-copper/70" style={{ width: `${(k.summe / kundenMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${accent ? 'text-copper' : 'text-chrome-50'}`}>{value}</p>
    </div>
  );
}
