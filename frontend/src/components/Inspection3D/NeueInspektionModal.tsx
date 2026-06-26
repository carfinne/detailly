'use client';

// NeueInspektionModal: gekapseltes Anlege-Formular fuer eine neue Inspektion.
// Laedt selbststaendig Kunden / Fahrzeuge / Auftraege + bestehende Inspektionen
// (fuer das Vor-Inspektion-Dropdown beim Carry-over) und ruft POST /inspections.
// Backend-Vertrag (CreateInspectionDto): PFLICHT customerId + typ
// ('annahme'|'gutachten'|'ausgang'); optional vehicleId, orderId,
// previousInspectionId (Carry-over nur bei typ=ausgang), kmStand (int>=0),
// tankstand (0-100), notiz. tenantId kommt NIE aus dem Body.

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal, ErrorBox } from '@/components/ui';
import { kundenName } from '@/lib/format';
import { INSPECTION_TYP_LABEL } from '@/lib/labels';
import type {
  Customer,
  Vehicle,
  Order,
  Paginated,
  DamageInspection,
  InspectionTyp,
} from '@/lib/types';

const TYP_OPTIONS: InspectionTyp[] = ['annahme', 'gutachten', 'ausgang'];

export default function NeueInspektionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (inspection: DamageInspection) => void;
}) {
  // Datenquellen fuer die Dropdowns.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inspections, setInspections] = useState<DamageInspection[]>([]);

  // Formularfelder.
  const [customerId, setCustomerId] = useState('');
  const [typ, setTyp] = useState<InspectionTyp>('annahme');
  const [vehicleId, setVehicleId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [previousInspectionId, setPreviousInspectionId] = useState('');
  const [kmStand, setKmStand] = useState('');
  const [tankstand, setTankstand] = useState('');
  const [notiz, setNotiz] = useState('');

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setCustomerId('');
    setTyp('annahme');
    setVehicleId('');
    setOrderId('');
    setPreviousInspectionId('');
    setKmStand('');
    setTankstand('');
    setNotiz('');
    setError('');
  }

  // Stammdaten laden, sobald der Dialog geoeffnet wird.
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [c, v, o, insp] = await Promise.all([
        api.get<Customer[]>('/customers/select'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<Order[]>('/orders'),
        api.get<DamageInspection[]>('/inspections'),
      ]);
      setCustomers(c); // /customers/select -> direktes Array (ohne Cap)
      setVehicles(v); // /vehicles ist direktes Array
      setOrders(o); // /orders ist direktes Array
      setInspections(insp); // /inspections ist direktes Array
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Stammdaten konnten nicht geladen werden');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      resetForm();
      loadData();
    }
  }, [open, loadData]);

  // Fahrzeuge sind an einen Kunden gekoppelt (Vehicle.customerId).
  const kundeFahrzeuge = vehicles.filter((vv) => vv.customerId === customerId);
  // Auftraege analog auf den gewaehlten Kunden filtern.
  const kundeAuftraege = orders.filter((oo) => oo.customerId === customerId);
  // Vor-Inspektionen (Carry-over): sinnvoll nur fuer denselben Kunden.
  const vorInspektionen = inspections.filter(
    (ii) => !customerId || ii.customerId === customerId,
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError('Bitte einen Kunden waehlen.');
      return;
    }
    if (!typ) {
      setError('Bitte einen Inspektionstyp waehlen.');
      return;
    }
    setSaving(true);
    try {
      // Optionale Felder nur senden, wenn gesetzt.
      const body: Record<string, unknown> = { customerId, typ };
      if (vehicleId) body.vehicleId = vehicleId;
      if (orderId) body.orderId = orderId;
      // Carry-over feuert backend-seitig NUR bei typ=ausgang + previousInspectionId.
      if (typ === 'ausgang' && previousInspectionId) {
        body.previousInspectionId = previousInspectionId;
      }
      if (kmStand !== '') body.kmStand = Number(kmStand);
      if (tankstand !== '') body.tankstand = Number(tankstand);
      if (notiz.trim()) body.notiz = notiz.trim();

      const created = await api.post<DamageInspection>('/inspections', body);
      onCreated(created);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inspektion konnte nicht angelegt werden');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Neue Inspektion">
      <form onSubmit={save} className="space-y-4">
        {error && <ErrorBox message={error} />}

        <div>
          <label className="label">Kunde *</label>
          <select
            className="select"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              // Abhaengige Felder zuruecksetzen, sonst bleibt Fremd-Auswahl stehen.
              setVehicleId('');
              setOrderId('');
              setPreviousInspectionId('');
            }}
            required
            disabled={loadingData}
          >
            <option value="">{loadingData ? 'Lädt…' : '– wählen –'}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {kundenName(c)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Typ *</label>
          <select
            className="select"
            value={typ}
            onChange={(e) => setTyp(e.target.value as InspectionTyp)}
            required
          >
            {TYP_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {INSPECTION_TYP_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Fahrzeug</label>
          <select
            className="select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            disabled={!customerId}
          >
            <option value="">– optional –</option>
            {kundeFahrzeuge.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} {v.licensePlate ? `(${v.licensePlate})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Auftrag</label>
          <select
            className="select"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={!customerId}
          >
            <option value="">– optional –</option>
            {kundeAuftraege.map((o) => (
              <option key={o.id} value={o.id}>
                {o.auftragsnummer}
              </option>
            ))}
          </select>
        </div>

        {/* Vor-Inspektion fuer Carry-over nur bei Ausgangs-Inspektion. */}
        {typ === 'ausgang' && (
          <div>
            <label className="label">Vor-Inspektion (Vorschäden übernehmen)</label>
            <select
              className="select"
              value={previousInspectionId}
              onChange={(e) => setPreviousInspectionId(e.target.value)}
            >
              <option value="">– keine –</option>
              {vorInspektionen.map((ii) => (
                <option key={ii.id} value={ii.id}>
                  {(ii.typ ? INSPECTION_TYP_LABEL[ii.typ] : 'Inspektion')} · {ii.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <p className="help mt-1.5">
              Bei Auswahl werden die Schäden der gewählten Inspektion als Vorschäden kopiert.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Kilometerstand</label>
            <input
              type="number"
              min={0}
              className="input"
              value={kmStand}
              onChange={(e) => setKmStand(e.target.value)}
              placeholder="z. B. 84500"
            />
          </div>
          <div>
            <label className="label">Tankstand (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={tankstand}
              onChange={(e) => setTankstand(e.target.value)}
              placeholder="0–100"
            />
          </div>
        </div>

        <div>
          <label className="label">Notiz</label>
          <textarea
            className="textarea"
            rows={3}
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Optionaler Vermerk zur Inspektion"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={saving || loadingData}>
            {saving ? 'Speichern…' : 'Inspektion anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
