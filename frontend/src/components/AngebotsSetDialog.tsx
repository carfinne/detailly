'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Order } from '@/lib/types';
import { Modal, ErrorBox } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Dialog zum Erzeugen eines Angebots-Sets aus 2–3 Varianten (Welle 1, F1).
// Jede Variante bekommt eine Kopie der Auftragspositionen, die frei anpassbar
// ist (z. B. Teil- vs. Vollfolierung). Der Kunde wählt später genau EINE.

interface PosEntwurf {
  beschreibung: string;
  menge: string;
  einzelpreis: string;
}
interface VarianteEntwurf {
  label: string;
  hinweis: string;
  mwstSatz: number;
  positionen: PosEntwurf[];
}

function leerePosition(): PosEntwurf {
  return { beschreibung: '', menge: '1', einzelpreis: '' };
}

// Auftragspositionen als bearbeitbare Kopie (Basis jeder Variante).
function basisPositionen(order: Order): PosEntwurf[] {
  const items = order.items ?? [];
  if (items.length === 0) return [leerePosition()];
  return items.map((i) => ({
    beschreibung: i.beschreibung,
    menge: String(i.menge),
    einzelpreis: String(i.einzelpreis),
  }));
}

function neueVariante(order: Order, mwstSatz: number, label: string): VarianteEntwurf {
  return { label, hinweis: '', mwstSatz, positionen: basisPositionen(order) };
}

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function nettoVon(v: VarianteEntwurf): number {
  return v.positionen.reduce((s, p) => s + num(p.menge) * num(p.einzelpreis), 0);
}

