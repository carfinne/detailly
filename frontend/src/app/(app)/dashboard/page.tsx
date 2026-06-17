'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '@/lib/labels';
import type { DashboardStats } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <Loading />;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ueberblick ueber den Betrieb" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Offene Auftraege" value={stats.offeneAuftraege} />
        <Kpi label="Termine heute" value={stats.termineHeute} />
        <Kpi label="Kunden gesamt" value={stats.kundenGesamt} />
        <Kpi label="Umsatz (bezahlt)" value={eur(stats.umsatzBezahlt)} />
      </div>

      <div className="mt-8 card">
        <h2 className="mb-4 text-lg font-semibold">Offene Auftraege</h2>
        {stats.offeneAuftragsListe.length === 0 ? (
          <Empty text="Keine offenen Auftraege." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nummer</th>
                  <th>Status</th>
                  <th className="text-right">Gesamt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.offeneAuftragsListe.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">{o.auftragsnummer}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
                    <td className="text-right">{eur(o.gesamtpreis)}</td>
                    <td className="text-right">
                      <Link href={`/auftraege/detail/?id=${o.id}`} className="text-accent hover:underline">
                        Oeffnen
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
