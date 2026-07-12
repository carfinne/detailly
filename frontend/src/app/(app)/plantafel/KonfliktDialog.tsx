'use client';

// ---------------------------------------------------------------------------
// Konflikt-Dialog des Doppelbuchungs-Schutzes (409 APPOINTMENT_OVERLAP).
// Wird ueber Anlegen-/Bearbeiten-Modal, Drag&Drop UND Anfrage-Annahme gelegt
// (Modal-Stacking aus ui.tsx). Im Warn-Modus kann der Nutzer den Konflikt
// bestaetigen ("Trotzdem speichern" -> erneut senden mit konfliktBestaetigt);
// im Blockier-Modus gibt es bewusst nur "Abbrechen".
// ---------------------------------------------------------------------------
import type { Employee, TerminKonflikt } from '@/lib/types';
import { Modal } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fmtZeit } from './plantafel-lib';

export function KonfliktDialog({
  konflikte,
  blockiert,
  busy,
  empMap,
  onConfirm,
  onCancel,
}: {
  /** null = geschlossen. */
  konflikte: TerminKonflikt[] | null;
  /** true = konfliktverhalten 'blockieren' -> kein "Trotzdem speichern". */
  blockiert: boolean;
  busy: boolean;
  empMap: Record<string, Employee>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const open = konflikte !== null;
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={t('plantafel.konflikt.title')} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-caution" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01" />
          </svg>
          <p className="text-sm text-caution">
            {blockiert ? t('plantafel.konflikt.msgBlockiert') : t('plantafel.konflikt.msg')}
          </p>
        </div>

        <ul className="space-y-2">
          {(konflikte ?? []).map((k) => {
            const emp = k.assignedUserId ? empMap[k.assignedUserId] : undefined;
            return (
              <li key={k.id} className="flex items-center gap-3 rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2 text-sm">
                <span className="whitespace-nowrap font-medium tabular-nums text-chrome-200">
                  {fmtZeit(k.start)}–{fmtZeit(k.ende)}
                </span>
                <span className="min-w-0 flex-1 truncate text-chrome-300">
                  {k.titel || t('plantafel.ohneTitel')}
                </span>
                {emp && (
                  <span className="shrink-0 rounded-full bg-ink-750 px-2 py-0.5 text-xs text-chrome-400">
                    {emp.firstName} {emp.lastName}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          {!blockiert && (
            <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
              {busy && <span className="spinner" />}
              {t('plantafel.konflikt.trotzdem')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
