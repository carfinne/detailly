'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { kundenName, datum } from '@/lib/format';
import {
  SCHWEREGRAD_BADGE,
  SCHWEREGRAD_COLOR,
  INSPECTION_STATUS_COLOR,
} from '@/lib/labels';
import type { Customer, Vehicle, SchadensMarker, DamageInspection } from '@/lib/types';
import { markerZuDamageItem } from '@/lib/marker-mapping';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, SectionCard, useToast } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { FahrzeugDiagramm, ANSICHTEN, type Ansicht } from '@/components/FahrzeugDiagramm';
import { useT } from '@/lib/i18n';

// Einfache ID fuer neue Marker (Demo – kein crypto-UUID-Zwang noetig).
function neueId(): string {
  return `m_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

// Enum->i18n-Key (Rohwert-Fallback in der Komponente). Die geteilte labels.ts
// bleibt unangetastet; die Auflösung erfolgt lokal via t().
const SCHADEN_ART_KEY: Record<string, string> = {
  kratzer: 'fahrzeugannahme.art.kratzer',
  delle: 'fahrzeugannahme.art.delle',
  steinschlag: 'fahrzeugannahme.art.steinschlag',
  lackschaden: 'fahrzeugannahme.art.lackschaden',
  rost: 'fahrzeugannahme.art.rost',
  sonstiges: 'fahrzeugannahme.art.sonstiges',
};
const SCHWEREGRAD_KEY: Record<string, string> = {
  leicht: 'fahrzeugannahme.grad.leicht',
  mittel: 'fahrzeugannahme.grad.mittel',
  schwer: 'fahrzeugannahme.grad.schwer',
};
const INSPECTION_STATUS_KEY: Record<string, string> = {
  entwurf: 'fahrzeugannahme.status.entwurf',
  abgeschlossen: 'fahrzeugannahme.status.abgeschlossen',
  freigegeben: 'fahrzeugannahme.status.freigegeben',
};

const ART_OPTIONEN = Object.keys(SCHADEN_ART_KEY);
const GRAD_OPTIONEN = Object.keys(SCHWEREGRAD_KEY);

export default function FahrzeugannahmePage() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  // Pro Formular-Sitzung stabile Idempotenz-ID fuer Stufe 1 (POST /inspections):
  // Schlaegt Stufe 1 mit Timeout fehl (Server hat die Inspektion evtl. doch
  // angelegt, aber die Antwort ging verloren), erzeugt ein zweiter
  // "Annahme speichern"-Klick dank tenant-scoped clientUuid KEINE zweite
  // Inspektion – der Server liefert dieselbe zurueck.
  const [formUuid] = useState(() => crypto.randomUUID());
  const [kunden, setKunden] = useState<Customer[]>([]);
  const [fahrzeuge, setFahrzeuge] = useState<Vehicle[]>([]);
  const [protokolle, setProtokolle] = useState<DamageInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      api.get<Customer[]>('/customers/select'),
      api.get<Vehicle[]>('/vehicles'),
    ])
      .then(([k, f]) => {
        setKunden(k ?? []);
        setFahrzeuge(Array.isArray(f) ? f : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // Letzte Annahmen aus der Inspektions-API (typ=annahme) – entkoppelt geladen,
    // damit ein Fehler hier die Annahme-Maske nicht blockiert.
    api
      .get<DamageInspection[]>('/inspections?typ=annahme')
      .then((p) => setProtokolle(Array.isArray(p) ? p : []))
      .catch(() => {
        /* Liste bleibt leer – kein harter Fehler. */
      });
  }, []);

  // Fahrzeuge des gewaehlten Kunden (sonst alle).
  const fahrzeugAuswahl = useMemo(
    () => (customerId ? fahrzeuge.filter((f) => f.customerId === customerId) : fahrzeuge),
    [fahrzeuge, customerId],
  );

  // Kunden-Nachschlag fuer die Protokoll-Liste (Halter-Name).
  const custMap = useMemo(
    () => Object.fromEntries(kunden.map((k) => [k.id, k])),
    [kunden],
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

  // Zweistufiger Inspektions-Flow (die Inspektions-API nimmt Schaeden NICHT
  // verschachtelt im Body an):
  //   1. POST /inspections  -> Inspektions-id
  //   2. je Marker POST /inspections/:id/items (positionMode='2d')
  //   3. PATCH /inspections/:id { status:'abgeschlossen' } (Annahme = fertig)
  // Erfolg -> Redirect auf die Inspektions-Detailansicht.
  //
  // Fehlerfall: gelingt Stufe 1, schlaegt aber ein Item (oder der PATCH) fehl,
  // existiert die Inspektion bereits. Statt eines stillen Stummels leiten wir
  // den Nutzer mit klarer Meldung auf die Detailseite – dort ist der Rest
  // nacherfassbar (die Seite laedt /inspections/:id).
  //
  // Idempotenz durchgaengig ueber clientUuid: Stufe 1 traegt eine pro
  // Formular-Sitzung stabile formUuid, jedes Item seine Marker-ID
  // (markerZuDamageItem). Ein erneuter Speichern-Klick nach verlorener Antwort
  // erzeugt daher WEDER eine doppelte Inspektion NOCH doppelte Schaeden.
  async function speichern() {
    if (!customerId) {
      setError(t('fahrzeugannahme.error.kundePflicht'));
      return;
    }
    setBusy(true);
    setError('');

    let inspectionId: string;
    // Stufe 1: Inspektion anlegen.
    try {
      const inspection = await api.post<DamageInspection>('/inspections', {
        customerId,
        vehicleId: vehicleId || undefined,
        typ: 'annahme',
        kmStand: kmStand ? Number(kmStand) : undefined,
        tankstand: tankstand ? Number(tankstand) : undefined,
        notiz: notiz || undefined,
        clientUuid: formUuid,
      });
      inspectionId = inspection.id;
    } catch (e) {
      // Nichts wurde angelegt -> Maske bleibt bestehen, Nutzer kann erneut speichern.
      setError(e instanceof ApiError ? e.message : t('fahrzeugannahme.error.anlegen'));
      setBusy(false);
      return;
    }

    // Ab hier existiert die Inspektion -> bei Fehlern zur Detailseite leiten.
    const detailPfad = `/schadenserfassung?inspection=${inspectionId}`;

    // Stufe 2: Schaeden als 2D-Items anlegen.
    try {
      for (const m of marker) {
        await api.post(`/inspections/${inspectionId}/items`, markerZuDamageItem(m));
      }
    } catch {
      // Inspektion + evtl. ein Teil der Schaeden ist gespeichert. Kein Stummel
      // ohne Rueckmeldung: Weiterleitung zum Nacherfassen mit Warn-Flag, das die
      // Detailseite als sichtbaren Hinweis rendert (persistenter als ein Toast,
      // der beim Seitenwechsel verschwindet). Ein Retry ist dank clientUuid
      // (markerZuDamageItem) gefahrlos.
      setTimeout(() => router.push(`${detailPfad}&warnung=schaden`), 1200);
      return;
    }

    // Stufe 3: Annahme abschliessen. Ein Fehler hier ist unkritisch (Inspektion
    // + Schaeden sind gespeichert), daher nur best-effort ohne harte Sperre.
    try {
      await api.patch(`/inspections/${inspectionId}`, { status: 'abgeschlossen' });
    } catch {
      /* Status bleibt Entwurf – auf der Detailseite aenderbar. */
    }

    toast(t('fahrzeugannahme.toast.gespeichert'));
    setTimeout(() => router.push(detailPfad), 900);
  }

  return (
    <div>
      <PageHeader
        title={t('fahrzeugannahme.title')}
        subtitle={t('fahrzeugannahme.subtitle')}
        action={
          <button className="btn-primary" disabled={busy} onClick={speichern}>
            {t('fahrzeugannahme.save')}
          </button>
        }
      />

      {/* Querverweis zur 3D-Schadenserfassung: dort Fotos, Unterschrift und
          Vorschaden-Uebernahme. Reiner UI-Hinweis (kein gemeinsames Datenmodell). */}
      <Link
        href="/schadenserfassung"
        className="group mb-4 flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-800/60 px-4 py-3 transition-colors hover:border-copper/40 hover:bg-ink-750"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20">
          <Icon>{ICON_PATHS.inspection3d}</Icon>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-chrome-100">
            {t('fahrzeugannahme.crosslink.title')}
          </span>
          <span className="block text-xs text-chrome-400">
            {t('fahrzeugannahme.crosslink.subtitle')}
          </span>
        </span>
        <Icon className="h-4 w-4 shrink-0 text-chrome-500 transition-colors group-hover:text-copper">
          {ICON_PATHS.arrow}
        </Icon>
      </Link>

      {error && <ErrorBox message={error} className="mb-4" />}

      {loading ? (
        <Loading />
      ) : (<>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Stammdaten der Annahme */}
        <SectionCard title={t('fahrzeugannahme.card.annahme')} className="lg:col-span-1">
          <div className="space-y-4">
            <div>
              <label className="label">{t('fahrzeugannahme.label.kunde')}</label>
              <select
                className="select"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setVehicleId('');
                }}
              >
                <option value="">{t('fahrzeugannahme.select.placeholder')}</option>
                {kunden.map((k) => (
                  <option key={k.id} value={k.id}>
                    {kundenName(k)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('fahrzeugannahme.label.fahrzeug')}</label>
              <select
                className="select"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">{t('fahrzeugannahme.select.placeholder')}</option>
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
                <label className="label">{t('fahrzeugannahme.label.km')}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={kmStand}
                  onChange={(e) => setKmStand(e.target.value)}
                  placeholder={t('fahrzeugannahme.km.placeholder')}
                />
              </div>
              <div>
                <label className="label">{t('fahrzeugannahme.label.tankstand', { wert: tankstand })}</label>
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
              <label className="label">{t('fahrzeugannahme.label.notiz')}</label>
              <textarea
                className="textarea"
                rows={3}
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder={t('fahrzeugannahme.notiz.placeholder')}
              />
            </div>
          </div>
        </SectionCard>

        {/* Schadensdiagramm */}
        <SectionCard
          title={t('fahrzeugannahme.card.diagramm.title')}
          subtitle={t('fahrzeugannahme.card.diagramm.subtitle')}
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
                {SCHWEREGRAD_KEY[g] ? t(SCHWEREGRAD_KEY[g]) : g}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Marker-Liste */}
      <div className="mt-4">
        <SectionCard title={t('fahrzeugannahme.erfassteSchaeden', { count: marker.length })}>
          {marker.length === 0 ? (
            <Empty text={t('fahrzeugannahme.empty.schaeden')} />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {marker.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-950" style={{ backgroundColor: SCHWEREGRAD_COLOR[m.schweregrad] }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-chrome-100">
                      {SCHADEN_ART_KEY[m.art] ? t(SCHADEN_ART_KEY[m.art]) : m.art}
                      {m.notiz ? ` – ${m.notiz}` : ''}
                    </p>
                    <p className="text-xs text-chrome-400">
                      {ANSICHTEN.find((a) => a.key === m.ansicht)?.label ?? m.ansicht}
                    </p>
                  </div>
                  <Badge className={SCHWEREGRAD_BADGE[m.schweregrad]}>
                    {SCHWEREGRAD_KEY[m.schweregrad] ? t(SCHWEREGRAD_KEY[m.schweregrad]) : m.schweregrad}
                  </Badge>
                  <button className="btn-subtle btn-sm" onClick={() => setEditId(m.id)}>
                    {t('fahrzeugannahme.action.bearbeiten')}
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => removeMarker(m.id)}>
                    {t('fahrzeugannahme.action.entfernen')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Letzte Annahmen: die gespeicherten Inspektionen (typ=annahme) sind jetzt
          direkt in der Schadenserfassung anklickbar – Fotos, Unterschrift und
          Vorschaden-Uebernahme inklusive (keine Daten-Sackgasse mehr). */}
      <div className="mt-4">
        <SectionCard title={t('fahrzeugannahme.card.letzteAnnahmen.title')} subtitle={t('fahrzeugannahme.card.letzteAnnahmen.subtitle')}>
          {protokolle.length === 0 ? (
            <Empty text={t('fahrzeugannahme.empty.annahmen')} />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {protokolle.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/schadenserfassung?inspection=${p.id}`}
                    className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-ink-750/60"
                  >
                    <span className="w-24 shrink-0 text-xs tabular-nums text-chrome-400">
                      {datum(p.createdAt)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-chrome-100">
                      {p.customerId ? kundenName(custMap[p.customerId]) : '—'}
                    </span>
                    {typeof p.kmStand === 'number' && (
                      <span className="shrink-0 text-xs tabular-nums text-chrome-400">
                        {p.kmStand.toLocaleString('de-DE')} km
                      </span>
                    )}
                    {p.status && (
                      <Badge className={`${INSPECTION_STATUS_COLOR[p.status] ?? 'badge-neutral'} shrink-0`}>
                        {INSPECTION_STATUS_KEY[p.status] ? t(INSPECTION_STATUS_KEY[p.status]) : p.status}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      </>)}

      {/* Marker-Editor */}
      <Modal open={!!editMarker} onClose={() => setEditId(null)} title={t('fahrzeugannahme.modal.title')}>
        {editMarker && (
          <div className="space-y-4">
            <div>
              <label className="label">{t('fahrzeugannahme.modal.schadensart')}</label>
              <select
                className="select"
                value={editMarker.art}
                onChange={(e) => updateMarker(editMarker.id, { art: e.target.value })}
              >
                {ART_OPTIONEN.map((a) => (
                  <option key={a} value={a}>
                    {SCHADEN_ART_KEY[a] ? t(SCHADEN_ART_KEY[a]) : a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('fahrzeugannahme.modal.schweregrad')}</label>
              <div className="flex gap-2">
                {GRAD_OPTIONEN.map((g) => (
                  <button
                    key={g}
                    className={
                      editMarker.schweregrad === g ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'
                    }
                    onClick={() => updateMarker(editMarker.id, { schweregrad: g })}
                  >
                    {SCHWEREGRAD_KEY[g] ? t(SCHWEREGRAD_KEY[g]) : g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t('fahrzeugannahme.modal.notiz')}</label>
              <textarea
                className="textarea"
                rows={3}
                value={editMarker.notiz ?? ''}
                onChange={(e) => updateMarker(editMarker.id, { notiz: e.target.value })}
                placeholder={t('fahrzeugannahme.modal.notiz.placeholder')}
              />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button
                className="btn-danger"
                onClick={() => removeMarker(editMarker.id)}
              >
                {t('fahrzeugannahme.modal.entfernen')}
              </button>
              <button className="btn-primary" onClick={() => setEditId(null)}>
                {t('fahrzeugannahme.modal.fertig')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
