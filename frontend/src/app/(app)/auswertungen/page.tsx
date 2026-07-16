'use client';

// Schlanke betriebswirtschaftliche Auswertung (Berichte). Zeitraum-Filter +
// KPIs + Umsatz nach Leistungsart + Top-Kunden. Leitung-only (Backend gated).

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import { useHasFeature } from '@/lib/entitlements';
import { PageHeader, SectionCard, Loading, ErrorBox, UpgradeHinweis, Empty, StatCard } from '@/components/ui';
import { ChartExportMenu } from '@/components/ChartExportMenu';
import { downloadCsv, csvNum } from '@/lib/chart-export';
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

/** Zeitraum-Aggregat der Verschnitt-KPI (GET /verschnitt/aggregat, Basic+). */
interface VerschnittAggregat {
  geplantLfm: number | null;
  verbrauchtLfm: number;
  verschnittLfm: number | null;
  verschnittProzent: number | null;
  bewertung: 'gut' | 'warnung' | 'kritisch' | null;
}

/** Ampel: Bewertung -> Token-Badge (gut=grün, warnung=amber, kritisch=rot). */
const BEWERTUNG_BADGE: Record<string, string> = {
  gut: 'badge-positive',
  warnung: 'badge-caution',
  kritisch: 'badge-danger',
};

const lfmFmt = (n: number) =>
  Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AuswertungenPage() {
  const t = useT();
  const hasFeature = useHasFeature();
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
            <SectionCard
              title={t('auswertungen.leistungsart.title')}
              subtitle={t('auswertungen.leistungsart.subtitle')}
              action={
                data.nachLeistungsart.length > 0 ? (
                  <ChartExportMenu
                    onCsv={() =>
                      downloadCsv(
                        `detailly-leistungsarten-${von}_${bis}.csv`,
                        ['Leistungsart', 'Umsatz (EUR)', 'Anteil (%)', 'Aufträge'],
                        data.nachLeistungsart.map((l) => [
                          ART_KEY[l.serviceType] ? t(ART_KEY[l.serviceType]) : l.serviceType,
                          csvNum(l.summe, 2),
                          data.auftragsvolumen > 0 ? Math.round((l.summe / data.auftragsvolumen) * 100) : 0,
                          l.anzahl,
                        ]),
                      )
                    }
                  />
                ) : undefined
              }
            >
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

            <SectionCard
              title={t('auswertungen.topKunden.title')}
              subtitle={t('auswertungen.topKunden.subtitle')}
              action={
                data.topKunden.length > 0 ? (
                  <ChartExportMenu
                    onCsv={() =>
                      downloadCsv(
                        `detailly-top-kunden-${von}_${bis}.csv`,
                        ['Rang', 'Kunde', 'Umsatz (EUR)', 'Aufträge'],
                        data.topKunden.map((k, i) => [i + 1, k.name, csvNum(k.summe, 2), k.anzahl]),
                      )
                    }
                  />
                ) : undefined
              }
            >
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

          {/* Verschnitt (Folie): eigenes Feature-Gate wie der Endpoint (auswertungen). */}
          {hasFeature('auswertungen') && <VerschnittCard von={von} bis={bis} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Verschnitt (Folie) im Zeitraum: geplante vs. verbrauchte Laufmeter aus dem
 * lfm-Rechner/Restrollen-Buchen, mit Ampel-Bewertung. Ein 403 (Tarif ODER
 * Rolle) blendet die Karte still aus – den Upgrade-Weg zeigt bereits das
 * Seiten-Gate der Haupt-Auswertung.
 */
function VerschnittCard({ von, bis }: { von: string; bis: string }) {
  const t = useT();
  const [data, setData] = useState<VerschnittAggregat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verborgen, setVerborgen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<VerschnittAggregat>(`/verschnitt/aggregat?von=${von}&bis=${bis}`));
      setError('');
      setVerborgen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setVerborgen(true);
      } else {
        setError(e instanceof Error ? e.message : t('auswertungen.verschnitt.error'));
      }
    } finally {
      setLoading(false);
    }
  }, [von, bis, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (verborgen) return null;

  const leer = !!data && data.geplantLfm == null && Number(data.verbrauchtLfm) <= 0;

  return (
    <SectionCard title={t('auswertungen.verschnitt.title')} subtitle={t('auswertungen.verschnitt.subtitle')}>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data || leer ? (
        <Empty text={t('auswertungen.verschnitt.empty')} />
      ) : (
        <>
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-chrome-400">{t('auswertungen.verschnitt.geplant')}</dt>
              <dd className="tabular-nums text-chrome-100">
                {data.geplantLfm != null
                  ? t('auswertungen.verschnitt.wert', { wert: lfmFmt(Number(data.geplantLfm)) })
                  : '–'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-chrome-400">{t('auswertungen.verschnitt.verbraucht')}</dt>
              <dd className="tabular-nums text-chrome-100">
                {t('auswertungen.verschnitt.wert', { wert: lfmFmt(Number(data.verbrauchtLfm)) })}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-700/60 pt-3">
            <span className="text-sm font-semibold text-chrome-100">{t('auswertungen.verschnitt.label')}</span>
            {data.verschnittProzent != null && data.bewertung ? (
              <span className={BEWERTUNG_BADGE[data.bewertung] ?? 'badge-neutral'}>
                {t('auswertungen.verschnitt.badge', {
                  lfm: lfmFmt(Number(data.verschnittLfm ?? 0)),
                  prozent: lfmFmt(Number(data.verschnittProzent)),
                })}
              </span>
            ) : (
              <span className="text-xs text-chrome-500">{t('auswertungen.verschnitt.keinPlan')}</span>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}
