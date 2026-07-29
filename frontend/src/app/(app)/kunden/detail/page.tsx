'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, authedFileUrl } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import {
  ORDER_STATUS_KEY, ORDER_STATUS_COLOR,
  INVOICE_STATUS_KEY, INVOICE_STATUS_COLOR,
  APPT_STATUS_KEY, APPT_STATUS_COLOR,
  SERVICE_TYPE_KEY,
} from '@/lib/labels';
import type { Customer, Vehicle, Order, Invoice, Appointment } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, SectionCard, StatCard, Row } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { CustomerFormModal } from '@/components/CustomerFormModal';

const OFFENE_STATUS = ['angefragt', 'kalkuliert', 'bestaetigt', 'in_arbeit', 'qualitaetskontrolle', 'fertig'];
const uhrzeit = (v?: string) => (v ? new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–');

function KundeAkte() {
  const t = useT();
  const id = useSearchParams().get('id') ?? '';
  const [kunde, setKunde] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  // PDF-Fehler getrennt vom Lade-Fehler: ein fehlgeschlagener PDF-Abruf darf
  // nicht die komplette Akte durch eine Fehlerseite ersetzen.
  const [pdfError, setPdfError] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [k, v, o, r, a] = await Promise.all([
        api.get<Customer>(`/customers/${id}`),
        api.get<Vehicle[]>(`/vehicles?customerId=${id}`),
        api.get<Order[]>(`/orders?customerId=${id}`),
        api.get<Invoice[]>(`/invoices?customerId=${id}`),
        api.get<Appointment[]>(`/appointments?customerId=${id}`),
      ]);
      setKunde(k); setVehicles(v); setOrders(o); setInvoices(r); setAppts(a);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('kunden.detail.error.load'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  async function openPdf(invId: string) {
    setPdfError('');
    try {
      const url = await authedFileUrl(`/invoices/${invId}/pdf`);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setPdfError(e instanceof Error ? e.message : t('kunden.detail.error.pdf')); }
  }

  if (error) return <ErrorBox message={error} />;
  if (loading || !kunde) return <Loading />;

  const offeneAuftraege = orders.filter((o) => OFFENE_STATUS.includes(o.status)).length;
  const offeneRechnungen = invoices.filter((i) => i.status === 'offen');
  const offeneSumme = offeneRechnungen.reduce((s, i) => s + Number(i.brutto || 0), 0);
  const bezahltSumme = invoices.filter((i) => i.status === 'bezahlt').reduce((s, i) => s + Number(i.brutto || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={kundenName(kunde)}
        subtitle={t(kunde.type === 'business' ? 'kunden.detail.businessCustomer' : 'kunden.detail.privateCustomer')}
        action={
          <div className="flex flex-wrap gap-2">
            {/* Schnellaktionen: Zielseite oeffnet ihr Anlage-Modal mit dem Kunden
                vorbelegt (Query-Param, wie das ?q=-Muster – ohne Suspense). */}
            <Link href={`/auftraege?kunde=${id}&neu=1`} className="btn-primary btn-sm">
              {t('kunden.action.newOrder')}
            </Link>
            <Link href={`/fahrzeuge?kunde=${id}&neu=1`} className="btn-ghost btn-sm">
              {t('kunden.detail.addVehicle')}
            </Link>
            <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>{t('kunden.action.edit')}</button>
            <Link href="/kunden" className="btn-ghost btn-sm">{t('common.back')}</Link>
          </div>
        }
      />

      {/* Kontakt + Kennzahlen */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={t('kunden.detail.contact')} className="lg:col-span-1">
          <div>
            <Row label={t('kunden.col.email')} value={kunde.email ? <a href={`mailto:${kunde.email}`} className="link-action">{kunde.email}</a> : '–'} />
            <Row label={t('kunden.col.telefon')} value={kunde.phone ? <a href={`tel:${kunde.phone}`} className="link-action">{kunde.phone}</a> : '–'} />
            <Row label={t('kunden.detail.address')} value={[kunde.street, [kunde.postalCode, kunde.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'} />
            {kunde.type === 'business' && <Row label={t('kunden.detail.vatNumber')} value={kunde.vatNumber || '–'} />}
            {kunde.type === 'business' && kunde.leitwegId && <Row label={t('kunden.form.leitwegId.label')} value={kunde.leitwegId} />}
          </div>
        </SectionCard>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatCard label={t('kunden.detail.stat.vehicles')} value={vehicles.length} />
          <StatCard label={t('kunden.detail.stat.openOrders')} value={offeneAuftraege} />
          <StatCard label={t('kunden.detail.stat.openInvoices')} value={eur(offeneSumme)} hint={t('kunden.detail.pieces', { n: offeneRechnungen.length })} accent={offeneSumme > 0} />
          <StatCard label={t('kunden.detail.stat.paidTotal')} value={eur(bezahltSumme)} />
        </div>
      </div>

      {/* Fahrzeuge + Termine */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('kunden.detail.vehicles')} subtitle={t(vehicles.length === 1 ? 'kunden.detail.vehicleCountOne' : 'kunden.detail.vehicleCountMany', { n: vehicles.length })}>
          {vehicles.length === 0 ? <Empty text={t('kunden.detail.emptyVehicles')} /> : (
            <ul className="divide-y divide-ink-700/50">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-chrome-100">{v.make} {v.model} {v.variant && <span className="text-chrome-400">{v.variant}</span>}</p>
                    <p className="truncate text-xs text-chrome-400">{[v.licensePlate, v.year, v.color].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <Link href={`/fahrzeuge/detail/?id=${v.id}`} className="link-action shrink-0 text-sm">{t('kunden.detail.openFile')}</Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('kunden.detail.appointments')} subtitle={t('kunden.detail.newestFirst')}>
          {appts.length === 0 ? <Empty text={t('kunden.detail.emptyAppts')} /> : (
            <ul className="divide-y divide-ink-700/50">
              {appts.slice(0, 8).map((appt) => (
                <li key={appt.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-chrome-400">{uhrzeit(appt.start)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-chrome-100">{appt.titel}</span>
                  <Badge className={APPT_STATUS_COLOR[appt.status] ?? 'badge-neutral'}>{t(APPT_STATUS_KEY[appt.status] ?? appt.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Aufträge */}
      <SectionCard title={t('kunden.detail.orders')} subtitle={t('kunden.detail.totalCount', { n: orders.length })}>
        {orders.length === 0 ? <Empty text={t('kunden.detail.emptyOrders')} /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('auftraege.col.nummer')}</th><th>{t('auftraege.col.leistung')}</th><th>{t('auftraege.col.status')}</th><th>{t('rechnungen.col.datum')}</th><th className="text-end">{t('auftraege.col.gesamt')}</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-chrome-100">{o.auftragsnummer}</td>
                    <td>{t(SERVICE_TYPE_KEY[o.serviceType] ?? o.serviceType)}</td>
                    <td><Badge className={ORDER_STATUS_COLOR[o.status] ?? 'badge-neutral'}>{t(ORDER_STATUS_KEY[o.status] ?? o.status)}</Badge></td>
                    <td className="text-chrome-300">{o.createdAt ? datum(o.createdAt) : '–'}</td>
                    <td className="text-end tabular-nums">{eur(o.gesamtpreis)}</td>
                    <td className="text-end"><Link href={`/auftraege/detail/?id=${o.id}`} className="link-action">{t('auftraege.action.open')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Rechnungen */}
      <SectionCard title={t('kunden.detail.invoices')} subtitle={t('kunden.detail.totalCount', { n: invoices.length })}>
        {pdfError && <ErrorBox message={pdfError} className="mb-3" />}
        {invoices.length === 0 ? <Empty text={t('kunden.detail.emptyInvoices')} /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>{t('rechnungen.col.nummer')}</th><th>{t('rechnungen.col.art')}</th><th>{t('rechnungen.col.status')}</th><th>{t('rechnungen.col.datum')}</th><th className="text-end">{t('rechnungen.col.brutto')}</th><th></th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium text-chrome-100">{i.nummer || '—'}</td>
                    <td>{t(i.art === 'angebot' ? 'rechnungen.kind.angebot' : 'rechnungen.kind.rechnung')}</td>
                    <td><Badge className={INVOICE_STATUS_COLOR[i.status] ?? 'badge-neutral'}>{t(INVOICE_STATUS_KEY[i.status] ?? i.status)}</Badge></td>
                    <td className="text-chrome-300">{i.datum ? datum(i.datum) : '–'}</td>
                    <td className="text-end tabular-nums">{eur(i.brutto)}</td>
                    <td className="text-end">
                      {i.nummer ? <button className="link-action" onClick={() => openPdf(i.id)}>{t('kunden.detail.pdf')}</button> : <span className="text-chrome-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <CustomerFormModal open={edit} onClose={() => setEdit(false)} customer={kunde} onSaved={load} />
    </div>
  );
}

export default function KundeAktePage() {
  return (
    <Suspense fallback={<Loading />}>
      <KundeAkte />
    </Suspense>
  );
}
