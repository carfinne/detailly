'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Invoice } from '@/lib/types';
import { Modal, ErrorBox } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Dialog zum Erzeugen einer Anzahlungsrechnung (Welle 1, F3). Basis ist ENTWEDER
// ein Auftrag (orderId) ODER eine Rechnung (invoiceId); die Höhe ENTWEDER ein
// fester Brutto-Betrag ODER ein Prozentsatz vom Basis-Brutto. Backend-Fehler
// (z. B. Betrag > Basis) werden im Dialog inline durchgereicht.
export function AnzahlungDialog({
  open,
  onClose,
  orderId,
  invoiceId,
  basisBrutto,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orderId?: string;
  invoiceId?: string;
  /** Optionales Basis-Brutto für die Live-Vorschau des Prozent-Betrags. */
  basisBrutto?: number;
  onCreated: (inv: Invoice) => void;
}) {
  const t = useT();
  const [modus, setModus] = useState<'brutto' | 'prozent'>('prozent');
  const [wert, setWert] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');

  function schliessen() {
    if (busy) return;
    setFehler('');
    onClose();
  }

  const zahl = Number(wert.replace(',', '.'));
  const gueltig = Number.isFinite(zahl) && zahl > 0 && (modus !== 'prozent' || zahl <= 100);
  const vorschau =
    modus === 'prozent' && gueltig && basisBrutto != null && basisBrutto > 0
      ? (basisBrutto * zahl) / 100
      : null;

  async function erstellen() {
    if (!gueltig) {
      setFehler(t('angebote.anzahlung.invalidAmount'));
      return;
    }
    setBusy(true);
    setFehler('');
    try {
      const body: Record<string, unknown> = {};
      if (orderId) body.orderId = orderId;
      if (invoiceId) body.invoiceId = invoiceId;
      if (modus === 'brutto') body.betragBrutto = zahl;
      else body.prozent = zahl;
      const inv = await api.post<Invoice>('/invoices/anzahlung', body);
      onCreated(inv);
      setWert('');
      onClose();
    } catch (e) {
      // Konkrete Backend-Meldung durchreichen (z. B. Betrag > Basis-Brutto).
      setFehler(e instanceof Error ? e.message : t('angebote.anzahlung.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={schliessen} title={t('angebote.anzahlung.title')} size="sm">
      <div className="space-y-5">
        <p className="text-sm text-chrome-400">{t('angebote.anzahlung.intro')}</p>
        {fehler && <ErrorBox message={fehler} />}

        <div className="seg-group w-full">
          <button
            type="button"
            className={`seg flex-1 ${modus === 'prozent' ? 'seg-active' : ''}`}
            onClick={() => { setModus('prozent'); setFehler(''); }}
          >
            {t('angebote.anzahlung.modeProzent')}
          </button>
          <button
            type="button"
            className={`seg flex-1 ${modus === 'brutto' ? 'seg-active' : ''}`}
            onClick={() => { setModus('brutto'); setFehler(''); }}
          >
            {t('angebote.anzahlung.modeBrutto')}
          </button>
        </div>

        <div className="field">
          <label className="label" htmlFor="anzahlung-wert">
            {modus === 'prozent' ? t('angebote.anzahlung.prozentLabel') : t('angebote.anzahlung.betragLabel')}
          </label>
          <input
            id="anzahlung-wert"
            className="input"
            type="number"
            min={modus === 'prozent' ? 1 : 0.01}
            max={modus === 'prozent' ? 100 : undefined}
            step={modus === 'prozent' ? 1 : 0.01}
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && gueltig && !busy) erstellen(); }}
          />
          {basisBrutto != null && basisBrutto > 0 && (
            <p className="mt-1.5 text-xs text-chrome-500">
              {t('angebote.anzahlung.basisHint', { betrag: eur(basisBrutto) })}
              {vorschau != null && ` · ${t('angebote.anzahlung.previewProzent', { betrag: eur(vorschau) })}`}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={schliessen} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={erstellen} disabled={busy || !gueltig}>
            {busy && <span className="spinner" />}
            {busy ? t('angebote.anzahlung.creating') : t('angebote.anzahlung.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
