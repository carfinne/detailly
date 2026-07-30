'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { Modal, ErrorBox, Loading } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useSteuer } from '@/lib/entitlements';

// Editierbare Position im lokalen Modal-Zustand (Beschreibung/Menge/Einzelpreis).
type EditItem = { beschreibung: string; menge: number; einzelpreis: number };

const MWST_SAETZE = [19, 7, 0];

/**
 * Ein Beleg (Angebot ODER Rechnung) ist gesperrt (nur lesen), sobald er
 * festgeschrieben ist. DIESELBE Regel wie der Server in invoice-rules.ts
 * (istBelegGesperrt) – die UI blendet nur aus, die harte Sperre steht im
 * Backend (409):
 *   - Rechnung: gesperrt, sobald sie festgesetzt ist (Status != Entwurf).
 *   - Angebot:  gesperrt, sobald es entschieden ist (angenommen/abgelehnt).
 * Ein clientseitig „abgelaufenes" Angebot bleibt persistiert OFFEN -> editierbar.
 */
export function istBelegGesperrt(inv: Pick<Invoice, 'art' | 'status' | 'angebotStatus'>): boolean {
  if (inv.art === 'rechnung') return inv.status !== 'entwurf';
  return inv.angebotStatus === 'angenommen' || inv.angebotStatus === 'abgelehnt';
}

/**
 * Beleg-Positionen bearbeiten (Entwurf-Rechnung / offenes Angebot) ODER – bei
 * festgeschriebenen Belegen – die Positionen nur lesen mit einem klaren
 * GoBD-Hinweis und dem Weg zur Korrektur (Storno/Gutschrift). Der Beleg wird
 * beim Oeffnen frisch geladen (Listen-Projektion enthaelt keine Positionen).
 */
