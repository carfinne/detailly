'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, appPath } from '@/lib/api';
import { eur, datumZeit } from '@/lib/format';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_NEXT,
  SERVICE_TYPE_LABEL,
} from '@/lib/labels';
import type { Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Badge } from '@/components/ui';
import { LeistungDetailsEditor } from '@/components/LeistungDetailsEditor';
import { FotoBereich } from '@/components/FotoBereich';
import { OrderTimeCard } from '@/components/OrderTimeCard';
import { OrderMaterialCard } from '@/components/OrderMaterialCard';
import { ProfitabilityCard } from '@/components/ProfitabilityCard';

function AuftragDetail() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mwstSatz, setMwstSatz] = useState(19);
  const [trackToken, setTrackToken] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const trackUrl = trackToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${appPath('/track/')}?t=${trackToken}`
    : '';

  async function loadTrackingLink() {
    setTrackBusy(true);
    try {
      const res = await api.post<{ token: string }>(`/orders/${id}/tracking-token`);
      setTrackToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tracking-Link konnte nicht erstellt werden');
    } finally {
      setTrackBusy(false);
    }
  }

  async function regenerateTrackingLink() {
    if (!window.confirm('Neuen Link erzeugen? Der bisherige Link wird damit ungültig.')) return;
    setTrackBusy(true);
    try {
      const res = await api.post<{ token: string }>(`/orders/${id}/tracking-token/regenerate`);
      setTrackToken(res.token);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link konnte nicht neu erzeugt werden');
    } finally {
      setTrackBusy(false);
    }
  }

  async function copyTrackUrl() {
    try {
      await navigator.clipboard.writeText(trackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage gesperrt – Nutzer kann den markierten Text manuell kopieren. */
    }
  }

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
      await api.post(`/invoices/from-order/${id}?art=${art}&mwstSatz=${mwstSatz}`);
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
              <div className="flex justify-between"><span className="text-chrome-400">Material</span><span>{eur(order.materialkosten)}</span></div>
            ) : null}
            <div className="flex justify-between"><span className="text-chrome-400">Netto</span><span>{eur(order.nettoSumme)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">MwSt</span><span>{eur(order.mwstBetrag)}</span></div>
            <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>Gesamt</span><span>{eur(order.gesamtpreis)}</span></div>
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
                <p className="text-xs uppercase tracking-wide text-chrome-400">Naechster Schritt</p>
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

          {(order.customerId || order.vehicleId) && (
            <div className="card">
              <h2 className="mb-3 text-lg font-semibold">Verknüpfungen</h2>
              <div className="space-y-1.5 text-sm">
                {order.customerId && (
                  <Link href={`/kunden/detail/?id=${order.customerId}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-chrome-200 hover:bg-ink-750 hover:text-copper">
                    <span>Zum Kunden</span><span aria-hidden>→</span>
                  </Link>
                )}
                {order.vehicleId && (
                  <Link href={`/fahrzeuge/detail/?id=${order.vehicleId}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-chrome-200 hover:bg-ink-750 hover:text-copper">
                    <span>Zum Fahrzeug</span><span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="mb-1 text-lg font-semibold">Kunden-Tracking</h2>
            <p className="mb-3 text-sm text-chrome-400">
              Link zum Mitverfolgen des Status – ohne Login, ideal für die Bestätigungs-Mail.
            </p>
            {!trackToken ? (
              <button className="btn-ghost w-full" disabled={trackBusy} onClick={loadTrackingLink}>
                {trackBusy ? 'Erzeuge…' : 'Tracking-Link erzeugen'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    aria-label="Tracking-Link"
                    value={trackUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="input text-xs"
                  />
                  <button className="btn-ghost shrink-0" onClick={copyTrackUrl}>
                    {copied ? 'Kopiert!' : 'Kopieren'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-copper hover:underline">
                    Vorschau öffnen
                  </a>
                  <button
                    className="text-xs text-chrome-500 hover:text-chrome-300 disabled:opacity-50"
                    disabled={trackBusy}
                    onClick={regenerateTrackingLink}
                  >
                    Neu erzeugen
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">Termine</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-chrome-400">Start</dt><dd>{datumZeit(order.geplanterStart)}</dd></div>
              <div className="flex justify-between"><dt className="text-chrome-400">Ende</dt><dd>{datumZeit(order.geplantesEnde)}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">Belege</h2>
            <div className="field mb-3">
              <label className="label" htmlFor="mwstSatz">MwSt-Satz</label>
              <select
                id="mwstSatz"
                className="input"
                value={mwstSatz}
                onChange={(e) => setMwstSatz(Number(e.target.value))}
                disabled={busy}
              >
                <option value={19}>19 % (Regelsatz)</option>
                <option value={7}>7 % (ermäßigt)</option>
                <option value={0}>0 % (Kleinunternehmer §19)</option>
              </select>
            </div>
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

      {/* Arbeitszeit (Job-Costing) + branchenspezifische Leistungsdetails + Fotos */}
      <div className="mt-4 space-y-4">
        <ProfitabilityCard orderId={order.id} />
        <OrderTimeCard orderId={order.id} nettoSumme={Number(order.nettoSumme) || undefined} />
        <OrderMaterialCard orderId={order.id} />
        <LeistungDetailsEditor
          orderId={order.id}
          serviceType={order.serviceType}
          initial={order.leistungDetails}
        />
        <FotoBereich order={order} onChange={setOrder} />
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