export function AngebotsSetDialog({
  open,
  onClose,
  order,
  mwstSatz,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  /** Vorbelegter MwSt-Satz (aus der Belege-Card). */
  mwstSatz: number;
  onCreated: () => void;
}) {
  const t = useT();
  const [varianten, setVarianten] = useState<VarianteEntwurf[]>(() => [
    neueVariante(order, mwstSatz, t('angebote.set.presetBasis')),
    neueVariante(order, mwstSatz, t('angebote.set.presetPremium')),
  ]);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');

  function schliessen() {
    if (busy) return;
    setFehler('');
    onClose();
  }

  function patchVariante(idx: number, patch: Partial<VarianteEntwurf>) {
    setVarianten((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function patchPosition(vIdx: number, pIdx: number, patch: Partial<PosEntwurf>) {
    setVarianten((vs) =>
      vs.map((v, i) =>
        i === vIdx
          ? { ...v, positionen: v.positionen.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) }
          : v,
      ),
    );
  }
  function positionHinzufuegen(vIdx: number) {
    setVarianten((vs) =>
      vs.map((v, i) => (i === vIdx ? { ...v, positionen: [...v.positionen, leerePosition()] } : v)),
    );
  }
  function positionEntfernen(vIdx: number, pIdx: number) {
    setVarianten((vs) =>
      vs.map((v, i) =>
        i === vIdx ? { ...v, positionen: v.positionen.filter((_, j) => j !== pIdx) } : v,
      ),
    );
  }
  function varianteHinzufuegen() {
    if (varianten.length >= 3) return;
    setVarianten((vs) => [...vs, neueVariante(order, mwstSatz, t('angebote.set.presetWeitere'))]);
  }
  function varianteEntfernen(idx: number) {
    if (varianten.length <= 2) return;
    setVarianten((vs) => vs.filter((_, i) => i !== idx));
  }

  async function erstellen() {
    if (!order.customerId) {
      setFehler(t('angebote.set.errorNoCustomer'));
      return;
    }
    for (const v of varianten) {
      if (!v.label.trim()) {
        setFehler(t('angebote.set.errorNoLabel'));
        return;
      }
      const gueltigePos = v.positionen.filter((p) => p.beschreibung.trim() && num(p.menge) > 0);
      if (gueltigePos.length === 0) {
        setFehler(t('angebote.set.errorNoPositions'));
        return;
      }
    }
    setBusy(true);
    setFehler('');
    try {
      await api.post('/invoices/angebots-set', {
        customerId: order.customerId,
        orderId: order.id,
        varianten: varianten.map((v) => ({
          label: v.label.trim(),
          hinweis: v.hinweis.trim() || undefined,
          mwstSatz: v.mwstSatz,
          items: v.positionen
            .filter((p) => p.beschreibung.trim() && num(p.menge) > 0)
            .map((p) => ({
              beschreibung: p.beschreibung.trim(),
              menge: num(p.menge),
              einzelpreis: num(p.einzelpreis),
            })),
        })),
      });
      onCreated();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('angebote.set.errorGeneric'));
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={schliessen} title={t('angebote.set.title')} size="xl">
      <div className="space-y-5">
        <p className="text-sm text-chrome-400">{t('angebote.set.intro')}</p>
        {fehler && <ErrorBox message={fehler} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {varianten.map((v, vIdx) => {
            const netto = nettoVon(v);
            const brutto = netto * (1 + v.mwstSatz / 100);
            return (
              <div key={vIdx} className="rounded-2xl border border-ink-700 bg-ink-900/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-copper-300">
                    {t('angebote.set.variant', { n: vIdx + 1 })}
                  </span>
                  {varianten.length > 2 && (
                    <button
                      type="button"
                      className="rounded text-xs text-chrome-500 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
                      onClick={() => varianteEntfernen(vIdx)}
                    >
                      {t('angebote.set.removeVariant')}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="field">
                    <label className="label">{t('angebote.set.labelLabel')}</label>
                    <input
                      className="input"
                      value={v.label}
                      placeholder={t('angebote.set.labelPlaceholder')}
                      onChange={(e) => patchVariante(vIdx, { label: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="field">
                      <label className="label">{t('angebote.set.vatLabel')}</label>
                      <select
                        className="input"
                        value={v.mwstSatz}
                        onChange={(e) => patchVariante(vIdx, { mwstSatz: Number(e.target.value) })}
                      >
                        <option value={19}>{t('auftraege.detail.vat.standard')}</option>
                        <option value={7}>{t('auftraege.detail.vat.reduced')}</option>
                        <option value={0}>{t('auftraege.detail.vat.none')}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="label">{t('angebote.set.hinweisLabel')}</label>
                      <input
                        className="input"
                        value={v.hinweis}
                        onChange={(e) => patchVariante(vIdx, { hinweis: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="label mb-1.5">{t('angebote.set.positionen')}</p>
                    <div className="space-y-2">
                      {v.positionen.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-1.5">
                          <input
                            className="input flex-1"
                            aria-label={t('angebote.set.col.beschreibung')}
                            placeholder={t('angebote.set.col.beschreibung')}
                            value={p.beschreibung}
                            onChange={(e) => patchPosition(vIdx, pIdx, { beschreibung: e.target.value })}
                          />
                          <input
                            className="input w-16 text-right"
                            aria-label={t('angebote.set.col.menge')}
                            type="number"
                            min={0}
                            step="any"
                            value={p.menge}
                            onChange={(e) => patchPosition(vIdx, pIdx, { menge: e.target.value })}
                          />
                          <input
                            className="input w-24 text-right"
                            aria-label={t('angebote.set.col.einzelpreis')}
                            type="number"
                            min={0}
                            step="0.01"
                            value={p.einzelpreis}
                            onChange={(e) => patchPosition(vIdx, pIdx, { einzelpreis: e.target.value })}
                          />
                          <button
                            type="button"
                            aria-label={t('angebote.set.removePosition')}
                            className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-500 hover:bg-ink-750 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 disabled:opacity-40"
                            disabled={v.positionen.length <= 1}
                            onClick={() => positionEntfernen(vIdx, pIdx)}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M5 12h14" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="link-action mt-2 text-xs"
                      onClick={() => positionHinzufuegen(vIdx)}
                    >
                      + {t('angebote.set.addPosition')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-ink-700/70 pt-2 text-sm">
                    <span className="text-chrome-400">{t('angebote.set.brutto')}</span>
                    <span className="font-semibold text-chrome-50">{eur(brutto)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {varianten.length < 3 && (
          <button type="button" className="btn-ghost w-full" onClick={varianteHinzufuegen}>
            + {t('angebote.set.addVariant')}
          </button>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-700/70 pt-4">
          <button type="button" className="btn-ghost" onClick={schliessen} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={erstellen} disabled={busy}>
            {busy && <span className="spinner" />}
            {busy ? t('angebote.set.creating') : t('angebote.set.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
