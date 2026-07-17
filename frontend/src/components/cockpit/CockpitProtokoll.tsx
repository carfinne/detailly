'use client';

// Cockpit-Tab „Protokoll": plattformweite Audit-Lesesicht (/platform/audit).
// Nur Plattform-Admin (Backend gated; die Seite rendert den Tab ohnehin nur fuer
// Admins). Paginiert, gedeckelt, mit Filtern nach Aktion und Betriebs-ID.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Loading, ErrorBox, Empty } from '@/components/ui';
import { Pager } from '@/components/Pager';
import type { AuditReadResult, AuditLogItem } from './types';

const SEITENGROESSE = 50;

export function CockpitProtokoll() {
  const t = useT();
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [tenantId, setTenantId] = useState('');
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
      if (action.trim()) params.set('action', action.trim());
      if (tenantId.trim()) params.set('tenantId', tenantId.trim());
      const res = await api.get<AuditReadResult>(`/platform/audit?${params.toString()}`);
      if (id !== reqId.current) return;
      setRows(res.data);
      setTotal(res.total);
      setError('');
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, action, tenantId, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const filterAktiv = action.trim() !== '' || tenantId.trim() !== '';

  return (
    <div className="space-y-5">
      <div className="mb-1">
        <h2 className="font-display text-base font-semibold text-chrome-50">{t('cockpit.audit.title')}</h2>
        <p className="mt-0.5 text-xs text-chrome-400">{t('cockpit.audit.subtitle')}</p>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder={t('cockpit.audit.filter.action')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
        <input
          className="input max-w-xs"
          placeholder={t('cockpit.audit.filter.tenant')}
          value={tenantId}
          onChange={(e) => {
            setTenantId(e.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text={filterAktiv ? t('cockpit.audit.emptyFiltered') : t('cockpit.audit.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('cockpit.audit.col.zeit')}</th>
                  <th>{t('cockpit.audit.col.aktion')}</th>
                  <th>{t('cockpit.audit.col.objekt')}</th>
                  <th>{t('cockpit.audit.col.betrieb')}</th>
                  <th>{t('cockpit.audit.col.nutzer')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs text-chrome-400">{datumZeit(e.createdAt)}</td>
                    <td>
                      <span className="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-chrome-200">
                        {e.action}
                      </span>
                    </td>
                    <td className="text-xs text-chrome-400">
                      {e.entityType}
                      {e.entityId ? (
                        <span className="text-chrome-600" title={e.entityId}> · {kurz(e.entityId)}</span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="font-mono text-xs text-chrome-500" title={e.tenantId}>{kurz(e.tenantId)}</td>
                    <td className="font-mono text-xs text-chrome-500" title={e.userId ?? undefined}>
                      {e.userId ? kurz(e.userId) : '–'}
                    </td>
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

// UUIDs/lange IDs gekuerzt anzeigen (erste 8 Zeichen), voll im title-Tooltip.
function kurz(id: string): string {
  return id.length > 10 ? id.slice(0, 8) : id;
}
