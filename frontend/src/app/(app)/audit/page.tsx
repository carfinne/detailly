'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import type { AuditLog } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty } from '@/components/ui';

const ACTION_LABEL: Record<string, string> = {
  create: 'Angelegt',
  update: 'Aktualisiert',
  delete: 'Geloescht',
  status_change: 'Status geaendert',
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ data: AuditLog[]; total: number }>('/audit-logs?limit=100')
      .then((r) => setItems(r.data))
      .catch((e) =>
        setError(
          e.status === 403
            ? 'Keine Berechtigung – das Audit-Log ist nur fuer Manager und Inhaber sichtbar.'
            : e.message,
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Audit-Log" subtitle="Nachvollziehbare Aktivitaeten im System" />
      {error && <ErrorBox message={error} />}
      {!error && (
        <div className="card">
          {loading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty text="Noch keine Eintraege." />
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
                      <td className="font-mono text-xs text-muted">{a.entityId || '–'}</td>
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
