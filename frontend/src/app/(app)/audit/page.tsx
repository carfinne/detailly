'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import type { AuditLog } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty } from '@/components/ui';

const ACTION_LABEL: Record<string, string> = {
  create: 'Angelegt',
  update: 'Aktualisiert',
  delete: 'Gelöscht',
  status_change: 'Status geändert',
};

export default function AuditPage() {
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
          setError('Keine Berechtigung – das Audit-Log ist nur für Manager und Inhaber sichtbar.');
        } else {
          setError(e instanceof ApiError ? e.message : 'Das Audit-Log konnte nicht geladen werden.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Audit-Log" subtitle="Nachvollziehbare Aktivitäten im System" />
      {error && (
        <div>
          <ErrorBox message={error} />
          {upgrade && (
            <Link href="/abo" className="btn-primary mt-3 inline-flex">
              Zum Abo &amp; Tarif
            </Link>
          )}
        </div>
      )}
      {!error && (
        <div className="card">
          {loading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty text="Noch keine Einträge." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Zeitpunkt</th>
                    <th>Aktion</th>
                    <th>Objekt</th>
                    <th>Referenz</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{datumZeit(a.createdAt)}</td>
                      <td>{ACTION_LABEL[a.action] ?? a.action}</td>
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
