'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import {
  SCHADEN_ART_LABEL,
  SCHWEREGRAD_LABEL,
  SCHWEREGRAD_BADGE,
  SCHWEREGRAD_COLOR,
} from '@/lib/labels';
import type { Customer, Vehicle, SchadensMarker, Paginated } from '@/lib/types';
import { PageHeader, ErrorBox, Empty, Badge, Modal, SectionCard } from '@/components/ui';
import { FahrzeugDiagramm, ANSICHTEN, type Ansicht } from '@/components/FahrzeugDiagramm';

// Einfache ID fuer neue Marker (Demo – kein crypto-UUID-Zwang noetig).
function neueId(): string {
  return `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

const ART_OPTIONEN = Object.keys(SCHADEN_ART_LABEL);
const GRAD_OPTIONEN = Object.keys(SCHWEREGRAD_LABEL);

export default function FahrzeugannahmePage() {
  const router = useRouter();
  const [kunden, setKunden] = useState<Customer[]>([]);
  const [fahrzeuge, setFahrzeuge] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [erfolg, setErfolg] = useState('');
  const [busy, setBusy] = useState(false);

  // Annahme-Formular
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [kmStand, setKmStand] = useState('');
  const [tankstand, setTankstand] = useState('50');
  const [notiz, setNotiz] = useState('');

  // Schadensdiagramm
  const [ansicht, setAnsicht] = useState<Ansicht>('oben');
  const [marker, setMarker] = useState<SchadensMarker[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Customer>>('/customers?limit=200'),
      api.get<Vehicle[]>('/vehicles'),
    ])
      .then(([k, f]) => {
        setKunden(k.data ?? []);
        setFahrzeuge(Array.isArray(f) ? f : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Fahrzeuge des gewaehlten Kunden (sonst alle).
  const fahrzeugAuswahl = useMemo(
    () => (customerId ? fahrzeuge.filter((f) => f.customerId === customerId) : fahrzeuge),
    [fahrzeuge, customerId],
  );

  const editMarker = marker.find((m) => m.id === editId) ?? null;

  // Neuer Marker an Klickposition; oeffnet direkt den Editor.
  function addMarker(x: number, y: number, zone?: string) {
    const m: SchadensMarker = {
      id: neueId(),
      ansicht,
      x,
      y,
      zone,
      art: 'kratzer',
      schweregrad: 'leicht',
    };
    setMarker((prev) => [...prev, m]);
    setEditId(m.id);
  }

  function updateMarker(id: string, patch: Partial<SchadensMarker>) {
    setMarker((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMarker(id: string) {
    setMarker((prev) => prev.filter((m) => m.id !== id));
    if (editId === id) setEditId(null);
  }

  async function speichern() {
    if (!customerId) {
      setError('Bitte einen Kunden auswählen.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/fahrzeugannahme', {
        customerId,
        vehicleId: vehicleId || undefined,
        kmStand: kmStand ? Number(kmStand) : undefined,
        tankstand: tankstand ? Number(tankstand) : undefined,
        marker,
        notiz: notiz || undefined,
      });
      setErfolg('Annahme gespeichert.');
      setTimeout(() => router.push('/auftraege'), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fahrzeugannahme"
        subtitle="Zustand dokumentieren und Schäden im Diagramm erfassen"
        action={
          <button className="btn-primary" disabled={busy} onClick={speichern}>
            Annahme speichern
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}
      {erfolg && (
        <div className="mb-4 rounded-xl border border-positive/30 bg-positive-soft px-4 py-3 text-sm text-positive">
          {erfolg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Stammdaten der Annahme */}
        <SectionCard title="Annahme" className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <label className="label">Kunde</label>
              <select
                className="select"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setVehicleId('');
                }}
              >
                <option value="">– auswählen –</option>
                {kunden.map((k) => (
                  <option key={k.id} value={k.id}>
                    {kundenName(k)}
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
              >
                <option value="">– auswählen –</option>
                {fahrzeugAuswahl.map((f) => (
                  <option key={f.id} value={f.id}>
                    {[f.make, f.model].filter(Boolean).join(' ')}
                    {f.licensePlate ? ` · ${f.licensePlate}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">km-Stand</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={kmStand}
                  onChange={(e) => setKmStand(e.target.value)}
                  placeholder="z.B. 84500"
                />
              </div>
              <div>
                <label className="label">Tankstand: {tankstand} %</label>
                <input
                  className="w-full accent-copper"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={tankstand}
                  onChange={(e) => setTankstand(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Allgemeine Notiz</label>
              <textarea
                className="textarea"
                rows={3}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Auffälligkeiten, Vereinbarungen …"
              />
            </div>
          </div>
        </SectionCard>

        {/* Schadensdiagramm */}
        <SectionCard
          title="Schadensdiagramm"
          subtitle="In die Silhouette klicken, um einen Schaden zu markieren"
          className="lg:col-span-2"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {ANSICHTEN.map((a) => (
              <button
                key={a.key}
                className={a.key === ansicht ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
                onClick={() => setAnsicht(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="mx-auto aspect-square w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900/60 p-2">
            <FahrzeugDiagramm
              ansicht={ansicht}
              marker={marker}
              onAdd={addMarker}
              onMarkerClick={setEditId}
              aktiverMarkerId={editId ?? undefined}
            />
          </div>

          {/* Legende */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-chrome-400">
            {GRAD_OPTIONEN.map((g) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: SCHWEREGRAD_COLOR[g] }}
                />
                {SCHWEREGRAD_LABEL[g]}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Marker-Liste */}
      <div className="mt-4">
        <SectionCard title={`Erfasste Schäden (${marker.length})`}>
          {marker.length === 0 ? (
            <Empty text="Noch keine Schäden markiert. In das Diagramm klicken." />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {marker.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-950" style={{ backgroundColor: SCHWEREGRAD_COLOR[m.schweregrad] }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-chrome-100">
                      {SCHADEN_ART_LABEL[m.art] ?? m.art}
                      {m.notiz ? ` – ${m.notiz}` : ''}
                    </p>
                    <p className="text-xs text-chrome-400">
                      {ANSICHTEN.find((a) => a.key === m.ansicht)?.label ?? m.ansicht}
                    </p>
                  </div>
                  <Badge className={SCHWEREGRAD_BADGE[m.schweregrad]}>
                    {SCHWEREGRAD_LABEL[m.schweregrad]}
                  </Badge>
                  <button className="btn-subtle btn-sm" onClick={() => setEditId(m.id)}>
                    Bearbeiten
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => removeMarker(m.id)}>
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Marker-Editor */}
      <Modal open={!!editMarker} onClose={() => setEditId(null)} title="Schaden bearbeiten">
        {editMarker && (
          <div className="space-y-4">
            <div>
              <label className="label">Schadensart</label>
              <select
                className="select"
                value={editMarker.art}
                onChange={(e) => updateMarker(editMarker.id, { art: e.target.value })}
              >
                {ART_OPTIONEN.map((a) => (
                  <option key={a} value={a}>
                    {SCHADEN_ART_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Schweregrad</label>
              <div className="flex gap-2">
                {GRAD_OPTIONEN.map((g) => (
                  <button
                    key={g}
                    className={
                      editMarker.schweregrad === g ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'
                    }
                    onClick={() => updateMarker(editMarker.id, { schweregrad: g })}
                  >
                    {SCHWEREGRAD_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Notiz</label>
              <textarea
                className="textarea"
                rows={3}
                value={editMarker.notiz ?? ''}
                onChange={(e) => updateMarker(editMarker.id, { notiz: e.target.value })}
                placeholder="Beschreibung des Schadens …"
              />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button
                className="btn-danger"
                onClick={() => removeMarker(editMarker.id)}
              >
                Schaden entfernen
              </button>
              <button className="btn-primary" onClick={() => setEditId(null)}>
                Fertig
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
