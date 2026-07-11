'use client';

// Schlanke betriebswirtschaftliche Auswertung (Berichte). Zeitraum-Filter +
// KPIs + Umsatz nach Leistungsart + Top-Kunden. Leitung-only (Backend gated).

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import { PageHeader, SectionCard, Loading, ErrorBox, UpgradeHinweis, Empty, StatCard } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Enum->i18n-Key (Rohwert-Fallback via t()). Die geteilte labels.ts bleibt
// unangetastet; die Leistungsart-Labels werden lokal im Seiten-Namespace geführt.
const ART_KEY: Record<string, string> = {
  aufbereitung: 'auswertungen.art.aufbereitung',
  folierung: 'auswertungen.art.folierung',
  ppf: 'auswertungen.art.ppf',
  sonstiges: 'auswertungen.art.sonstiges',
};

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
  const t = useT();
  const [von, setVon] = useState(iso(new Date(new Date().getFullYear(), 0, 1)));
  const [bis, setBis] = useState(iso(new Date()));
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tarif-403 (Auswertungen erst ab Basic) zeigt den Upgrade-Weg statt Sackgasse.
  const [upgrade, setUpgrade] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<Overview>(`/reports/overview?von=${von}&bis=${bis}`));
      setError('');
      setUpgrade(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof Error ? e.message : t('auswertungen.error.load'));
    } finally {
      setLoading(false);
    }
  }, [von, bis, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const leistungMax = data ? Math.max(1, ...data.nachLeistungsart.map((l) => l.summe)) : 1;
  const kundenMax = data ? Math.max(1, ...data.topKunden.map((k) => k.summe)) : 1;

  return (
    <div>
      <PageHeader title={t('auswertungen.title')} subtitle={t('auswertungen.subtitle')} />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="field">
          <label className="label" htmlFor="von">{t('auswertungen.von')}</label>
          <input id="von" type="date" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="bis">{t('auswertungen.bis')}</label>
          <input id="bis" type="date" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
        </div>
      </div>

      {error && (upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />)}

      {loading ? (
        <Loading />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('auswertungen.kpi.volumen')} value={eur(data.auftragsvolumen)} />
            <StatCard label={t('auswertungen.kpi.anzahl')} value={data.anzahlAuftraege} />
            <StatCard label={t('auswertungen.kpi.schnitt')} value={eur(data.schnittAuftragswert)} />
            <StatCard label={t('auswertungen.kpi.bezahlt')} value={eur(data.umsatzBezahlt)} accent />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t('auswertungen.leistungsart.title')} subtitle={t('auswertungen.leistungsart.subtitle')}>
              {data.nachLeistungsart.length === 0 ? (
                <Empty text={t('auswertungen.empty')} />
              ) : (
                <ul className="space-y-3">
                  {data.nachLeistungsart.map((l) => {
                    const pct = data.auftragsvolumen > 0 ? Math.round((l.summe / data.auftragsvolumen) * 100) : 0;
                    return (
                      <li key={l.serviceType}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-chrome-100">
                            {ART_KEY[l.serviceType] ? t(ART_KEY[l.serviceType]) : l.serviceType}
                            <span className="ml-2 text-xs text-chrome-500">{t('auswertungen.auftrCount', { count: l.anzahl })}</span>
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

            <SectionCard title={t('auswertungen.topKunden.title')} subtitle={t('auswertungen.topKunden.subtitle')}>
              {data.topKunden.length === 0 ? (
                <Empty text={t('auswertungen.empty')} />
              ) : (
                <ul className="space-y-3">
                  {data.topKunden.map((k, i) => (
                    <li key={`${k.name}-${i}`}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-chrome-100">
                          <span className="mr-2 text-chrome-500">{i + 1}.</span>
                          {k.name}
                          <span className="ml-2 text-xs text-chrome-500">{t('auswertungen.auftrCount', { count: k.anzahl })}</span>
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
