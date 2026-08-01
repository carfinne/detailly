'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur, kundenName, datum } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN, EMPFANG_ROLLEN } from '@/lib/rollen';
import { ORDER_STATUS_COLOR } from '@/lib/labels';
import type { Order, Customer, Vehicle, ServiceItem, Paginated, OrderItem, NachsorgeFaelligItem } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, RequiredMark, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { Pager } from '@/components/Pager';
import { consumeUebernahmePayload } from '@/lib/kalkulation-uebernahme';
import { useT } from '@/lib/i18n';

const SEITENGROESSE = 50;

// Enum-Wert -> i18n-Key (technisch, nicht angezeigt). Der Fallback auf den
// Rohwert bleibt im JSX erhalten, falls das Backend einen unbekannten Wert
// liefert. Die geteilte labels.ts bleibt dabei bewusst unangetastet.
const STATUS_KEY: Record<string, string> = {
  angefragt: 'auftraege.status.angefragt',
  kalkuliert: 'auftraege.status.kalkuliert',
  bestaetigt: 'auftraege.status.bestaetigt',
  in_arbeit: 'auftraege.status.in_arbeit',
  qualitaetskontrolle: 'auftraege.status.qualitaetskontrolle',
  fertig: 'auftraege.status.fertig',
  abgerechnet: 'auftraege.status.abgerechnet',
  storniert: 'auftraege.status.storniert',
};
const SERVICE_KEY: Record<string, string> = {
  aufbereitung: 'auftraege.service.aufbereitung',
  folierung: 'auftraege.service.folierung',
  ppf: 'auftraege.service.ppf',
  sonstiges: 'auftraege.service.sonstiges',
};

// Auftrags-Reiter: Status-Filter + Welle 2-B "Nachsorge" (faellige Wiedervorlagen).
type AuftragFilter = 'alle' | 'in_arbeit' | 'fertig' | 'nachsorge';
// Status-Reiter fuer die Auftragsliste (Backend filtert auf einen Status).
const STATUS_TABS: { key: 'alle' | 'in_arbeit' | 'fertig'; labelKey: string }[] = [
  { key: 'alle', labelKey: 'auftraege.tab.alle' },
  { key: 'in_arbeit', labelKey: 'auftraege.status.in_arbeit' },
  { key: 'fertig', labelKey: 'auftraege.status.fertig' },
];

