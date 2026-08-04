'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, appPath, downloadAuthed } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EMPFANG_ROLLEN } from '@/lib/rollen';
import { eur, datum, datumZeit } from '@/lib/format';
import {
  ORDER_STATUS_KEY,
  ORDER_STATUS_COLOR,
  ORDER_STATUS_NEXT,
  SERVICE_TYPE_KEY,
} from '@/lib/labels';
import type { Order } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Badge, SectionCard, ConfirmDialog, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useSteuer, useHasFeature } from '@/lib/entitlements';
import { LeistungDetailsEditor } from '@/components/LeistungDetailsEditor';
import { AngebotsSetDialog } from '@/components/AngebotsSetDialog';
import { AnzahlungDialog } from '@/components/AnzahlungDialog';
import { FahrzeugWechselDialog } from '@/components/FahrzeugWechselDialog';
import { FotoBereich } from '@/components/FotoBereich';
import { OrderTimeCard } from '@/components/OrderTimeCard';
import { OrderMaterialCard } from '@/components/OrderMaterialCard';
import { ProfitabilityCard } from '@/components/ProfitabilityCard';

/**
 * Welle 2-B (Teil 2): Vorschlagswerte "Wiedervorlage in N Monaten" je Leistungsart
 * (frei aenderbar). Keramik/PPF/Coating ~12 Monate (Auffrischung/Kontrolle),
 * Folierung ~24 Monate. Reiner UI-Vorschlag – die Faelligkeit setzt der Nutzer.
 */
const NACHSORGE_VORSCHLAG_MONATE: Record<string, number> = {
  aufbereitung: 12,
  ppf: 12,
  folierung: 24,
  sonstiges: 12,
};
const NACHSORGE_MONATE_MIN = 1;
const NACHSORGE_MONATE_MAX = 60;

/** today + n Monate als ISO-String (Datum, Mitternacht lokal genuegt fuers Backend). */
function inMonaten(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString();
}

