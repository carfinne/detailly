'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { ORDER_STATUS_KEY, ORDER_STATUS_COLOR } from '@/lib/labels';
import type { Vehicle, Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, SectionCard, Row } from '@/components/ui';
import { useT } from '@/lib/i18n';

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
  const t = useT();
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const [data, setData] = useState<Dossier | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<Dossier>(`/vehicles/${id}/akte`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Full-Page-Fehler nur, wenn die Akte selbst nicht geladen werden konnte.
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const v = data.vehicle;

  return (
    <div>
      <PageHeader
        title={`${v.make} ${v.model}`}
        subtitle={v.licensePlate || 'Fahrzeugakte'}
        action={
          <Link href="/fahrzeuge" className="btn-ghost">
            Zurück
          </Link>
        }
      />
      {error && <ErrorBox message={error} className="mb-4" />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Stammdaten" className="lg:col-span-1">
          <div>
            <Row label="Marke / Modell" value={`${v.make} ${v.model}`} />
            <Row label="Variante" value={v.variant || '–'} />
            <Row label="Baujahr" value={v.year ? String(v.year) : '–'} />
            <Row label="Farbe" value={v.color || '–'} />
            <Row label="Kennzeichen" value={v.licensePlate || '–'} />
            <Row label="Kraftstoff" value={v.fuelType ? FUEL[v.fuelType] ?? v.fuelType : '–'} />
            <Row label="Fläche" value={v.estimatedSqm ? `${v.estimatedSqm} qm` : '–'} />
          </div>
          {v.customerId && (
            <Link href={`/kunden/detail/?id=${v.customerId}`} className="link-action mt-3 inline-flex items-center gap-1 text-sm">
              Zum Halter →
            </Link>
          )}
        </SectionCard>

        <SectionCard title="Auftragshistorie" className="lg:col-span-2">
          {data.orders.length === 0 ? (
            <Empty text="Noch keine Aufträge zu diesem Fahrzeug." />
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
                          {t(ORDER_STATUS_KEY[o.status] ?? o.status)}
                        </Badge>
                      </td>
                      <td>{datum(o.createdAt)}</td>
                      <td className="text-right">{eur(o.gesamtpreis)}</td>
                      <td className="text-right">
                        <Link href={`/auftraege/detail/?id=${o.id}`} className="link-action">
                          Öffnen
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
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
