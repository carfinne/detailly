'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { eur, datumZeit } from '@/lib/format';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_NEXT,
  SERVICE_TYPE_LABEL,
} from '@/lib/labels';
import type { Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Badge } from '@/components/ui';

function AuftragDetail() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.get<Order>(`/orders/${id}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Statuswechsel fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(art: 'angebot' | 'rechnung') {
    setBusy(true);
    try {
      await api.post(`/invoices/from-order/${id}?art=${art}`);
      router.push('/rechnungen');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beleg konnte nicht erstellt werden');
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!order) return <Loading />;

  const next = ORDER_STATUS_NEXT[order.status] ?? [];

  return (
    <div>
      <PageHeader
        title={order.auftragsnummer}
        subtitle={SERVICE_TYPE_LABEL[order.serviceType] ?? order.serviceType}
        action={
          <Link href="/auftraege" className="btn-ghost">
            Zurueck
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Positionen</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Beschreibung</th>
                  <th className="text-right">Menge</th>
                  <th className="text-right">Einzelpreis</th>
                  <th className="text-right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((it, i) => (
                  <tr key={it.id ?? i}>
                    <td>{it.beschreibung}</td>
                    <td className="text-right">{it.menge}</td>
                    <td className="text-right">{eur(it.einzelpreis)}</td>
                    <td className="text-right">{eur(it.gesamtpreis ?? Number(it.menge) * Number(it.einzelpreis))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            {order.materialkosten ? (
              <div className="flex justify-between"><span className="text-muted">Material</span><span>{eur(order.materialkosten)}</span></div>
            ) : null}
            <div className="flex justify-between"><span className="text-muted">Netto</span><span>{eur(order.nettoSumme)}</span></div>
            <div className="flex justify-between"><span className="text-muted">MwSt</span><span>{eur(order.mwstBetrag)}</span></div>
            <div className="flex justify-between border-t border-base-600 pt-1 font-semibold"><span>Gesamt</span><span>{eur(order.gesamtpreis)}</span></div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">Status</h2>
            <Badge className={ORDER_STATUS_COLOR[order.status]}>
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
            {next.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted">Naechster Schritt</p>
                {next.map((s) => (
                  <button
                    key={s}
                    className="btn-ghost w-full justify-start"
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                  >
                    → {ORDER_STATUS_LABEL[s] ?? s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">Termine</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Start</dt><dd>{datumZeit(order.geplanterStart)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Ende</dt><dd>{datumZeit(order.geplantesEnde)}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">Belege</h2>
            <div className="space-y-2">
              <button className="btn-ghost w-full" disabled={busy} onClick={() => createInvoice('angebot')}>
                Angebot erstellen
              </button>
              <button className="btn-primary w-full" disabled={busy} onClick={() => createInvoice('rechnung')}>
                Rechnung erstellen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuftragDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuftragDetail />
    </Suspense>
  );
}
