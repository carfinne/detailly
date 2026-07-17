'use client';

// Cockpit-Tab „Standorte": Region-Aggregat je 2-stelliger PLZ-Leitregion
// (/platform/locations). Bewusst datensparsam – keine Adressen, nur Zaehler je
// Leitregion + Betriebstyp-Split. Einfache Balken-Visualisierung (kein Kart-
// Rendering; die Landing-Karte bleibt unangetastet).

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { zahl } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Loading, ErrorBox, Empty, StatCard } from '@/components/ui';
import {
  BETRIEBSTYP_KEY,
  BETRIEBSTYP_LISTE,
  BETRIEBSTYP_COLOR,
  type RegionAggregat,
  type Betriebstyp,
} from './types';

// Leitregion (erste PLZ-Ziffer) -> grober Regions-Name (i18n-Key). Rein
// informativ; kein Anspruch auf exakte Grenzen. Fallback: nur die Ziffern.
function zoneKey(region: string): string {
  const d = region.trim().charAt(0);
  return /[0-9]/.test(d) ? `cockpit.zone.${d}` : '';
}

export function CockpitStandorte() {
  const t = useT();
  const [regionen, setRegionen] = useState<RegionAggregat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let aktiv = true;
    api
      .get<RegionAggregat[]>('/platform/locations')
      .then((r) => {
        if (aktiv) setRegionen(r);
      })
      .catch((e) => {
        if (aktiv) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
      })
      .finally(() => {
        if (aktiv) setLoading(false);
      });
    return () => {
      aktiv = false;
    };
  }, [t]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!regionen) return null;
  if (regionen.length === 0) return <Empty text={t('cockpit.loc.empty')} />;

  const gesamt = regionen.reduce((s, r) => s + r.anzahl, 0);
  const maxAnzahl = Math.max(1, ...regionen.map((r) => r.anzahl));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label={t('cockpit.loc.total')} value={gesamt} accent />
        <StatCard label={t('cockpit.loc.regions')} value={regionen.length} />
      </div>

      {/* Legende der Betriebstypen (Farbzuordnung fuer die Split-Balken). */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {BETRIEBSTYP_LISTE.map((typ) => (
          <span key={typ} className="flex items-center gap-1.5 text-xs text-chrome-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BETRIEBSTYP_COLOR[typ] }} />
            {t(BETRIEBSTYP_KEY[typ])}
          </span>
        ))}
      </div>

      <ul className="space-y-3">
        {regionen.map((r) => {
          const zk = zoneKey(r.region);
          return (
            <li key={r.region} className="card-flush animate-fade-in p-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-display text-sm font-semibold text-chrome-50">
                    {t('cockpit.loc.region', { region: r.region })}
                  </span>
                  {zk && <span className="ml-2 truncate text-xs text-chrome-500">{t(zk)}</span>}
                </div>
                <span className="shrink-0 font-display text-lg font-bold tabular-nums text-chrome-50">
                  {zahl(r.anzahl)}
                </span>
              </div>

              {/* Split-Balken: Anteil je Betriebstyp; Gesamtbreite skaliert auf
                  die groesste Region, damit Regionen visuell vergleichbar sind. */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800" style={{ width: `${(r.anzahl / maxAnzahl) * 100}%` }}>
                {BETRIEBSTYP_LISTE.map((typ) => {
                  const anteil = r.typen[typ as Betriebstyp] ?? 0;
                  if (anteil === 0) return null;
                  return (
                    <span
                      key={typ}
                      className="h-full"
                      style={{ width: `${(anteil / r.anzahl) * 100}%`, backgroundColor: BETRIEBSTYP_COLOR[typ] }}
                      title={`${t(BETRIEBSTYP_KEY[typ])}: ${zahl(anteil)}`}
                    />
                  );
                })}
              </div>

              {/* Aufschluesselung als Chips (nur Typen mit Vorkommen). */}
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                {BETRIEBSTYP_LISTE.filter((typ) => (r.typen[typ] ?? 0) > 0).map((typ) => (
                  <span key={typ} className="flex items-center gap-1.5 text-xs text-chrome-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BETRIEBSTYP_COLOR[typ] }} />
                    {t(BETRIEBSTYP_KEY[typ])}
                    <span className="tabular-nums text-chrome-500">{zahl(r.typen[typ])}</span>
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
