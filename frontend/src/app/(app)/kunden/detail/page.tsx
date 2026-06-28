'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, authedFileUrl } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_COLOR,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_COLOR,
  APPT_STATUS_LABEL, APPT_STATUS_COLOR,
  SERVICE_TYPE_LABEL,
} from '@/lib/labels';
import type { Customer, Vehicle, Order, Invoice, Appointment } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, SectionCard } from '@/components/ui';
import { CustomerFormModal } from '@/components/CustomerFormModal';

const OFFENE_STATUS = ['angefragt', 'kalkuliert', 'bestaetigt', 'in_arbeit', 'qualitaetskontrolle', 'fertig'];
const uhrzeit = (v?: string) => (v ? new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–');

function KundeAkte() {
  const id = useSearchParams().get('id') ?? '';
  const [kunde, setKunde] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
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
      setError(e instanceof Error ? e.message : 'Kunde konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function openPdf(invId: string) {
    try {
      const url = await authedFileUrl(`/invoices/${invId}/pdf`);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { setError(e instanceof Error ? e.message : 'PDF konnte nicht geladen werden'); }
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
        subtitle={kunde.type === 'business' ? 'Geschäftskunde' : 'Privatkunde'}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setEdit(true)}>Bearbeiten</button>
            <Link href="/kunden" className="btn-ghost">Zurück</Link>
          </div>
        }
      />

      {/* Kontakt + Kennzahlen */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Kontakt" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            <Row k="E-Mail" v={kunde.email ? <a href={`mailto:${kunde.email}`} className="text-copper hover:underline">{kunde.email}</a> : '–'} />
            <Row k="Telefon" v={kunde.phone ? <a href={`tel:${kunde.phone}`} className="text-copper hover:underline">{kunde.phone}</a> : '–'} />
            <Row k="Adresse" v={[kunde.street, [kunde.postalCode, kunde.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'} />
            {kunde.type === 'business' && <Row k="USt-IdNr." v={kunde.vatNumber || '–'} />}
          </dl>
        </SectionCard>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <Kpi label="Fahrzeuge" value={String(vehicles.length)} />
          <Kpi label="Offene Aufträge" value={String(offeneAuftraege)} />
          <Kpi label="Offene Rechnungen" value={eur(offeneSumme)} hint={`${offeneRechnungen.length} Stück`} accent={offeneSumme > 0} />
          <Kpi label="Bezahlt gesamt" value={eur(bezahltSumme)} />
        </div>
      </div>

      {/* Fahrzeuge + Termine */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Fahrzeuge" subtitle={`${vehicles.length} Fahrzeug${vehicles.length === 1 ? '' : 'e'}`}>
          {vehicles.length === 0 ? <Empty text="Keine Fahrzeuge hinterlegt." /> : (
            <ul className="divide-y divide-ink-700/50">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-chrome-100">{v.make} {v.model} {v.variant && <span className="text-chrome-400">{v.variant}</span>}</p>
                    <p className="truncate text-xs text-chrome-400">{[v.licensePlate, v.year, v.color].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <Link href={`/fahrzeuge/detail/?id=${v.id}`} className="shrink-0 text-sm text-copper hover:underline">Akte</Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Termine" subtitle="Neueste zuerst">
          {appts.length === 0 ? <Empty text="Keine Termine." /> : (
            <ul className="divide-y divide-ink-700/50">
              {appts.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-chrome-400">{uhrzeit(t.start)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-chrome-100">{t.titel}</span>
                  <Badge className={APPT_STATUS_COLOR[t.status] ?? 'badge-neutral'}>{APPT_STATUS_LABEL[t.status] ?? t.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Aufträge */}
      <SectionCard title="Aufträge" subtitle={`${orders.length} gesamt`}>
        {orders.length === 0 ? <Empty text="Noch keine Aufträge." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Nummer</th><th>Leistung</th><th>Status</th><th>Datum</th><th className="text-right">Gesamt</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-chrome-100">{o.auftragsnummer}</td>
                    <td>{SERVICE_TYPE_LABEL[o.serviceType] ?? o.serviceType}</td>
                    <td><Badge className={ORDER_STATUS_COLOR[o.status] ?? 'badge-neutral'}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                    <td className="text-chrome-300">{o.createdAt ? datum(o.createdAt) : '–'}</td>
                    <td className="text-right tabular-nums">{eur(o.gesamtpreis)}</td>
                    <td className="text-right"><Link href={`/auftraege/detail/?id=${o.id}`} className="text-copper hover:underline">Öffnen</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Rechnungen */}
      <SectionCard title="Rechnungen & Angebote" subtitle={`${invoices.length} gesamt`}>
        {invoices.length === 0 ? <Empty text="Noch keine Belege." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Nummer</th><th>Art</th><th>Status</th><th>Datum</th><th className="text-right">Brutto</th><th></th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium text-chrome-100">{i.nummer || '—'}</td>
                    <td>{i.art === 'angebot' ? 'Angebot' : 'Rechnung'}</td>
                    <td><Badge className={INVOICE_STATUS_COLOR[i.status] ?? 'badge-neutral'}>{INVOICE_STATUS_LABEL[i.status] ?? i.status}</Badge></td>
                    <td className="text-chrome-300">{i.datum ? datum(i.datum) : '–'}</td>
                    <td className="text-right tabular-nums">{eur(i.brutto)}</td>
                    <td className="text-right">
                      {i.nummer ? <button className="text-copper hover:underline" onClick={() => openPdf(i.id)}>PDF</button> : <span className="text-chrome-600">—</span>}
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-700/50 pb-1.5">
      <dt className="text-chrome-400">{k}</dt>
      <dd className="text-right text-chrome-100">{v}</dd>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-chrome-500">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${accent ? 'text-copper' : 'text-chrome-50'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-chrome-500">{hint}</p>}
    </div>
  );
}