export function BelegBearbeitenModal({
  open,
  belegId,
  onClose,
  onSaved,
  onRequestStorno,
}: {
  open: boolean;
  belegId: string | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  /** Oeffnet den bestehenden Storno-Dialog der Liste (nur festgeschriebene Rechnung). */
  onRequestStorno: (inv: Invoice) => void;
}) {
  const t = useT();
  // §19-Kleinunternehmer aus den bereits geladenen Entitlements (keine neue Abfrage).
  // Gilt tenant-weit -> betrifft Angebot UND Rechnung gleichermassen.
  const { kleinunternehmer } = useSteuer();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<EditItem[]>([]);
  const [hinweis, setHinweis] = useState('');
  const [mwstSatz, setMwstSatz] = useState(19);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const laden = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError('');
    setSaveError('');
    try {
      const full = await api.get<Invoice>(`/invoices/${id}`);
      setInv(full);
      const basis = (full.items ?? []).map((it) => ({
        beschreibung: it.beschreibung,
        menge: Number(it.menge),
        einzelpreis: Number(it.einzelpreis),
      }));
      setItems(basis.length > 0 ? basis : [{ beschreibung: '', menge: 1, einzelpreis: 0 }]);
      setHinweis(full.hinweis ?? '');
      setMwstSatz(MWST_SAETZE.includes(Number(full.mwstSatz)) ? Number(full.mwstSatz) : 19);
    } catch (e) {
      setInv(null);
      setLoadError(e instanceof Error ? e.message : t('rechnungen.edit.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Bei jedem Oeffnen (neue belegId) frisch laden; beim Schliessen aufraeumen.
  useEffect(() => {
    if (open && belegId) {
      void laden(belegId);
    } else if (!open) {
      setInv(null);
      setItems([]);
      setLoadError('');
      setSaveError('');
    }
  }, [open, belegId, laden]);

  function setItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { beschreibung: '', menge: 1, einzelpreis: 0 }]);
  }
  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const gesperrt = inv ? istBelegGesperrt(inv) : false;

  // Live-Summen im Bearbeiten-Modus mit dem TATSAECHLICH wirksamen Satz: bei §19-
  // Kleinunternehmern erzwingt der Server 0 %, deshalb rechnet auch die Vorschau mit
  // 0 % (sonst zeigt der Wähler 19 % an, gespeichert werden aber 0 %).
  const effektiverSatz = kleinunternehmer ? 0 : mwstSatz;
  const netto = items.reduce((s, it) => s + Number(it.menge || 0) * Number(it.einzelpreis || 0), 0);
  const mwst = Math.round(netto * (effektiverSatz / 100) * 100) / 100;
  const brutto = Math.round((netto + mwst) * 100) / 100;

  async function speichern() {
    if (!inv) return;
    const gefiltert = items.filter((it) => it.beschreibung.trim());
    if (gefiltert.length === 0) {
      setSaveError(t('rechnungen.edit.noItemsWarning'));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/invoices/${inv.id}`, {
        items: gefiltert.map((it) => ({
          beschreibung: it.beschreibung,
          menge: Number(it.menge),
          einzelpreis: Number(it.einzelpreis),
        })),
        hinweis,
        mwstSatz: effektiverSatz,
      });
      onSaved(t('rechnungen.edit.saved'));
    } catch (e) {
      // Serverseitige GoBD-Sperre (409) landet hier mit klarer Meldung.
      setSaveError(e instanceof Error ? e.message : t('rechnungen.edit.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const titel = gesperrt ? t('rechnungen.edit.viewTitle') : t('rechnungen.edit.title');

  return (
    <Modal open={open} onClose={onClose} title={titel} size="lg">
      {loading ? (
        <Loading />
      ) : loadError ? (
        <ErrorBox message={loadError} />
      ) : !inv ? null : gesperrt ? (
        // --- Festgeschrieben: klarer Hinweis + Nur-Lese-Ansicht + Korrekturweg ---
        <div className="space-y-4">
          <div
            role="note"
            className="rounded-lg border border-caution/30 bg-caution/10 px-3 py-2 text-sm text-caution"
          >
            {inv.art === 'rechnung'
              ? t('rechnungen.edit.lockedRechnung')
              : t('rechnungen.edit.lockedAngebot')}
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('rechnungen.edit.col.beschreibung')}</th>
                  <th className="text-end">{t('rechnungen.edit.col.menge')}</th>
                  <th className="text-end">{t('rechnungen.edit.col.einzelpreis')}</th>
                  <th className="text-end">{t('rechnungen.edit.col.gesamt')}</th>
                </tr>
              </thead>
              <tbody>
                {(inv.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-chrome-500">{t('rechnungen.edit.empty')}</td>
                  </tr>
                ) : (
                  (inv.items ?? []).map((it, i) => (
                    <tr key={it.id ?? i}>
                      <td>{it.beschreibung}</td>
                      <td className="text-end">{it.menge}</td>
                      <td className="text-end">{eur(it.einzelpreis)}</td>
                      <td className="text-end">
                        {eur(it.gesamtpreis ?? Number(it.menge) * Number(it.einzelpreis))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-chrome-400">{t('rechnungen.edit.netto')}</span><span>{eur(inv.netto)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">{t('rechnungen.edit.mwst')}</span><span>{eur(inv.mwst)}</span></div>
            <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('rechnungen.edit.brutto')}</span><span>{eur(inv.brutto)}</span></div>
          </div>

          {inv.hinweis && (
            <div className="text-sm">
              <div className="text-chrome-400">{t('rechnungen.edit.hinweis')}</div>
              <div className="whitespace-pre-line text-chrome-200">{inv.hinweis}</div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {t('common.close')}
            </button>
            {/* Korrekturweg: nur eine noch nicht stornierte Rechnung kann storniert werden. */}
            {inv.art === 'rechnung' && inv.status !== 'storniert' && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  onRequestStorno(inv);
                  onClose();
                }}
              >
                {t('rechnungen.edit.storno')}
              </button>
            )}
          </div>
        </div>
      ) : (
        // --- Editierbar: Positionen hinzufuegen/aendern/entfernen ---
        <div className="space-y-4">
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <input
                    className="input"
                    placeholder={t('rechnungen.edit.col.beschreibung')}
                    aria-label={t('rechnungen.edit.col.beschreibung')}
                    value={it.beschreibung}
                    onChange={(e) => setItem(i, { beschreibung: e.target.value })}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    placeholder={t('rechnungen.edit.col.menge')}
                    aria-label={t('rechnungen.edit.col.menge')}
                    value={it.menge}
                    onChange={(e) => setItem(i, { menge: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder={t('rechnungen.edit.col.einzelpreis')}
                    aria-label={t('rechnungen.edit.col.einzelpreis')}
                    value={it.einzelpreis}
                    onChange={(e) => setItem(i, { einzelpreis: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-4 flex items-center justify-end gap-1 text-sm sm:col-span-2">
                  <span className="text-chrome-400">
                    {eur(Number(it.menge || 0) * Number(it.einzelpreis || 0))}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="link-danger"
                      aria-label={t('rechnungen.edit.removePosition')}
                      onClick={() => removeItem(i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="link-action text-sm" onClick={addItem}>
            {t('rechnungen.edit.addPosition')}
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              {kleinunternehmer ? (
                // §19: der Server erzwingt 0 % – keinen Wähler zeigen, der eine
                // falsche Vorschau vorgaukeln würde, sondern einen klaren Hinweis.
                <>
                  <span className="label block">{t('rechnungen.edit.mwstSatz')}</span>
                  <p role="note" className="text-sm text-chrome-400">
                    {t('rechnungen.edit.kleinunternehmerHint')}
                  </p>
                </>
              ) : (
                <>
                  <label className="label" htmlFor="beleg-mwst">{t('rechnungen.edit.mwstSatz')}</label>
                  <select
                    id="beleg-mwst"
                    className="input"
                    value={mwstSatz}
                    onChange={(e) => setMwstSatz(Number(e.target.value))}
                  >
                    {MWST_SAETZE.map((s) => (
                      <option key={s} value={s}>{s} %</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="beleg-hinweis">{t('rechnungen.edit.hinweis')}</label>
            <textarea
              id="beleg-hinweis"
              className="input min-h-[72px]"
              value={hinweis}
              onChange={(e) => setHinweis(e.target.value)}
            />
          </div>

          <div className="ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-chrome-400">{t('rechnungen.edit.netto')}</span><span>{eur(netto)}</span></div>
            <div className="flex justify-between"><span className="text-chrome-400">{t('rechnungen.edit.mwst')} ({effektiverSatz} %)</span><span>{eur(mwst)}</span></div>
            <div className="flex justify-between border-t border-ink-700 pt-1 font-semibold"><span>{t('rechnungen.edit.brutto')}</span><span>{eur(brutto)}</span></div>
          </div>

          {saveError && <ErrorBox message={saveError} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={speichern} disabled={saving}>
              {saving && <span className="spinner" />}
              {saving ? t('common.loadingEllipsis') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
