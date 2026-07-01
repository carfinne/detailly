'use client';

// Plattform-Analysen (Detailly, betriebsuebergreifend). NUR Plattform-Rollen –
// Backend ist @Roles-geschuetzt; die Nav blendet den Eintrag fuer Kunden aus.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty } from '@/components/ui';

interface Overview {
  abos: { aktiv: number; testphase: number; gekuendigt: number; mrr: number; tarife: { name: string; anzahl: number }[] };
  wachstum: { betriebeGesamt: number; neuDiesenMonat: number; trend: { label: string; anzahl: number }[] };
  nutzung: { auftraege: number; rechnungen: number; umsatzGesamt: number };
  aktivitaet: { topBetriebe: { name: string; auftraege: number }[]; inaktivAnzahl: number; inaktivBetriebe: { name: string }[] };
}

const zahl = (n: number) => n.toLocaleString('de-DE');

export default function PlattformAnalysenPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Overview>('/platform/analytics')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Auswertung nicht verfügbar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const trendMax = Math.max(1, ...data.wachstum.trend.map((t) => t.anzahl));
  const topMax = Math.max(1, ...data.aktivitaet.topBetriebe.map((t) => t.auftraege));

  return (
    <div>
      <PageHeader title="Plattform-Analysen" subtitle="Detailly – über alle Betriebe hinweg." />

      <div className="space-y-5">
        {/* Abos & MRR */}
        <SectionCard title="Abos & MRR" subtitle="Monatlich wiederkehrender Umsatz aus aktiven Abos">
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="MRR" value={eur(data.abos.mrr)} accent />
            <Kpi label="Aktive Abos" value={zahl(data.abos.aktiv)} />
            <Kpi label="In Testphase" value={zahl(data.abos.testphase)} />
            <Kpi label="Gekündigt" value={zahl(data.abos.gekuendigt)} />
          </div>
          {data.abos.tarife.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.abos.tarife.map((t) => (
                <span key={t.name} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm text-chrome-200">
                  {t.name}: <span className="font-semibold text-chrome-50">{zahl(t.anzahl)}</span>
                </span>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Wachstum */}
          <SectionCard title="Wachstum" subtitle="Neue Betriebe je Monat">
            <div className="mb-3 flex items-baseline gap-4">
              <div>
                <p className="font-display text-2xl font-bold text-chrome-50">{zahl(data.wachstum.betriebeGesamt)}</p>
                <p className="text-xs text-chrome-500">Betriebe gesamt</p>
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-copper">+{zahl(data.wachstum.neuDiesenMonat)}</p>
                <p className="text-xs text-chrome-500">diesen Monat</p>
              </div>
            </div>
            <div className="flex h-24 items-end gap-2">
              {data.wachstum.trend.map((m) => (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-copper/70" style={{ height: `${(m.anzahl / trendMax) * 100}%` }} title={`${m.label}: ${m.anzahl}`} />
                  </div>
                  <span className="text-[10px] text-chrome-500">{m.label}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Nutzung */}
          <SectionCard title="Nutzung gesamt" subtitle="Über alle Betriebe">
            <div className="grid grid-cols-1 gap-3">
              <Zeile k="Aufträge gesamt" v={zahl(data.nutzung.auftraege)} />
              <Zeile k="Belege gesamt" v={zahl(data.nutzung.rechnungen)} />
              <Zeile k="Bezahlter Umsatz (alle Betriebe)" v={eur(data.nutzung.umsatzGesamt)} accent />
            </div>
          </SectionCard>
        </div>

        {/* Aktivität */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Aktivste Betriebe" subtitle="Nach Auftragszahl">
            {data.aktivitaet.topBetriebe.length === 0 ? (
              <Empty text="Noch keine Aufträge." />
            ) : (
              <ul className="space-y-3">
                {data.aktivitaet.topBetriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-chrome-100"><span className="mr-2 text-chrome-500">{i + 1}.</span>{b.name}</span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{zahl(b.auftraege)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-750">
                      <div className="h-full rounded-full bg-copper" style={{ width: `${(b.auftraege / topMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Churn-Risiko"
            subtitle="Betriebe ohne Auftrag in den letzten 30 Tagen"
          >
            <p className="mb-3 font-display text-2xl font-bold text-caution">{zahl(data.aktivitaet.inaktivAnzahl)}</p>
            {data.aktivitaet.inaktivBetriebe.length === 0 ? (
              <Empty text="Alle Betriebe sind aktiv. 🎉" />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.aktivitaet.inaktivBetriebe.map((b, i) => (
                  <li key={`${b.name}-${i}`} className="rounded-lg border border-caution/30 bg-caution-soft px-2.5 py-1 text-sm text-caution">
                    {b.name}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
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

function Zeile({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-700/50 pb-2 last:border-0">
      <span className="text-sm text-chrome-300">{k}</span>
      <span className={`font-display text-lg font-bold tabular-nums ${accent ? 'text-copper' : 'text-chrome-50'}`}>{v}</span>
    </div>
  );
}
