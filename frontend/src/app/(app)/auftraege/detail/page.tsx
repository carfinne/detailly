'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, appPath, downloadAuthed } from '@/lib/api';
import { eur, datumZeit } from '@/lib/format';
import {
  ORDER_STATUS_KEY,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_NEXT,
  SERVICE_TYPE_KEY,
} from '@/lib/labels';
import type { Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Badge, SectionCard, ConfirmDialog, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { LeistungDetailsEditor } from '@/components/LeistungDetailsEditor';
import { AngebotsSetDialog } from '@/components/AngebotsSetDialog';
import { AnzahlungDialog } from '@/components/AnzahlungDialog';
import { FotoBereich } from '@/components/FotoBereich';
import { OrderTimeCard } from '@/components/OrderTimeCard';
import { OrderMaterialCard } from '@/components/OrderMaterialCard';
import { ProfitabilityCard } from '@/components/ProfitabilityCard';

function AuftragDetail() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mwstSatz, setMwstSatz] = useState(19);
  const [trackToken, setTrackToken] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [anzahlungOpen, setAnzahlungOpen] = useState(false);
  const [uebergabeBusy, setUebergabeBusy] = useState(false);
  const toast = useToast();

  const trackUrl = trackToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${appPath('/track/')}?t=${trackToken}`
    : '';

  async function loadTrackingLink() {
    setTrackBusy(true);
    try {
      const res = await api.post<{ token: string }>(`/orders/${id}/tracking-token`);
      setTrackToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auftraege.detail.error.trackCreate'));
    } finally {
      setTrackBusy(false);
    }
  }

  async function regenerateTrackingLink() {
    setTrackBusy(true);
    try {
      const res = await api.post<{ token: string }>(`/orders/${id}/tracking-token/regenerate`);
      setTrackToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auftraege.detail.error.trackRegen'));
    } finally {
      setTrackBusy(false);
      setConfirmRegenerate(false);
    }
  }

  async function copyTrackUrl() {
    try {
      await navigator.clipboard.writeText(trackUrl);
      toast(t('auftraege.detail.tracking.copied'));
    } catch {
      /* Zwischenablage gesperrt – Nutzer kann den markierten Text manuell kopieren. */
    }
  }

  const load = useCallback(async () => {
    try {
      setOrder(await api.get<Order>(`/orders/${id}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  }, [id, t]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function changeStatus(status: string) {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auftraege.detail.error.statusChange'));
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
      setError(e instanceof Error ? e.message : t('auftraege.detail.error.invoiceCreate'));
      setBusy(false);
    }
  }

  // Übergabe-/Garantiedokument (PDF) tenant-sicher per Bearer-Token herunterladen.
  async function downloadUebergabe() {
    if (!order) return;
    setUebergabeBusy(true);
    try {
      await downloadAuthed(`/orders/${id}/uebergabe-pdf`, `Uebergabe_${order.auftragsnummer}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auftraege.detail.error.handoverPdf'));
    } finally {
      setUebergabeBusy(false);
    }
  }

  // Full-Page-Fehler nur, wenn der Auftrag selbst nicht geladen werden konnte.
  if (error && !order) return <ErrorBox message={error} />;
  if (!order) return <Loading />;

  const next = ORDER_STATUS_NEXT[order.status] ?? [];

  return (
    <div>
      <PageHeader
        title={order.auftragsnummer}
        subtitle={t(SERVICE_TYPE_KEY[order.serviceType] ?? order.serviceType)}
        action={
          <Link href="/auftraege" className="btn-ghost">
            {t('common.back')}
          </Link>
        }
      />

      {/* Aktionsfehler (Status, Belege, Tracking) inline – die Seite bleibt bedienbar. */}
      {error && <ErrorBox message={error} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title={t('auftraege.form.positionen')} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('auftraege.form.beschreibung')}</th>
                  <th className="text-right">{t('auftraege.form.menge')}</th>
                  <th className="text-right">{t('auftraege.form.einzelpreis')}</th>
                  <th className="text-right">{t('auftraege.col.gesamt')}</th>
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
              <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.material')}</span><span>{eur(order.materialkosten)}</span></div>
            ) : null}
            <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.form.netto')}</span><span>{eur(order.nettoSumme)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.mwst')}</span><span>{eur(order.mwstBetrag)}</span></div>
            <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('auftraege.col.gesamt')}</span><span>{eur(order.gesamtpreis)}</span></div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title={t('auftraege.col.status')}>
            <Badge className={ORDER_STATUS_COLOR[order.status]}>
              {t(ORDER_STATUS_KEY[order.status] ?? order.status)}
            </Badge>
            {next.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-chrome-400">{t('auftraege.detail.nextStep')}</p>
                {next.map((s) => (
                  <button
                    key={s}
                    className="btn-ghost w-full justify-start"
                    disabled={busy}
                    onClick={() => changeStatus(s)}
                  >
                    → {t(ORDER_STATUS_KEY[s] ?? s)}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {(order.customerId || order.vehicleId) && (
            <SectionCard title={t('auftraege.detail.links')}>
              <div className="space-y-1.5 text-sm">
                {order.customerId && (
                  <Link href={`/kunden/detail/?id=${order.customerId}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-chrome-200 hover:bg-ink-750 hover:text-copper">
                    <span>{t('auftraege.detail.toCustomer')}</span><span aria-hidden>→</span>
                  </Link>
                )}
                {order.vehicleId && (
                  <Link href={`/fahrzeuge/detail/?id=${order.vehicleId}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-chrome-200 hover:bg-ink-750 hover:text-copper">
                    <span>{t('auftraege.detail.toVehicle')}</span><span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title={t('auftraege.detail.tracking.title')}
            subtitle={t('auftraege.detail.tracking.subtitle')}
          >
            {!trackToken ? (
              <button className="btn-ghost w-full" disabled={trackBusy} onClick={loadTrackingLink}>
                {trackBusy ? t('auftraege.detail.tracking.creating') : t('auftraege.detail.tracking.create')}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    aria-label={t('auftraege.detail.tracking.linkLabel')}
                    value={trackUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="input text-xs"
                  />
                  <button className="btn-ghost shrink-0" onClick={copyTrackUrl}>
                    {t('auftraege.detail.tracking.copy')}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="link-action text-xs">
                    {t('auftraege.detail.tracking.preview')}
                  </a>
                  <button
                    className="rounded text-xs text-chrome-500 hover:text-chrome-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
                    disabled={trackBusy}
                    onClick={() => setConfirmRegenerate(true)}
                  >
                    {t('auftraege.detail.tracking.regenerate')}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('auftraege.detail.appointments')}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-chrome-400">{t('auftraege.detail.start')}</dt><dd>{datumZeit(order.geplanterStart)}</dd></div>
              <div className="flex justify-between"><dt className="text-chrome-400">{t('auftraege.detail.end')}</dt><dd>{datumZeit(order.geplantesEnde)}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard title={t('auftraege.detail.documents')}>
            <div className="field mb-3">
              <label className="label" htmlFor="mwstSatz">{t('auftraege.detail.vatRate')}</label>
              <select
                id="mwstSatz"
                className="input"
                value={mwstSatz}
                onChange={(e) => setMwstSatz(Number(e.target.value))}
                disabled={busy}
              >
                <option value={19}>{t('auftraege.detail.vat.standard')}</option>
                <option value={7}>{t('auftraege.detail.vat.reduced')}</option>
                <option value={0}>{t('auftraege.detail.vat.none')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <button className="btn-ghost w-full" disabled={busy} onClick={() => createInvoice('angebot')}>
                {t('auftraege.detail.createQuote')}
              </button>
              <button
                className="btn-ghost w-full"
                disabled={busy || !order.customerId}
                onClick={() => setSetDialogOpen(true)}
                title={!order.customerId ? t('angebote.set.errorNoCustomer') : undefined}
              >
                {t('auftraege.detail.createVariants')}
              </button>
              <button className="btn-primary w-full" disabled={busy} onClick={() => createInvoice('rechnung')}>
                {t('auftraege.detail.createInvoice')}
              </button>
            </div>
            <div className="mt-3 space-y-2 border-t border-ink-700/70 pt-3">
              <button
                className="btn-ghost w-full"
                disabled={busy || !order.customerId}
                onClick={() => setAnzahlungOpen(true)}
              >
                {t('auftraege.detail.createDeposit')}
              </button>
              <button className="btn-ghost w-full" disabled={uebergabeBusy} onClick={downloadUebergabe}>
                {uebergabeBusy && <span className="spinner" />}
                {uebergabeBusy ? t('auftraege.detail.handoverPdfLoading') : t('auftraege.detail.handoverPdf')}
              </button>
            </div>
          </SectionCard>
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

      <ConfirmDialog
        open={confirmRegenerate}
        title={t('auftraege.detail.regenConfirm.title')}
        message={t('auftraege.detail.regenConfirm.msg')}
        confirmLabel={t('auftraege.detail.tracking.regenerate')}
        busy={trackBusy}
        onConfirm={regenerateTrackingLink}
        onCancel={() => setConfirmRegenerate(false)}
      />

      {setDialogOpen && (
        <AngebotsSetDialog
          open={setDialogOpen}
          onClose={() => setSetDialogOpen(false)}
          order={order}
          mwstSatz={mwstSatz}
          onCreated={() => {
            setSetDialogOpen(false);
            router.push('/rechnungen');
          }}
        />
      )}

      <AnzahlungDialog
        open={anzahlungOpen}
        onClose={() => setAnzahlungOpen(false)}
        orderId={order.id}
        basisBrutto={Number(order.gesamtpreis) || undefined}
        onCreated={() => {
          toast(t('angebote.anzahlung.success'));
          router.push('/rechnungen');
        }}
      />
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
