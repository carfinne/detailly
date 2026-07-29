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
import { useHasFeature } from '@/lib/entitlements';

interface Dossier {
  vehicle: Vehicle;
  orders: Order[];
}

// Kraftstoff-Labels als i18n-Keys (Modul-Scope, daher kein t hier) – Aufruf
// im Render per t(FUEL_KEY[v] ?? v). Keys sind die der Fahrzeug-Liste.
const FUEL_KEY: Record<string, string> = {
  petrol: 'fahrzeuge.fuel.petrol',
  diesel: 'fahrzeuge.fuel.diesel',
  electric: 'fahrzeuge.fuel.electric',
  hybrid: 'fahrzeuge.fuel.hybrid',
};

function FahrzeugAkte() {
  const t = useT();
  const hasFeature = useHasFeature();
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
        subtitle={v.licensePlate || t('fahrzeuge.detail.subtitle')}
        action={
          <div className="flex items-center gap-2">
            {hasFeature('schichtdicke') && (
              <Link href={`/schichtdicke?vehicle=${v.id}`} className="btn-ghost">
                {t('nav.item.schichtdicke')}
              </Link>
            )}
            <Link href="/fahrzeuge" className="btn-ghost">
              {t('common.back')}
            </Link>
          </div>
        }
      />
      {error && <ErrorBox message={error} className="mb-4" />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title={t('fahrzeuge.detail.masterData')} className="lg:col-span-1">
          <div>
            <Row label={t('fahrzeuge.detail.makeModel')} value={`${v.make} ${v.model}`} />
            <Row label={t('fahrzeuge.form.variante')} value={v.variant || '–'} />
            <Row label={t('fahrzeuge.form.baujahr')} value={v.year ? String(v.year) : '–'} />
            <Row label={t('fahrzeuge.form.farbe')} value={v.color || '–'} />
            <Row label={t('fahrzeuge.form.kennzeichen')} value={v.licensePlate || '–'} />
            <Row label={t('fahrzeuge.form.kraftstoff')} value={v.fuelType ? t(FUEL_KEY[v.fuelType] ?? v.fuelType) : '–'} />
            <Row label={t('fahrzeuge.detail.area')} value={v.estimatedSqm ? t('fahrzeuge.detail.sqm', { n: v.estimatedSqm }) : '–'} />
          </div>
          {v.customerId && (
            <Link href={`/kunden/detail/?id=${v.customerId}`} className="link-action mt-3 inline-flex items-center gap-1 text-sm">
              {t('fahrzeuge.detail.toOwner')} →
            </Link>
          )}
        </SectionCard>

        <SectionCard title={t('fahrzeuge.detail.orderHistory')} className="lg:col-span-2">
          {data.orders.length === 0 ? (
            <Empty text={t('fahrzeuge.detail.emptyOrders')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('auftraege.col.nummer')}</th>
                    <th>{t('auftraege.col.status')}</th>
                    <th>{t('rechnungen.col.datum')}</th>
                    <th className="text-end">{t('auftraege.col.gesamt')}</th>
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
                      <td className="text-end">{eur(o.gesamtpreis)}</td>
                      <td className="text-end">
                        <Link href={`/auftraege/detail/?id=${o.id}`} className="link-action">
                          {t('auftraege.action.open')}
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
