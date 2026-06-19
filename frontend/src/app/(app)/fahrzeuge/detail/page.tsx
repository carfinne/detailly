'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '@/lib/labels';
import type { Vehicle, Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

interface Dossier {
  vehicle: Vehicle;
  orders: Order[];
}

const FUEL: Record<string, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid',
};

function FahrzeugAkte() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const [data, setData] = useState<Dossier | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Dossier>(`/vehicles/${id}/akte`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const v = data.vehicle;

  return (
    <div>
      <PageHeader
        title={`${v.make} ${v.model}`}
        subtitle={v.licensePlate || 'Fahrzeugakte'}
        action={
          <Link href="/fahrzeuge" className="btn-ghost">
            Zurueck
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <h2 className="mb-3 text-lg font-semibold">Stammdaten</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Marke / Modell" v={`${v.make} ${v.model}`} />
            <Row k="Variante" v={v.variant || '–'} />
            <Row k="Baujahr" v={v.year ? String(v.year) : '–'} />
            <Row k="Farbe" v={v.color || '–'} />
            <Row k="Kennzeichen" v={v.licensePlate || '–'} />
            <Row k="Kraftstoff" v={v.fuelType ? FUEL[v.fuelType] ?? v.fuelType : '–'} />
            <Row k="Flaeche" v={v.estimatedSqm ? `${v.estimatedSqm} qm` : '–'} />
          </dl>
        </div>

        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Auftragshistorie</h2>
          {data.orders.length === 0 ? (
            <Empty text="Noch keine Auftraege zu diesem Fahrzeug." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nummer</th>
                    <th>Status</th>
                    <th>Datum</th>
                    <th className="text-right">Gesamt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium">{o.auftragsnummer}</td>
                      <td>
                        <Badge className={ORDER_STATUS_COLOR[o.status]}>
                          {ORDER_STATUS_LABEL[o.status] ?? o.status}
                        </Badge>
                      </td>
                      <td>{datum(o.createdAt)}</td>
                      <td className="text-right">{eur(o.gesamtpreis)}</td>
                      <td className="text-right">
                        <Link href={`/auftraege/detail/?id=${o.id}`} className="text-copper hover:underline">
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
    </div>
  );
}

export default function FahrzeugAktePage() {
  return (
    <Suspense fallback={<Loading />}>
      <FahrzeugAkte />
    </Suspense>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-700/50 pb-1">
      <dt className="text-chrome-400">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
