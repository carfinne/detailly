'use client';

// Soll/Ist-Uebersicht ueber mehrere Auftraege: welche lagen ueber/unter Plan,
// plus gebuchte Stunden je Mitarbeiter im Zeitraum. Aggregiert serverseitig
// (kein N+1), tenant-scoped. Leitung sieht alle (optional je Mitarbeiter),
// Mitarbeiter nur die eigenen Buchungen.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { Employee, OrderTimeUebersicht } from '@/lib/types';
import { SectionCard, Loading, Empty, ErrorBox, UpgradeHinweis } from '@/components/ui';

const stundenFmt = (min: number) =>
  (min / 60).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Signierte Abweichung in Stunden (+ ueber, − unter Plan). */
function abwLabel(min: number): string {
  if (min === 0) return '±0';
  return `${min > 0 ? '+' : '−'}${stundenFmt(Math.abs(min))}`;
}

export function ProjektUebersichtCard({
  istLeitung,
  employees,
}: {
  istLeitung: boolean;
  employees: Employee[];
}) {
  const t = useT();
  const [data, setData] = useState<OrderTimeUebersicht | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);
  const [filter, setFilter] = useState({ von: '', bis: '', userId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.von) params.set('von', new Date(filter.von).toISOString());
      if (filter.bis) params.set('bis', new Date(filter.bis).toISOString());
      if (istLeitung && filter.userId) params.set('userId', filter.userId);
      const qs = params.toString();
      const res = await api.get<OrderTimeUebersicht>(`/order-times/uebersicht${qs ? `?${qs}` : ''}`);
      setData(res);
      setError('');
      setUpgrade(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') {
        setUpgrade(true);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : t('projektuebersicht.error.load'));
      }
    } finally {
      setLoading(false);
    }
  }, [filter, istLeitung, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (upgrade) {
    return (
      <SectionCard title={t('projektuebersicht.title')} subtitle={t('projektuebersicht.subtitle')}>
        <UpgradeHinweis message={error || t('ordertime.upgrade')} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={t('projektuebersicht.title')} subtitle={t('projektuebersicht.subtitle')}>
      {error && <ErrorBox message={error} className="mb-3" />}

      {/* Filter: Zeitraum (+ Mitarbeiter für die Leitung). */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">{t('projektuebersicht.filter.von')}</label>
          <input
            type="date"
            className="input min-h-[44px]"
            value={filter.von}
            onChange={(e) => setFilter({ ...filter, von: e.target.value })}
          />
        </div>
        <div>
          <label className="label">{t('projektuebersicht.filter.bis')}</label>
          <input
            type="date"
            className="input min-h-[44px]"
            value={filter.bis}
            onChange={(e) => setFilter({ ...filter, bis: e.target.value })}
          />
        </div>
        {istLeitung && (
          <div>
            <label className="label">{t('projektuebersicht.filter.mitarbeiter')}</label>
            <select
              className="select min-h-[44px]"
              value={filter.userId}
              onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
            >
              <option value="">{t('projektuebersicht.filter.alle')}</option>
              {employees.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : !data || data.auftraege.length === 0 ? (
        <Empty text={t('projektuebersicht.empty')} />
      ) : (
        <div className="space-y-5">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('projektuebersicht.col.auftrag')}</th>
                  <th>{t('projektuebersicht.col.kunde')}</th>
                  <th className="text-end">{t('projektuebersicht.col.soll')}</th>
                  <th className="text-end">{t('projektuebersicht.col.ist')}</th>
                  <th className="text-end">{t('projektuebersicht.col.abweichung')}</th>
                </tr>
              </thead>
              <tbody>
                {data.auftraege.map((z) => (
                  <tr key={z.orderId}>
                    <td className="font-medium">
                      <Link href={`/auftraege/detail/?id=${z.orderId}`} className="link-action">
                        {z.auftragsnummer}
                      </Link>
                    </td>
                    <td className="text-chrome-300">{z.kundeName}</td>
                    <td className="text-end tabular-nums text-chrome-300">
                      {z.sollMinuten > 0 ? stundenFmt(z.sollMinuten) : '–'}
                    </td>
                    <td className="text-end tabular-nums text-chrome-100">{stundenFmt(z.gebuchtMinuten)}</td>
                    <td
                      className={`text-end font-medium tabular-nums ${
                        z.sollMinuten === 0
                          ? 'text-chrome-500'
                          : z.abweichungMinuten > 0
                            ? 'text-danger'
                            : 'text-positive'
                      }`}
                    >
                      {z.sollMinuten === 0 ? '–' : abwLabel(z.abweichungMinuten)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gebuchte Stunden je Mitarbeiter + Gesamt. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700/50 bg-ink-750 px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {data.proMitarbeiter.map((p) => (
                <span key={p.userId} className="text-sm text-chrome-300">
                  {p.name}: <span className="font-medium tabular-nums text-chrome-100">{stundenFmt(p.gebuchtMinuten)} {t('projektuebersicht.hoursUnit')}</span>
                </span>
              ))}
            </div>
            <span className="text-sm text-chrome-300">
              {t('projektuebersicht.total')}:{' '}
              <span className="font-display text-lg font-bold tabular-nums text-chrome-50">
                {stundenFmt(data.summeGebuchtMinuten)} {t('projektuebersicht.hoursUnit')}
              </span>
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
