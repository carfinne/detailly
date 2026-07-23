'use client';

// Cockpit-Tab „Empfehlungen": read-only Betreiber-Sicht des Affiliate-Programms
// (/platform/referrals). Wer hat wen geworben (Betriebsnamen, Datum, Status) inkl.
// Gutschrift-Anwartschaften. Fuer alle Plattform-Rollen (Backend gated). Paginiert.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { datum } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Loading, ErrorBox, Empty, Badge } from '@/components/ui';
import { Pager } from '@/components/Pager';
import type { PlatformReferralItem, PlatformReferralResult } from './types';

const SEITENGROESSE = 50;

export function CockpitEmpfehlungen() {
  const t = useT();
  const [rows, setRows] = useState<PlatformReferralItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(SEITENGROESSE),
        offset: String((page - 1) * SEITENGROESSE),
      });
      const res = await api.get<PlatformReferralResult>(`/platform/referrals?${params.toString()}`);
      if (id !== reqId.current) return;
      setRows(res.data);
      setTotal(res.total);
      setError('');
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="mb-1">
        <h2 className="font-display text-base font-semibold text-chrome-50">{t('cockpit.referrals.title')}</h2>
        <p className="mt-0.5 text-xs text-chrome-400">{t('cockpit.referrals.subtitle')}</p>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="card">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text={t('cockpit.referrals.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('cockpit.referrals.col.referrer')}</th>
                  <th>{t('cockpit.referrals.col.referred')}</th>
                  <th>{t('cockpit.referrals.col.status')}</th>
                  <th>{t('cockpit.referrals.col.reward')}</th>
                  <th>{t('cockpit.referrals.col.date')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-chrome-100" title={r.werberTenantId}>{r.werber}</td>
                    <td className="text-chrome-200" title={r.geworbenTenantId}>{r.geworben}</td>
                    <td>
                      {r.status === 'zahlend' ? (
                        <Badge className="badge-positive">{t('affiliate.status.paying')}</Badge>
                      ) : (
                        <Badge className="badge-neutral">{t('affiliate.status.registered')}</Badge>
                      )}
                    </td>
                    <td className="text-xs text-chrome-400">
                      {r.belohnungAnwartschaft ? t('affiliate.reward.monatBasic') : '—'}
                    </td>
                    <td className="whitespace-nowrap text-xs text-chrome-400">{datum(r.geworbenAm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />
    </div>
  );
}