function AuftragDetail() {
  const t = useT();
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // §19 UStG: Kleinunternehmer -> Satz serverseitig 0 % (Select ausgeblendet);
  // sonst mit dem Standard-Satz des Betriebs vorbelegen (i. d. R. 19 %).
  const { kleinunternehmer, standardMwstSatz } = useSteuer();
  const [mwstSatz, setMwstSatz] = useState(19);
  useEffect(() => {
    setMwstSatz(kleinunternehmer ? 0 : standardMwstSatz);
  }, [kleinunternehmer, standardMwstSatz]);
  const [trackToken, setTrackToken] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [anzahlungOpen, setAnzahlungOpen] = useState(false);
  const [vehicleSwitchOpen, setVehicleSwitchOpen] = useState(false);
  const [uebergabeBusy, setUebergabeBusy] = useState(false);
  const [karteBusy, setKarteBusy] = useState(false);
  const [protokollBusy, setProtokollBusy] = useState(false);
  // Welle 1-A (F2): Positionen nachtraeglich bearbeiten (add/change/remove, Summe
  // live). Gespeichert wird ueber den bestehenden PATCH-Pfad; die GoBD-Sperre
  // (abgerechnet/festgeschrieben) erzwingt der Server (409) und blendet das UI aus.
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<
    { beschreibung: string; menge: number; einzelpreis: number; geplanteDauerMinuten?: number | null }[]
  >([]);
  const [editMaterial, setEditMaterial] = useState('');
  // Geplante Gesamtdauer (Soll-Override) in Stunden – leer = aus Positionen summieren.
  const [editGeplanteDauerStd, setEditGeplanteDauerStd] = useState('');
  const [savingItems, setSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState('');
  // Welle 2-B (Teil 2): Nachsorge-Wiedervorlage. Monate-Auswahl (Vorschlag je
  // Leistungsart, frei aenderbar) + Busy-Flag. Kein Auto-Versand.
  const [nachsorgeMonate, setNachsorgeMonate] = useState(12);
  const [nachsorgeBusy, setNachsorgeBusy] = useState(false);
  const toast = useToast();

  const hasFeature = useHasFeature();
  // Pro-Add-on "Kunden-Erlebnis": schaltet die gebrandete Uebergabe-Mappe frei.
  const kundenerlebnis = hasFeature('kundenerlebnis');

  const { user } = useAuth();
  // Kunden-Tracking (Link erzeugen/widerrufen) ist Empfang/Leitung. Die Backend-
  // Endpunkte sind @Roles(OWNER, MANAGER, RECEPTIONIST) – Techniker sehen die
  // Karte gar nicht, damit kein Knopf ins 403 laeuft.
  const darfTracking = !!user && EMPFANG_ROLLEN.includes(user.role);

  const trackUrl = trackToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${appPath('/track/')}?t=${trackToken}`
    : '';
  const mappeUrl = trackToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${appPath('/mappe/')}?t=${trackToken}`
    : '';
  const mappeSichtbar = order?.status === 'fertig' || order?.status === 'abgerechnet';

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
      toast(t('auftraege.detail.tracking.regenerated'));
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
    // Ohne ?id (z. B. abgeschnittener Link) nicht ewig im Spinner hängen, sondern
    // klar melden (Muster aus eingangsrechnungen/detail).
    if (id) load();
    else setError(t('auftraege.detail.error.load'));
  }, [id, load, t]);

  // Nachsorge-Monate mit dem Vorschlag der Leistungsart vorbelegen (frei aenderbar),
  // sobald der Auftrag geladen ist und noch keine Nachsorge gesetzt wurde.
  useEffect(() => {
    if (order && !order.nachsorgeAm) {
      setNachsorgeMonate(NACHSORGE_VORSCHLAG_MONATE[order.serviceType] ?? 12);
    }
  }, [order]);

  // Nachsorge-Wiedervorlage setzen/entfernen (PATCH /orders/:id/nachsorge). Kein
  // Auto-Versand: erzeugt spaeter nur eine In-App-Erinnerung fuer den Betrieb.
  async function saveNachsorge(monate: number | null) {
    setNachsorgeBusy(true);
    try {
      await api.patch(`/orders/${id}/nachsorge`, {
        nachsorgeAm: monate == null ? null : inMonaten(monate),
      });
      await load();
      toast(monate == null ? t('auftraege.nachsorge.clearedToast') : t('auftraege.nachsorge.setToast'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setNachsorgeBusy(false);
    }
  }

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

  // Fahrzeug des Auftrags wechseln (PATCH /orders/:id). Wirft bei Fehler weiter,
  // damit der Dialog den Fehler inline anzeigt; bei Erfolg neu laden + schliessen.
  async function switchVehicle(vehicleId: string) {
    await api.patch(`/orders/${id}`, { vehicleId });
    await load();
    setVehicleSwitchOpen(false);
    toast(t('auftraege.detail.vehicleSwitch.done'));
  }

  // Vorher-Fotos fuer die oeffentliche Kundenmappe freigeben/sperren (PATCH /orders/:id).
  async function toggleVorherInMappe(next: boolean) {
    try {
      await api.patch(`/orders/${id}`, { mappeVorherFotosZeigen: next });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
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

  // Auftragskarte (Werkstatt-Laufzettel, PDF) tenant-sicher herunterladen.
  async function downloadAuftragskarte() {
    if (!order) return;
    setKarteBusy(true);
    try {
      await downloadAuthed(`/orders/${id}/auftragskarte.pdf`, `Auftragskarte_${order.auftragsnummer}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dokumente.error'));
    } finally {
      setKarteBusy(false);
    }
  }

  // Annahme-/Übergabeprotokoll (PDF) tenant-sicher herunterladen.
  async function downloadUebergabeprotokoll() {
    if (!order) return;
    setProtokollBusy(true);
    try {
      await downloadAuthed(
        `/orders/${id}/uebergabeprotokoll.pdf`,
        `Uebergabeprotokoll_${order.auftragsnummer}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dokumente.error'));
    } finally {
      setProtokollBusy(false);
    }
  }

  // --- Positionen bearbeiten (F2) ------------------------------------------
  function startEditPositionen() {
    const basis = (order?.items ?? []).map((it) => ({
      beschreibung: it.beschreibung,
      menge: Number(it.menge),
      einzelpreis: Number(it.einzelpreis),
      // Soll-Dauer der Position erhalten, damit ein Positions-Edit sie nicht loescht.
      geplanteDauerMinuten: it.geplanteDauerMinuten ?? null,
    }));
    setEditItems(basis.length > 0 ? basis : [{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
    setEditMaterial(order?.materialkosten ? String(order.materialkosten) : '');
    setEditGeplanteDauerStd(
      order?.geplanteDauerMinuten != null
        ? String(Math.round((order.geplanteDauerMinuten / 60) * 100) / 100)
        : '',
    );
    setItemsError('');
    setEditMode(true);
  }
  function cancelEditPositionen() {
    setEditMode(false);
    setItemsError('');
  }
  function setEditItem(
    i: number,
    patch: Partial<{ beschreibung: string; menge: number; einzelpreis: number; geplanteDauerMinuten: number | null }>,
  ) {
    setEditItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addEditItem() {
    setEditItems((prev) => [...prev, { beschreibung: '', menge: 1, einzelpreis: 0 }]);
  }
  function removeEditItem(i: number) {
    setEditItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  async function saveEditPositionen() {
    setSavingItems(true);
    setItemsError('');
    try {
      const payload: Record<string, unknown> = {
        items: editItems
          .filter((it) => it.beschreibung.trim())
          .map((it) => ({
            beschreibung: it.beschreibung,
            menge: Number(it.menge),
            einzelpreis: Number(it.einzelpreis),
            ...(it.geplanteDauerMinuten != null
              ? { geplanteDauerMinuten: Math.round(Number(it.geplanteDauerMinuten)) }
              : {}),
          })),
        materialkosten: Number(editMaterial || 0),
        // Soll-Override: leer -> null (Server summiert aus den Positionen).
        geplanteDauerMinuten:
          editGeplanteDauerStd.trim() === '' ? null : Math.round(Number(editGeplanteDauerStd) * 60),
      };
      await api.patch(`/orders/${id}`, payload);
      await load();
      setEditMode(false);
      toast(t('auftraege.detail.positionen.saved'));
    } catch (e) {
      // Serverseitige GoBD-Sperre (409) landet hier mit klarer Meldung.
      setItemsError(e instanceof Error ? e.message : t('auftraege.detail.positionen.saveError'));
    } finally {
      setSavingItems(false);
    }
  }

  // Full-Page-Fehler nur, wenn der Auftrag selbst nicht geladen werden konnte.
  if (error && !order) return <ErrorBox message={error} />;
  if (!order) return <Loading />;

  const next = ORDER_STATUS_NEXT[order.status] ?? [];

  // GoBD-Sperre: Server-Flag `abgerechnet` (festgeschriebene Rechnung ODER Status
  // abgerechnet/storniert). Fallback auf den Status, falls ein aelteres Backend das
  // Flag nicht liefert. Gesperrt -> Positionen read-only + Hinweis.
  const positionenGesperrt =
    order.abgerechnet === true || order.status === 'abgerechnet' || order.status === 'storniert';

  // Live-Summen im Bearbeiten-Modus. MwSt-Satz = EFFEKTIVER Satz des Betriebs
  // (Kleinunternehmer § 19 -> 0 %, sonst Standardsatz aus den Einstellungen, via
  // useSteuer), damit die Vorschau mit der serverseitigen Auftrags-Kalkulation
  // uebereinstimmt (der Server rechnet ebenfalls mit dem effektiven Satz).
  const editSatz = kleinunternehmer ? 0 : standardMwstSatz;
  const editNetto =
    editItems.reduce((s, it) => s + Number(it.menge) * Number(it.einzelpreis), 0) +
    Number(editMaterial || 0);
  const editMwst = Math.round(editNetto * (editSatz / 100) * 100) / 100;
  const editBrutto = Math.round((editNetto + editMwst) * 100) / 100;

  return (
    <div>
      <PageHeader
        title={order.auftragsnummer}
        subtitle={t(SERVICE_TYPE_KEY[order.serviceType] ?? order.serviceType)}
        action={
          <div className="flex items-center gap-2">
            {hasFeature('schichtdicke') && (
              <Link
                href={`/schichtdicke?order=${order.id}${order.vehicleId ? `&vehicle=${order.vehicleId}` : ''}`}
                className="btn-ghost"
              >
                {t('nav.item.schichtdicke')}
              </Link>
            )}
            {/* Welle 1-A (F1): als Vorlage fuer einen neuen Auftrag verwenden. */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => router.push(`/auftraege?kopie=${order.id}`)}
            >
              {t('auftraege.action.duplicate')}
            </button>
            <Link href="/auftraege" className="btn-ghost">
              {t('common.back')}
            </Link>
          </div>
        }
      />

      {/* Aktionsfehler (Status, Belege, Tracking) inline – die Seite bleibt bedienbar. */}
      {error && <ErrorBox message={error} className="mb-4" />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title={t('auftraege.form.positionen')} className="lg:col-span-2">
          {/* Kopf: Bearbeiten-Umschalter ODER GoBD-Sperr-Hinweis. */}
          {positionenGesperrt ? (
            <div
              role="note"
              className="mb-3 rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-xs text-caution"
            >
              {t('auftraege.detail.positionen.locked')}
            </div>
          ) : !editMode ? (
            <div className="mb-3 flex justify-end">
              <button type="button" className="btn-ghost btn-sm" onClick={startEditPositionen}>
                {t('auftraege.detail.positionen.edit')}
              </button>
            </div>
          ) : null}

          {editMode && !positionenGesperrt ? (
            <div>
              <div className="space-y-2">
                {editItems.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        className="input"
                        placeholder={t('auftraege.form.beschreibung')}
                        value={it.beschreibung}
                        onChange={(e) => setEditItem(i, { beschreibung: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        step="0.1"
                        className="input"
                        placeholder={t('auftraege.form.menge')}
                        value={it.menge}
                        onChange={(e) => setEditItem(i, { menge: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        placeholder={t('auftraege.form.einzelpreis')}
                        value={it.einzelpreis}
                        onChange={(e) => setEditItem(i, { einzelpreis: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-4 flex items-center justify-end gap-1 text-sm sm:col-span-2">
                      <span className="text-chrome-400">{eur(Number(it.menge) * Number(it.einzelpreis))}</span>
                      {editItems.length > 1 && (
                        <button
                          type="button"
                          className="link-danger"
                          aria-label={t('auftraege.detail.positionen.remove')}
                          onClick={() => removeEditItem(i)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <button type="button" className="link-action text-sm" onClick={addEditItem}>
                  {t('auftraege.form.addPosition')}
                </button>
              </div>
              <div className="mt-3 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{t('auftraege.form.materialkosten')}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={editMaterial}
                    onChange={(e) => setEditMaterial(e.target.value)}
                  />
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
                    placeholder={(() => {
                      const min = editItems.reduce((s, it) => s + (Number(it.geplanteDauerMinuten) || 0), 0);
                      return min > 0
                        ? t('auftraege.form.geplanteDauerVorschlag', {
                            std: (min / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 }),
                          })
                        : t('auftraege.form.geplanteDauerPlaceholder');
                    })()}
                    value={editGeplanteDauerStd}
                    onChange={(e) => setEditGeplanteDauerStd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('auftraege.form.beschreibung')}</th>
                    <th className="text-end">{t('auftraege.form.menge')}</th>
                    <th className="text-end">{t('auftraege.form.einzelpreis')}</th>
                    <th className="text-end">{t('auftraege.col.gesamt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((it, i) => (
                    <tr key={it.id ?? i}>
                      <td>{it.beschreibung}</td>
                      <td className="text-end">{it.menge}</td>
                      <td className="text-end">{eur(it.einzelpreis)}</td>
                      <td className="text-end">{eur(it.gesamtpreis ?? Number(it.menge) * Number(it.einzelpreis))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 ms-auto max-w-xs space-y-1 text-sm">
            {editMode && !positionenGesperrt ? (
              <>
                {Number(editMaterial) ? (
                  <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.material')}</span><span>{eur(Number(editMaterial))}</span></div>
                ) : null}
                <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.form.netto')}</span><span>{eur(editNetto)}</span></div>
                <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.mwst')}</span><span>{eur(editMwst)}</span></div>
                <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('auftraege.col.gesamt')}</span><span>{eur(editBrutto)}</span></div>
              </>
            ) : (
              <>
                {order.materialkosten ? (
                  <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.material')}</span><span>{eur(order.materialkosten)}</span></div>
                ) : null}
                <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.form.netto')}</span><span>{eur(order.nettoSumme)}</span></div>
                <div className="flex justify-between"><span className="text-chrome-400">{t('auftraege.detail.mwst')}</span><span>{eur(order.mwstBetrag)}</span></div>
                <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('auftraege.col.gesamt')}</span><span>{eur(order.gesamtpreis)}</span></div>
              </>
            )}
          </div>

          {editMode && !positionenGesperrt && (
            <>
              {itemsError && <ErrorBox message={itemsError} className="mt-3" />}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={cancelEditPositionen} disabled={savingItems}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="btn-primary" onClick={saveEditPositionen} disabled={savingItems}>
                  {savingItems && <span className="spinner" />}
                  {savingItems ? t('auftraege.saving') : t('common.save')}
                </button>
              </div>
            </>
          )}
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
              {order.customerId && (
                <button
                  className="btn-ghost mt-2 w-full"
                  disabled={busy}
                  onClick={() => setVehicleSwitchOpen(true)}
                >
                  {order.vehicleId
                    ? t('auftraege.detail.vehicleSwitch.action')
                    : t('auftraege.detail.vehicleSwitch.assign')}
                </button>
              )}
            </SectionCard>
          )}

          {darfTracking && (
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

                {/* Pro-Add-on: gebrandete Uebergabe-Mappe (gleicher Link). */}
                {kundenerlebnis && (
                  <div className="mt-1 rounded-xl border border-copper/25 bg-copper-soft/40 px-3 py-2.5">
                    <p className="text-xs font-medium text-chrome-100">{t('auftraege.detail.mappe.title')}</p>
                    <p className="mt-0.5 text-xs text-chrome-400">
                      {mappeSichtbar
                        ? t('auftraege.detail.mappe.ready')
                        : t('auftraege.detail.mappe.pending')}
                    </p>
                    <a
                      href={mappeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-action mt-1.5 inline-block text-xs"
                    >
                      {t('auftraege.detail.mappe.preview')}
                    </a>

                    {/* Freigabe der internen Vorher-Fotos fuer die Kundenmappe. */}
                    <label className="mt-2.5 flex cursor-pointer items-start gap-2 border-t border-copper/15 pt-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
                        checked={!!order.mappeVorherFotosZeigen}
                        onChange={(e) => toggleVorherInMappe(e.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-chrome-100">
                          {t('auftraege.detail.mappe.vorherToggle')}
                        </span>
                        <span className="mt-0.5 block text-xs text-chrome-400">
                          {t('auftraege.detail.mappe.vorherHint')}
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
          )}

          <SectionCard title={t('auftraege.detail.appointments')}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-chrome-400">{t('auftraege.detail.start')}</dt><dd>{datumZeit(order.geplanterStart)}</dd></div>
              <div className="flex justify-between"><dt className="text-chrome-400">{t('auftraege.detail.end')}</dt><dd>{datumZeit(order.geplantesEnde)}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard title={t('auftraege.detail.documents')}>
            <div className="field mb-3">
              <label className="label" htmlFor="mwstSatz">{t('auftraege.detail.vatRate')}</label>
              {kleinunternehmer ? (
                // §19: kein Satz-Select – der Server erzwingt 0 % (Kleinunternehmer).
                <div>
                  <Badge className="badge-neutral">{t('auftraege.detail.vat.kleinunternehmer')}</Badge>
                  <p className="help mt-1.5">{t('auftraege.detail.vat.kleinunternehmerHint')}</p>
                </div>
              ) : (
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
              )}
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
              <button className="btn-ghost w-full" disabled={karteBusy} onClick={downloadAuftragskarte}>
                {karteBusy && <span className="spinner" />}
                {karteBusy ? t('dokumente.loading') : t('dokumente.auftragskarte')}
              </button>
              <button className="btn-ghost w-full" disabled={protokollBusy} onClick={downloadUebergabeprotokoll}>
                {protokollBusy && <span className="spinner" />}
                {protokollBusy ? t('dokumente.loading') : t('dokumente.uebergabeprotokoll')}
              </button>
            </div>
          </SectionCard>

          {/* Welle 2-B (Teil 2): Nachsorge-Wiedervorlage – nur am abgeschlossenen
              Auftrag (fertig/abgerechnet). Reine In-App-Erinnerung, KEIN Auto-Versand. */}
          {(order.status === 'fertig' || order.status === 'abgerechnet') && (
            <SectionCard
              title={t('auftraege.detail.nachsorge.title')}
              subtitle={t('auftraege.detail.nachsorge.subtitle')}
            >
              {order.nachsorgeAm && !order.nachsorgeErledigtAm ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-copper/25 bg-copper-soft/40 px-3 py-2.5">
                    <p className="text-sm text-chrome-100">
                      {t('auftraege.detail.nachsorge.setFor', { datum: datum(order.nachsorgeAm) })}
                    </p>
                    <p className="mt-0.5 text-xs text-chrome-400">
                      {order.nachsorgeErinnertAm
                        ? t('auftraege.detail.nachsorge.reminderActive')
                        : t('auftraege.detail.nachsorge.scheduled')}
                    </p>
                  </div>
                  <button
                    className="btn-ghost w-full"
                    disabled={nachsorgeBusy}
                    onClick={() => saveNachsorge(null)}
                  >
                    {nachsorgeBusy && <span className="spinner" />}
                    {t('auftraege.detail.nachsorge.remove')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-chrome-400">{t('auftraege.detail.nachsorge.hint')}</p>
                  <div className="flex items-end gap-2">
                    <div className="field mb-0">
                      <label className="label" htmlFor="nachsorgeMonate">
                        {t('auftraege.detail.nachsorge.monthsLabel')}
                      </label>
                      <input
                        id="nachsorgeMonate"
                        className="input w-24"
                        type="number"
                        min={NACHSORGE_MONATE_MIN}
                        max={NACHSORGE_MONATE_MAX}
                        step={1}
                        inputMode="numeric"
                        value={nachsorgeMonate}
                        onChange={(e) => setNachsorgeMonate(Number(e.target.value))}
                      />
                    </div>
                    <button
                      className="btn-primary"
                      disabled={nachsorgeBusy || !(nachsorgeMonate >= NACHSORGE_MONATE_MIN && nachsorgeMonate <= NACHSORGE_MONATE_MAX)}
                      onClick={() => saveNachsorge(nachsorgeMonate)}
                    >
                      {nachsorgeBusy && <span className="spinner" />}
                      {t('auftraege.detail.nachsorge.set')}
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          )}
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

      {order.customerId && (
        <FahrzeugWechselDialog
          open={vehicleSwitchOpen}
          onClose={() => setVehicleSwitchOpen(false)}
          customerId={order.customerId}
          currentVehicleId={order.vehicleId}
          onConfirm={switchVehicle}
          note={t('auftraege.detail.vehicleSwitch.note')}
        />
      )}
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
