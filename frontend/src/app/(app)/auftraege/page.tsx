'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur, kundenName } from '@/lib/format';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  SERVICE_TYPE_LABEL,
} from '@/lib/labels';
import type { Order, Customer, Vehicle, ServiceItem, Paginated, OrderItem } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, RequiredMark } from '@/components/ui';
import { Pager } from '@/components/Pager';

const SEITENGROESSE = 50;

// Status-Reiter fuer die Auftragsliste (Backend filtert auf einen Status).
const STATUS_TABS: { key: 'alle' | 'in_arbeit' | 'fertig'; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'in_arbeit', label: 'In Arbeit' },
  { key: 'fertig', label: 'Fertig' },
];

export default function AuftraegePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  // Status-Reiter: 'alle' | einzelner OrderStatus (Backend filtert auf einen
  // Status). Praxis-Auswahl kompakt: aktueller Arbeitsstand + fertige.
  const [filter, setFilter] = useState<'alle' | 'in_arbeit' | 'fertig'>('alle');

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState('aufbereitung');
  const [materialkosten, setMaterialkosten] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Server-getrieben: Seite, Status-Reiter und Suche laufen in der DB.
      // Der search-Param stammt aus dem Backend-Stack (#106) – ein aelteres
      // Backend ignoriert ihn still (unbekannter Query-Key), sodass die Suche
      // sauber degradiert (Liste bleibt vollstaendig, kein Fehler).
      const params = new URLSearchParams({ page: String(page), limit: String(SEITENGROESSE) });
      if (filter !== 'alle') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const [o, c, v, s] = await Promise.all([
        api.get<Paginated<Order>>(`/orders?${params.toString()}`),
        api.get<Customer[]>('/customers/select'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<ServiceItem[]>('/services'),
      ]);
      setOrders(o.data);
      setTotal(o.total);
      setCustomers(c);
      setVehicles(v);
      setServices(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  // Entprellt (250ms): faengt schnelles Tippen in der Suche ab.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Vorbelegung aus der Kundenakte: /auftraege?kunde=<id>&neu=1 oeffnet das
  // Anlage-Modal mit gesetztem Kunden. Genau EINMAL auswerten (Ref-Guard) und
  // den Param danach aus der URL entfernen, damit Reload/Zurueck das Modal
  // nicht erneut oeffnet. Erst nach dem Laden der Kunden greifen, damit die
  // Vorbelegung nur bei bekanntem Kunden gesetzt wird.
  const paramVerarbeitet = useRef(false);
  useEffect(() => {
    if (paramVerarbeitet.current || customers.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('neu') !== '1') return;
    paramVerarbeitet.current = true;
    const kunde = params.get('kunde') ?? '';
    resetForm();
    if (kunde && customers.some((c) => c.id === kunde)) setCustomerId(kunde);
    setModalError('');
    setOpen(true);
    // Query-Param entfernen (ohne Navigation/Scroll), damit er nicht erneut greift.
    window.history.replaceState(null, '', window.location.pathname);
  }, [customers]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const kundeFahrzeuge = vehicles.filter((v) => v.customerId === customerId);
  // Ist eine Suche/ein Status-Filter aktiv? Steuert Filterleiste + Empty-Text.
  const filterAktiv = search.trim() !== '' || filter !== 'alle';

  function setItem(i: number, patch: Partial<OrderItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { beschreibung: '', menge: 1, einzelpreis: 0 }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function pickService(i: number, serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    if (s) setItem(i, { beschreibung: s.name, einzelpreis: Number(s.basispreis) });
  }

  const netto =
    items.reduce((sum, it) => sum + Number(it.menge) * Number(it.einzelpreis), 0) +
    Number(materialkosten || 0);
  const mwst = Math.round(netto * 0.19 * 100) / 100;
  const brutto = Math.round((netto + mwst) * 100) / 100;

  function resetForm() {
    setCustomerId('');
    setVehicleId('');
    setServiceType('aufbereitung');
    setMaterialkosten('');
    setItems([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customerId,
        serviceType,
        items: items
          .filter((it) => it.beschreibung.trim())
          .map((it) => ({
            beschreibung: it.beschreibung,
            menge: Number(it.menge),
            einzelpreis: Number(it.einzelpreis),
          })),
      };
      if (vehicleId) payload.vehicleId = vehicleId;
      if (materialkosten) payload.materialkosten = Number(materialkosten);
      await api.post('/orders', payload);
      setOpen(false);
      resetForm();
      // Neuer Auftrag erscheint oben auf Seite 1.
      if (page !== 1) setPage(1);
      else await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Aufträge"
        subtitle="Zentrale Einheit mit Status-Workflow und Kalkulation"
        action={
          <button className="btn-primary" onClick={() => { resetForm(); setModalError(''); setOpen(true); }}>
            Neuer Auftrag
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      {!loading && (total > 0 || filterAktiv) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Suche nach Nummer oder Kunde…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div className="seg-group">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setFilter(t.key); setPage(1); }}
                className={`seg ${filter === t.key ? 'seg-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {loading ? (
          <Loading />
        ) : orders.length === 0 ? (
          filterAktiv ? (
            <Empty text="Keine Aufträge in dieser Ansicht." />
          ) : (
            <Empty
              text="Noch keine Aufträge angelegt."
              action={
                <button
                  className="btn-primary btn-sm"
                  onClick={() => { resetForm(); setModalError(''); setOpen(true); }}
                >
                  Ersten Auftrag anlegen
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nummer</th>
                  <th>Kunde</th>
                  <th>Leistung</th>
                  <th>Status</th>
                  <th className="text-right">Gesamt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium">
                      <Link href={`/auftraege/detail/?id=${o.id}`} className="link-row">
                        {o.auftragsnummer}
                      </Link>
                    </td>
                    <td>
                      {o.customerId ? (
                        <Link href={`/kunden/detail/?id=${o.customerId}`} className="link-row">
                          {kundenName(custMap[o.customerId])}
                        </Link>
                      ) : (
                        kundenName(custMap[o.customerId])
                      )}
                    </td>
                    <td>{SERVICE_TYPE_LABEL[o.serviceType] ?? o.serviceType}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
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
      </div>

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title="Neuer Auftrag">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Kunde<RequiredMark /></label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }}
                required
              >
                <option value="">– wählen –</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {kundenName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fahrzeug</label>
              <select className="select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">– optional –</option>
                {kundeFahrzeuge.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Leistungsart</label>
              <select className="select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="aufbereitung">Aufbereitung</option>
                <option value="folierung">Folierung</option>
                <option value="ppf">PPF</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="label">Materialkosten (netto)</label>
              <input type="number" step="0.01" className="input" value={materialkosten} onChange={(e) => setMaterialkosten(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Positionen</label>
              <button type="button" className="link-action text-sm" onClick={addItem}>
                + Position
              </button>
            </div>
            {/* Mobil: Beschreibung volle Breite, darunter Menge/Preis/Summe. */}
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      className="input"
                      placeholder="Beschreibung"
                      value={it.beschreibung}
                      onChange={(e) => setItem(i, { beschreibung: e.target.value })}
                    />
                    <select
                      className="input mt-1 text-xs"
                      value=""
                      onChange={(e) => e.target.value && pickService(i, e.target.value)}
                    >
                      <option value="">aus Leistung übernehmen…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({eur(s.basispreis)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input type="number" step="0.1" className="input" placeholder="Menge" value={it.menge} onChange={(e) => setItem(i, { menge: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input type="number" step="0.01" className="input" placeholder="Einzelpreis" value={it.einzelpreis} onChange={(e) => setItem(i, { einzelpreis: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-4 flex items-center justify-end gap-1 text-sm sm:col-span-2">
                    <span className="text-chrome-400">{eur(Number(it.menge) * Number(it.einzelpreis))}</span>
                    {items.length > 1 && (
                      <button type="button" className="link-danger" onClick={() => removeItem(i)}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-ink-900/60 p-3 text-sm">
            <div className="flex justify-between"><span className="text-chrome-400">Netto</span><span>{eur(netto)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">MwSt (19%)</span><span>{eur(mwst)}</span></div>
            <div className="mt-1 flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>Gesamt</span><span>{eur(brutto)}</span></div>
          </div>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Speichern…' : 'Auftrag anlegen'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
