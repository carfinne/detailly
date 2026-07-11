'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import type { AuditLog } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, UpgradeHinweis, Empty } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Enum->i18n-Key (Rohwert-Fallback via t()).
const ACTION_KEY: Record<string, string> = {
  create: 'audit.action.create',
  update: 'audit.action.update',
  delete: 'audit.action.delete',
  status_change: 'audit.action.statusChange',
};

export default function AuditPage() {
  const t = useT();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Zeigt den Upgrade-Weg (/abo) an, wenn das 403 vom Tarif kommt (fehlendes
  // Feature) und NICHT von der Rolle – sonst landet ein berechtigter Owner/
  // Manager in einer irreführenden Rollen-Sackgasse ohne Ausweg.
  const [upgrade, setUpgrade] = useState(false);

  useEffect(() => {
    api
      .get<{ data: AuditLog[]; total: number }>('/audit-logs?limit=100')
      .then((r) => setItems(r.data))
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') {
          // Tarif-403: Backend-Upgrade-Hinweis anzeigen + Weg zum Abo öffnen.
          setError(e.message);
          setUpgrade(true);
        } else if (e instanceof ApiError && e.status === 403) {
          // Rollen-403: fehlende Berechtigung.
          setError(t('audit.error.forbidden'));
        } else {
          setError(e instanceof ApiError ? e.message : t('audit.error.load'));
        }
      })
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      {error && (upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />)}
      {!error && (
        <div className="card">
          {loading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty text={t('audit.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('audit.col.zeitpunkt')}</th>
                    <th>{t('audit.col.aktion')}</th>
                    <th>{t('audit.col.objekt')}</th>
                    <th>{t('audit.col.referenz')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{datumZeit(a.createdAt)}</td>
                      <td>{ACTION_KEY[a.action] ? t(ACTION_KEY[a.action]) : a.action}</td>
                      <td>{a.entityType}</td>
                      <td className="font-mono text-xs text-chrome-400">{a.entityId || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
