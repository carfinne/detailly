'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur, kundenName } from '@/lib/format';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  SERVICE_TYPE_LABEL,
} from '@/lib/labels';
import type { Order, Customer, Vehicle, ServiceItem, Paginated, OrderItem } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

export default function AuftraegePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState('aufbereitung');
  const [materialkosten, setMaterialkosten] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, c, v, s] = await Promise.all([
        api.get<Order[]>('/orders'),
        api.get<Paginated<Customer>>('/customers?limit=200'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<ServiceItem[]>('/services'),
      ]);
      setOrders(o);
      setCustomers(c.data);
      setVehicles(v);
      setServices(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const kundeFahrzeuge = vehicles.filter((v) => v.customerId === customerId);

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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Auftraege"
        subtitle="Zentrale Einheit mit Status-Workflow und Kalkulation"
        action={
          <button className="btn-primary" onClick={() => { resetForm(); setOpen(true); }}>
            Neuer Auftrag
          </button>
        }
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : orders.length === 0 ? (
          <Empty text="Keine Auftraege vorhanden." />
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
                    <td className="font-medium">{o.auftragsnummer}</td>
                    <td>{kundenName(custMap[o.customerId])}</td>
                    <td>{SERVICE_TYPE_LABEL[o.serviceType] ?? o.serviceType}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
                    <td className="text-right">{eur(o.gesamtpreis)}</td>
                    <td className="text-right">
                      <Link href={`/auftraege/${o.id}`} className="text-accent hover:underline">
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

      <Modal open={open} onClose={() => setOpen(false)} title="Neuer Auftrag">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kunde</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }}
                required
              >
                <option value="">– waehlen –</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {kundenName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fahrzeug</label>
              <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">– optional –</option>
                {kundeFahrzeuge.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Leistungsart</label>
              <select className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
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
              <button type="button" className="text-sm text-accent hover:underline" onClick={addItem}>
                + Position
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
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
                      <option value="">aus Leistung uebernehmen…</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({eur(s.basispreis)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.1" className="input" placeholder="Menge" value={it.menge} onChange={(e) => setItem(i, { menge: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3">
                    <input type="number" step="0.01" className="input" placeholder="Einzelpreis" value={it.einzelpreis} onChange={(e) => setItem(i, { einzelpreis: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1 text-sm">
                    <span className="text-muted">{eur(Number(it.menge) * Number(it.einzelpreis))}</span>
                    {items.length > 1 && (
                      <button type="button" className="text-red-400" onClick={() => removeItem(i)}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-base-900/60 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Netto</span><span>{eur(netto)}</span></div>
            <div className="flex justify-between"><span className="text-muted">MwSt (19%)</span><span>{eur(mwst)}</span></div>
            <div className="mt-1 flex justify-between border-t border-base-600 pt-1 font-semibold"><span>Gesamt</span><span>{eur(brutto)}</span></div>
          </div>

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