export default function AuftraegePage() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const darfLoeschen = !!user && LEITUNG_ROLLEN.includes(user.role);
  // Auftrag anlegen: Leitung + Rezeption (Backend orders.controller POST
  // @Roles(OWNER, MANAGER, RECEPTIONIST)). Techniker duerfen NICHT anlegen –
  // der Knopf bleibt fuer sie verborgen, damit sie nicht ins 403 laufen.
  const darfAnlegen = !!user && EMPFANG_ROLLEN.includes(user.role);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Stammdaten (Kunden/Fahrzeuge/Leistungen) laden getrennt vom Hot-Path-load:
  // eigener Fehler-State, den der /orders-load NICHT wieder leert (sonst
  // verschwaende ein Stammdaten-Fehler beim naechsten Blaettern still). Ready-Flag
  // gated nur den Erstpaint, damit Namen/Dropdowns nicht "nachpoppen".
  const [stammdatenError, setStammdatenError] = useState('');
  const [stammdatenReady, setStammdatenReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  // Welle 1-A (F1): Modal wurde als KOPIE eines bestehenden Auftrags geoeffnet
  // (steuert Titel + Hinweis). Der POST-Pfad bleibt identisch – Status/Datum/Nummer
  // vergibt der Server neu.
  const [istKopie, setIstKopie] = useState(false);
  // Welle 2-A: Uebernahme aus einer Inspektion, bei der mind. eine Position keinen
  // gepflegten Preis hatte (Einzelpreis 0) -> Hinweis, Preise vor dem Speichern zu
  // ergaenzen. Es wird NICHTS erfunden.
  const [preiseErgaenzen, setPreiseErgaenzen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  // Monoton steigende Request-ID: bei entprellter Suche kann auf langsamem Netz
  // eine aeltere Antwort nach einer neueren eintreffen (Request-Reordering).
  // Nur die juengste Antwort darf den State setzen (reqId-Guard, Muster aus
  // CommandPalette.tsx).
  const reqId = useRef(0);
  // Status-Reiter: 'alle' | einzelner OrderStatus (Backend filtert auf einen
  // Status) | 'nachsorge' (Welle 2-B: faellige Wiedervorlagen, eigene Quelle).
  const [filter, setFilter] = useState<AuftragFilter>('alle');
  // Welle 2-B (Teil 2): faellige Nachsorge-Wiedervorlagen (unpaginierte Liste).
  const [nachsorgeItems, setNachsorgeItems] = useState<NachsorgeFaelligItem[]>([]);
  const [nachsorgeCount, setNachsorgeCount] = useState(0);
  const [nachsorgeBusy, setNachsorgeBusy] = useState<string | null>(null);
  // Loeschen-Bestaetigung (Pending-State: welcher Auftrag steht an?).
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [serviceType, setServiceType] = useState('aufbereitung');
  const [materialkosten, setMaterialkosten] = useState('');
  // Geplante Gesamtdauer (Soll) in Stunden – leer = aus den Positionen summieren.
  const [geplanteDauerStd, setGeplanteDauerStd] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      // Welle 2-B: der Nachsorge-Reiter hat eine eigene Quelle (faellige, geclaimte,
      // nicht erledigte Wiedervorlagen) – unpaginiert, kein Status/Suche.
      if (filter === 'nachsorge') {
        const liste = await api.get<NachsorgeFaelligItem[]>('/orders/nachsorge-faellig');
        if (id !== reqId.current) return;
        setNachsorgeItems(liste);
        setNachsorgeCount(liste.length);
        setError('');
        return;
      }
      // Server-getrieben: Seite, Status-Reiter und Suche laufen in der DB.
      // Der search-Param stammt aus dem Backend-Stack (#106) – ein aelteres
      // Backend ignoriert ihn still (unbekannter Query-Key), sodass die Suche
      // sauber degradiert (Liste bleibt vollstaendig, kein Fehler).
      // HEISSER PFAD: NUR /orders. Stammdaten (Kunden/Fahrzeuge/Leistungen) werden
      // einmalig beim Mount geladen (Effekt unten) – nicht bei jedem Tastendruck.
      const params = new URLSearchParams({ page: String(page), limit: String(SEITENGROESSE) });
      if (filter !== 'alle') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const o = await api.get<Paginated<Order>>(`/orders?${params.toString()}`);
      // Nur die juengste Anfrage darf den State setzen.
      if (id !== reqId.current) return;
      setOrders(o.data);
      setTotal(o.total);
      setError('');
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, filter, search, t]);

  // Welle 2-B: Nachsorge-Zaehler EINMALIG fuer den Reiter-Badge (best-effort;
  // Techniker/aeltere Backends -> still ignoriert). ?nachsorge=1 (aus der Glocke)
  // aktiviert den Reiter direkt.
  useEffect(() => {
    const wantNachsorge = new URLSearchParams(window.location.search).get('nachsorge') === '1';
    let aktiv = true;
    api.get<NachsorgeFaelligItem[]>('/orders/nachsorge-faellig')
      .then((liste) => {
        if (!aktiv) return;
        setNachsorgeItems(liste);
        setNachsorgeCount(liste.length);
        if (wantNachsorge) setFilter('nachsorge');
      })
      .catch(() => { /* Reiter bleibt aus */ });
    return () => { aktiv = false; };
  }, []);

  // Faellige Nachsorge abhaken (POST /:id/nachsorge/erledigt) -> aus der Liste
  // entfernen. Kein Auto-Versand: der Betrieb hat den Termin selbst angestossen.
  async function nachsorgeErledigt(orderId: string) {
    setNachsorgeBusy(orderId);
    try {
      await api.post(`/orders/${orderId}/nachsorge/erledigt`);
      setNachsorgeItems((prev) => prev.filter((n) => n.orderId !== orderId));
      setNachsorgeCount((c) => Math.max(0, c - 1));
      toast(t('auftraege.nachsorge.doneToast'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setNachsorgeBusy(null);
    }
  }

  // Entprellt (250ms): faengt schnelles Tippen in der Suche ab.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // Stammdaten fuer Dropdowns (Anlage-Modal) + Kunden-Namensmap: EINMALIG beim
  // Mount, nicht im entprellten Such-/Filter-Pfad. Aendern sich nicht pro Seite.
  // Fehler landen im eigenen stammdatenError (nicht im vom load geleerten error);
  // stammdatenReady wird IMMER gesetzt (auch bei Fehler), damit der Erstpaint nicht
  // haengt – die Liste erscheint dann mit Hinweis-Banner statt endlos zu spinnen.
  useEffect(() => {
    let aktiv = true;
    Promise.all([
      api.get<Customer[]>('/customers/select'),
      api.get<Vehicle[]>('/vehicles'),
      api.get<ServiceItem[]>('/services'),
    ])
      .then(([c, v, s]) => {
        if (!aktiv) return;
        setCustomers(c);
        setVehicles(v);
        setServices(s);
        setStammdatenError('');
      })
      .catch((e) => {
        if (aktiv) setStammdatenError(e instanceof Error ? e.message : t('common.error'));
      })
      .finally(() => {
        if (aktiv) setStammdatenReady(true);
      });
    return () => { aktiv = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Uebernahme aus der Kalkulation: /auftraege?uebernahme=1 liest die in
  // sessionStorage abgelegten Positionen (Kalk -> Auftrag), befuellt das Anlage-
  // Modal vor (Positionen + Leistungsart) und oeffnet es. Genau EINMAL beim Mount
  // (Ref-Guard); Param + Speicher werden dabei verbraucht, damit Reload/Zurueck
  // nichts erneut oeffnet. Unabhaengig von den Kunden-Stammdaten – der Kunde wird
  // im Modal wie gewohnt gewaehlt (Pflichtfeld).
  //
  // KOEXISTENZ mit der Kopie (?kopie=<id>, s. naechster Effekt): Beide Vorbefuellungs-
  // Pfade sind disjunkte Einstiege (Kalkulation vs. Detailseite) und treten im
  // normalen Fluss nie gemeinsam auf. Sollte dennoch ?uebernahme=1&kopie=<id>
  // gleichzeitig ankommen, hat die UEBERNAHME Vorrang: dieser Effekt ist zuerst
  // deklariert (laeuft also vor dem Kopie-Effekt) UND entfernt beim Mount den
  // GESAMTEN Query-String – der Kopie-Effekt (der erst nach dem Kunden-Laden greift)
  // findet seinen Param dann nicht mehr. Kein gegenseitiges Ueberschreiben.
  const uebernahmeVerarbeitet = useRef(false);
  useEffect(() => {
    if (uebernahmeVerarbeitet.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('uebernahme') !== '1') return;
    uebernahmeVerarbeitet.current = true;
    const payload = consumeUebernahmePayload();
    window.history.replaceState(null, '', window.location.pathname);
    if (!payload) return;
    resetForm();
    if (payload.serviceType) setServiceType(payload.serviceType);
    // Welle 2-A (Inspektions-Quelle): Kunde + Fahrzeug vorbelegen. Die Optionen
    // erscheinen, sobald die Stammdaten geladen sind – das controlled value bleibt
    // erhalten und wird dann korrekt angezeigt.
    if (payload.customerId) setCustomerId(payload.customerId);
    if (payload.vehicleId) setVehicleId(payload.vehicleId);
    setPreiseErgaenzen(payload.preiseUnvollstaendig === true);
    setItems(payload.items.map((it) => ({
      beschreibung: it.beschreibung,
      menge: it.menge,
      einzelpreis: it.einzelpreis,
    })));
    setModalError('');
    setOpen(true);
    // Kunde vorbelegt (Inspektion) -> anderer Hinweis als bei der Kalkulation
    // (wo der Kunde noch zu waehlen ist).
    toast(payload.customerId ? t('auftraege.uebernahme.toastInspektion') : t('auftraege.uebernahme.toast'));
    // Nur beim Mount; toast/t werden bewusst nicht als Deps gefuehrt (Ref-Guard).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vorbelegung aus der Detailseite: /auftraege?kopie=<id> oeffnet das Anlage-Modal
  // als KOPIE (Positionen etc. uebernommen). Genau EINMAL (Ref-Guard), Param danach
  // entfernen. Erst nach dem Laden der Kunden greifen (fuer die Kunden-Vorbelegung).
  const kopieVerarbeitet = useRef(false);
  useEffect(() => {
    if (kopieVerarbeitet.current || customers.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    // Uebernahme aus der Kalkulation hat Vorrang (s.o.): liegt sie an, NICHT als
    // Kopie behandeln (verhindert doppeltes Vorbefuellen/Ueberschreiben).
    if (params.get('uebernahme') === '1') return;
    const kopie = params.get('kopie');
    if (!kopie) return;
    kopieVerarbeitet.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    void startDuplicate(kopie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Soll-Dauer aus dem Katalog auf die Position schnappen (fuer die Soll-Summe).
    if (s)
      setItem(i, {
        beschreibung: s.name,
        einzelpreis: Number(s.basispreis),
        geplanteDauerMinuten: s.geplanteDauerMinuten ?? null,
      });
  }

  // Vorschlag fuer die Soll-Gesamtdauer: Summe der Positions-Dauern (Minuten).
  const sollVorschlagMin = items.reduce((s, it) => s + (Number(it.geplanteDauerMinuten) || 0), 0);

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
    setGeplanteDauerStd('');
    setItems([{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
    setIstKopie(false);
    setPreiseErgaenzen(false);
  }

  // Welle 1-A (F1): "Als Vorlage verwenden" – laedt den Quell-Auftrag VOLL (die
  // Listenprojektion enthaelt KEINE Positionen) und oeffnet das Anlage-Formular mit
  // uebernommenen Daten: Kunde, Fahrzeug, Leistungsart, Materialkosten und ALLE
  // Positionen. Bewusst NICHT uebernommen: Status/Datum/Nummer (Server vergibt neu),
  // Rechnungsbezug, interner Hinweis, Fotos. Trifft danach das bestehende POST /orders.
  async function startDuplicate(orderId: string) {
    setModalError('');
    try {
      const full = await api.get<Order>(`/orders/${orderId}`);
      resetForm();
      if (full.customerId && customers.some((c) => c.id === full.customerId)) {
        setCustomerId(full.customerId);
      }
      if (full.vehicleId) setVehicleId(full.vehicleId);
      setServiceType(full.serviceType || 'aufbereitung');
      setMaterialkosten(full.materialkosten ? String(full.materialkosten) : '');
      setGeplanteDauerStd(
        full.geplanteDauerMinuten != null ? String(Math.round((full.geplanteDauerMinuten / 60) * 100) / 100) : '',
      );
      const kopierItems = (full.items ?? []).map((it) => ({
        beschreibung: it.beschreibung,
        menge: Number(it.menge),
        einzelpreis: Number(it.einzelpreis),
        geplanteDauerMinuten: it.geplanteDauerMinuten ?? null,
      }));
      setItems(kopierItems.length > 0 ? kopierItems : [{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
      setIstKopie(true);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auftraege.error.duplicate'));
    }
  }

  async function deleteOrder() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/orders/${confirmDelete.id}`);
      toast(t('auftraege.toast.deleted', { nummer: confirmDelete.auftragsnummer }));
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : t('auftraege.error.delete'));
    } finally {
      setDeleting(false);
    }
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
            ...(it.geplanteDauerMinuten != null
              ? { geplanteDauerMinuten: Math.round(Number(it.geplanteDauerMinuten)) }
              : {}),
          })),
      };
      if (vehicleId) payload.vehicleId = vehicleId;
      if (materialkosten) payload.materialkosten = Number(materialkosten);
      // Soll-Override nur senden, wenn der Meister ihn gesetzt hat; sonst summiert
      // der Server aus den Positionen.
      if (geplanteDauerStd.trim() !== '')
        payload.geplanteDauerMinuten = Math.round(Number(geplanteDauerStd) * 60);
      await api.post('/orders', payload);
      setOpen(false);
      resetForm();
      // Neuer Auftrag erscheint oben auf Seite 1.
      if (page !== 1) setPage(1);
      else await load();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : t('auftraege.error.save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('auftraege.title')}
        subtitle={t('auftraege.subtitle')}
        action={
          darfAnlegen ? (
            <button className="btn-primary" onClick={() => { resetForm(); setModalError(''); setOpen(true); }}>
              {t('auftraege.new')}
            </button>
          ) : undefined
        }
      />
      {error && <ErrorBox message={error} />}
      {stammdatenError && <ErrorBox message={stammdatenError} />}
      {stammdatenReady && !loading && (total > 0 || filterAktiv || nachsorgeCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {filter !== 'nachsorge' && (
            <input
              className="input max-w-xs"
              placeholder={t('auftraege.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          )}
          <div className="seg-group">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); setPage(1); }}
                className={`seg ${filter === tab.key ? 'seg-active' : ''}`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
            {/* Welle 2-B: Nachsorge-Reiter nur zeigen, wenn faellig (oder aktiv). */}
            {(nachsorgeCount > 0 || filter === 'nachsorge') && (
              <button
                onClick={() => { setFilter('nachsorge'); setPage(1); }}
                className={`flex items-center gap-1.5 seg ${filter === 'nachsorge' ? 'seg-active' : ''}`}
              >
                {t('auftraege.tab.nachsorge')}
                <span className="text-xs tabular-nums opacity-70">{nachsorgeCount}</span>
              </button>
            )}
          </div>
        </div>
      )}
      <div className="card">
        {loading || !stammdatenReady ? (
          <Loading />
        ) : filter === 'nachsorge' ? (
          nachsorgeItems.length === 0 ? (
            <Empty text={t('auftraege.nachsorge.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <p className="mb-3 text-sm text-chrome-400">{t('auftraege.nachsorge.intro')}</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('auftraege.col.nummer')}</th>
                    <th>{t('auftraege.col.kunde')}</th>
                    <th>{t('auftraege.nachsorge.col.fahrzeug')}</th>
                    <th>{t('auftraege.col.leistung')}</th>
                    <th>{t('auftraege.nachsorge.col.faellig')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {nachsorgeItems.map((n) => (
                    <tr key={n.orderId}>
                      <td className="font-medium">
                        <Link href={`/auftraege/detail/?id=${n.orderId}`} className="link-row">
                          {n.auftragsnummer}
                        </Link>
                      </td>
                      <td>
                        {n.customerId ? (
                          <Link href={`/kunden/detail/?id=${n.customerId}`} className="link-row">
                            {n.kunde ?? '–'}
                          </Link>
                        ) : (
                          n.kunde ?? '–'
                        )}
                      </td>
                      <td>
                        {n.fahrzeug ?? '–'}
                        {n.kennzeichen ? <span className="text-chrome-500"> ({n.kennzeichen})</span> : null}
                      </td>
                      <td>{SERVICE_KEY[n.serviceType] ? t(SERVICE_KEY[n.serviceType]) : n.serviceType}</td>
                      <td>{n.nachsorgeAm ? datum(n.nachsorgeAm) : '–'}</td>
                      <td className="text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="btn-ghost btn-sm"
                            disabled={nachsorgeBusy === n.orderId}
                            onClick={() => nachsorgeErledigt(n.orderId)}
                          >
                            {nachsorgeBusy === n.orderId && <span className="spinner" />}
                            {t('auftraege.nachsorge.done')}
                          </button>
                          <ActionMenu
                            label={t('auftraege.actionsFor', { nummer: n.auftragsnummer })}
                            items={[
                              {
                                key: 'termin',
                                label: t('auftraege.nachsorge.planTermin'),
                                href: n.customerId ? `/plantafel?kunde=${n.customerId}` : '/plantafel',
                              },
                              { key: 'open', label: t('auftraege.action.open'), href: `/auftraege/detail/?id=${n.orderId}` },
                            ] satisfies ActionMenuItem[]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : orders.length === 0 ? (
          filterAktiv ? (
            <Empty text={t('auftraege.empty.filtered')} />
          ) : darfAnlegen ? (
            <Empty
              text={t('auftraege.empty.none')}
              action={
                <button
                  className="btn-primary btn-sm"
                  onClick={() => { resetForm(); setModalError(''); setOpen(true); }}
                >
                  {t('auftraege.empty.cta')}
                </button>
              }
            />
          ) : (
            // Techniker: kein Anlegen-Knopf. Statt leerer Flaeche ein Hinweis,
            // dass Auftraege von der Leitung angelegt werden und hier erscheinen.
            <Empty text={t('auftraege.empty.noneTech')} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('auftraege.col.nummer')}</th>
                  <th>{t('auftraege.col.kunde')}</th>
                  <th>{t('auftraege.col.leistung')}</th>
                  <th>{t('auftraege.col.status')}</th>
                  <th className="text-end">{t('auftraege.col.gesamt')}</th>
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
                    <td>{SERVICE_KEY[o.serviceType] ? t(SERVICE_KEY[o.serviceType]) : o.serviceType}</td>
                    <td>
                      <Badge className={ORDER_STATUS_COLOR[o.status]}>
                        {STATUS_KEY[o.status] ? t(STATUS_KEY[o.status]) : o.status}
                      </Badge>
                    </td>
                    <td className="text-end">{eur(o.gesamtpreis)}</td>
                    <td className="text-end">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={t('auftraege.actionsFor', { nummer: o.auftragsnummer })}
                          items={[
                            { key: 'open', label: t('auftraege.action.open'), href: `/auftraege/detail/?id=${o.id}` },
                            { key: 'duplicate', label: t('auftraege.action.duplicate'), onSelect: () => startDuplicate(o.id) },
                            ...(darfLoeschen
                              ? [{ key: 'delete', label: t('common.delete'), danger: true, onSelect: () => setConfirmDelete(o) }]
                              : []),
                          ] satisfies ActionMenuItem[]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filter !== 'nachsorge' && (
        <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={istKopie ? t('auftraege.duplicate.title') : t('auftraege.new')}
      >
        <form onSubmit={save} className="space-y-4">
          {istKopie && (
            <p className="rounded-lg border border-copper/25 bg-copper-soft/40 px-3 py-2 text-xs text-chrome-300">
              {t('auftraege.duplicate.hint')}
            </p>
          )}
          {preiseErgaenzen && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-caution/30 bg-caution-soft px-3 py-2 text-xs text-caution"
            >
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span>{t('auftraege.uebernahme.preiseHinweis')}</span>
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{t('auftraege.form.kunde')}<RequiredMark /></label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }}
                required
              >
                <option value="">{t('auftraege.form.selectPlaceholder')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {kundenName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('auftraege.form.fahrzeug')}</label>
              <select className="select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">{t('auftraege.form.optionalPlaceholder')}</option>
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
              <label className="label">{t('auftraege.form.leistungsart')}</label>
              <select className="select" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="aufbereitung">{t('auftraege.service.aufbereitung')}</option>
                <option value="folierung">{t('auftraege.service.folierung')}</option>
                <option value="ppf">{t('auftraege.service.ppf')}</option>
                <option value="sonstiges">{t('auftraege.service.sonstiges')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('auftraege.form.materialkosten')}</label>
              <input type="number" step="0.01" className="input" value={materialkosten} onChange={(e) => setMaterialkosten(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">{t('auftraege.form.positionen')}</label>
              <button type="button" className="link-action text-sm" onClick={addItem}>
                {t('auftraege.form.addPosition')}
              </button>
            </div>
            {/* Mobil: Beschreibung volle Breite, darunter Menge/Preis/Summe. */}
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      className="input"
                      placeholder={t('auftraege.form.beschreibung')}
                      value={it.beschreibung}
                      onChange={(e) => setItem(i, { beschreibung: e.target.value })}
                    />
                    <select
                      className="input mt-1 text-xs"
                      value=""
                      onChange={(e) => e.target.value && pickService(i, e.target.value)}
                    >
                      <option value="">{t('auftraege.form.fromService')}</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({eur(s.basispreis)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <input type="number" step="0.1" className="input" placeholder={t('auftraege.form.menge')} value={it.menge} onChange={(e) => setItem(i, { menge: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input type="number" step="0.01" className="input" placeholder={t('auftraege.form.einzelpreis')} value={it.einzelpreis} onChange={(e) => setItem(i, { einzelpreis: Number(e.target.value) })} />
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

          <div>
            <label className="label">
              {t('auftraege.form.geplanteDauer')} <span className="text-chrome-600">{t('ui.optional')}</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="input"
              placeholder={
                sollVorschlagMin > 0
                  ? t('auftraege.form.geplanteDauerVorschlag', {
                      std: (sollVorschlagMin / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 }),
                    })
                  : t('auftraege.form.geplanteDauerPlaceholder')
              }
              value={geplanteDauerStd}
              onChange={(e) => setGeplanteDauerStd(e.target.value)}
            />
            <p className="mt-1 text-xs text-chrome-500">{t('auftraege.form.geplanteDauerHint')}</p>
          </div>

          <div className="rounded-lg bg-ink-900/60 p-3 text-sm">
            <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.form.netto')}</span><span>{eur(netto)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.form.mwst')}</span><span>{eur(mwst)}</span></div>
            <div className="mt-1 flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('auftraege.col.gesamt')}</span><span>{eur(brutto)}</span></div>
          </div>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('auftraege.saving') : t('auftraege.submit')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title={t('auftraege.delete.title')}
        message={
          confirmDelete
            ? t('auftraege.delete.msg', { nummer: confirmDelete.auftragsnummer })
            : ''
        }
        confirmLabel={t('common.delete')}
        busy={deleting}
        onConfirm={deleteOrder}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
