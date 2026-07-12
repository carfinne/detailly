'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, routeIcon } from '@/lib/icons';
import { useT } from '@/lib/i18n';

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Optionales Icon; ohne Angabe wird das Modul-Icon aus der Route abgeleitet. */
  icon?: React.ReactNode;
}) {
  const pathname = usePathname();
  const resolved = icon ?? routeIcon(pathname);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {resolved && (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-copper-soft text-copper ring-1 ring-copper/20">
            <Icon className="h-5 w-5">{resolved}</Icon>
          </span>
        )}
        <div className="min-w-0">
          <h1 className="display-xl text-chrome-50">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-chrome-400">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading() {
  const t = useT();
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label={t('common.loading')}>
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-full opacity-80" />
      <div className="skeleton h-10 w-2/3 opacity-60" />
    </div>
  );
}

/**
 * Edler Ganz-Karten-Ladezustand fuer oeffentliche Seiten (buchen/track/status/
 * rechnung/haendler): ruhig rotierender Kupfer-Spinner + Label, sanft
 * eingeblendet. Fuer Inline-/Listen-Platzhalter stattdessen <Loading/> (Skeleton).
 */
export function LoadingCard({ label, className }: { label?: string; className?: string }) {
  const t = useT();
  return (
    <div
      className={`card flex flex-col items-center justify-center gap-3 py-12 text-center animate-fade-in ${className ?? ''}`}
      role="status"
      aria-busy="true"
    >
      <span className="spinner h-6 w-6 text-copper" aria-hidden="true" />
      <span className="text-sm text-chrome-400">{label ?? t('common.loadingEllipsis')}</span>
    </div>
  );
}

export function ErrorBox({ message, className }: { message: string; className?: string }) {
  return (
    <div className={`dl-error-in flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className="dl-error-pulse mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4m0 4h.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/**
 * Tarif-Sperre als AUSWEG, nicht als Sackgasse: zeigt den Backend-Hinweis
 * (403 `PLAN_FEATURE_MISSING`) plus einen Weg zur Abo-Seite. Zentral, damit alle
 * gegateten Seiten (Zeiterfassung, 3D-Inspektion, Auswertungen, Mahnwesen,
 * Buchhaltungs-Export …) denselben Upgrade-Hinweis wie das Audit-Log zeigen.
 */
export function UpgradeHinweis({ message, className }: { message: string; className?: string }) {
  const t = useT();
  return (
    <div className={className}>
      <ErrorBox message={message} />
      <Link href="/abo" className="btn-primary mt-3 inline-flex">
        {t('common.toSubscription')}
      </Link>
    </div>
  );
}

// --- Pflichtfeld-Standard (T-011) -----------------------------------------
// Konvention: Pflichtfelder tragen den Kupfer-Stern am Label, alles andere
// gilt als optional (kein "(optional)"-Rauschen an jedem Feld). Feldbezogene
// Fehler erscheinen als Inline-Text UNTER dem Feld (FieldError); der
// Formular-weite modalError/ErrorBox bleibt für Server-Fehler.

/** Pflichtfeld-Stern für Labels (dekorativ; Pflicht kommt aus required/Validierung). */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-copper" aria-hidden="true">
      *
    </span>
  );
}

/** Feldbezogener Inline-Fehler unter dem Eingabefeld. */
export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-danger">
      {message}
    </p>
  );
}

/**
 * Formularfeld mit Label, Pflicht-Stern und Inline-Fehler.
 * aria-invalid/aria-describedby aufs Eingabeelement setzen, wenn `error`
 * geführt wird (id für aria-describedby via eigener useId auf der Seite).
 */
export function Field({
  label,
  htmlFor,
  required,
  error,
  errorId,
  help,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  errorId?: string;
  help?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      {help && !error && <p className="help">{help}</p>}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-600">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7L9.5 4.5A2 2 0 0 0 8 4H5a2 2 0 0 0-2 2Z" />
        </svg>
      </div>
      <p className="text-sm text-chrome-400">{text}</p>
      {action}
    </div>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className ?? 'badge-neutral'}>{children}</span>;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-flush animate-fade-in ${className ?? ''}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-5 py-4">
          <div>
            {title && <h2 className="font-display text-base font-semibold text-chrome-50">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-chrome-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// Stack der aktuell offenen Modals: Tastatur-Handler (Escape/Tab) reagieren
// nur im obersten Dialog (Fall: ConfirmDialog ueber einem Formular-Modal).
const modalStack: symbol[] = [];
// Scroll-Lock ref-counted am Stack: nur das ERSTE Modal sperrt, erst das
// LETZTE gibt frei. Pro-Instanz-Restore wuerde haengen bleiben, wenn zwei
// Geschwister-Modals im selben React-Batch schliessen (Cleanup in Tree-Order).
let savedBodyOverflow: string | null = null;

/**
 * Zentrierter Dialog mit Fokus-Falle, Escape und Backdrop-Klick.
 *
 * Fehler-Konvention: Fehler im Modal als `modalError`-State halten und als
 * `<ErrorBox>` direkt ueber der Aktionszeile rendern (Vorbild: anfragen/page.tsx).
 * Bewusst KEIN error-Prop am Modal selbst.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const t = useT();
  // onClose in einer Ref halten: der Effect laeuft nur auf [open] und re-runnt
  // nicht bei jeder neuen Inline-Funktion (sonst Token-Re-Push im Stack +
  // Fokus-Klau bei jedem Parent-Render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('modal');
    modalStack.push(token);
    const prevActive = document.activeElement as HTMLElement | null;
    if (modalStack.length === 1) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const focusables = (): HTMLElement[] => {
      const el = panelRef.current;
      if (!el) return [];
      return Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => n.offsetParent !== null);
    };

    // Initialer Fokus in den Dialog.
    (focusables()[0] ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Nur der oberste Dialog im Stack verarbeitet Tastatur-Ereignisse.
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
      if (modalStack.length === 0) {
        document.body.style.overflow = savedBodyOverflow ?? '';
        savedBodyOverflow = null;
      }
      // Fokus an den ausloesenden Trigger zurueckgeben.
      prevActive?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const maxW =
    size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-3xl' : size === 'sm' ? 'max-w-md' : 'max-w-2xl';
  return (
    <div
      className="dl-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`dl-modal-in max-h-[90vh] w-full ${maxW} overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 shadow-pop focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-ink-700/70 bg-ink-850/95 px-6 py-4 backdrop-blur">
          <h2 id={titleId} className="font-display text-lg font-semibold text-chrome-50">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Kompakter Bestaetigungs-Dialog (z. B. vor dem Loeschen), gebaut auf Modal. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'neutral';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    // Waehrend busy nicht per Escape/Backdrop schliessbar – die destruktive
    // Aktion laeuft bereits, das Feedback soll sichtbar bleiben.
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title} size="sm">
      <div className="space-y-5">
        <div className="text-sm text-chrome-300">{message}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="spinner" />}
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Toast-System: kurze Erfolgs-/Hinweismeldungen unten in der Bildschirmmitte.
// ---------------------------------------------------------------------------

type ToastVariant = 'positive' | 'copper';
type ToastFn = (text: string, opts?: { variant?: ToastVariant; duration?: number }) => void;
type ToastItem = { id: number; text: string; variant: ToastVariant; leaving: boolean };

const ToastContext = createContext<ToastFn | null>(null);

/** Loest einen Toast aus; nur innerhalb von <ToastProvider> verwendbar. */
export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast muss innerhalb von <ToastProvider> verwendet werden (siehe (app)/layout.tsx).');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    // Erst ausblenden (Transition), dann aus der Liste entfernen.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 200);
  }, []);

  const show = useCallback<ToastFn>(
    (text, opts) => {
      const id = ++nextId.current;
      // Maximal 3 gleichzeitig sichtbar: aeltere fallen vorne raus.
      setToasts((list) => [...list.slice(-2), { id, text, variant: opts?.variant ?? 'positive', leaving: false }]);
      setTimeout(() => dismiss(id), opts?.duration ?? 3000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-ink-850 px-4 py-2.5 text-sm font-medium shadow-pop transition-all duration-200 ease-emphasized ${
              t.leaving ? 'translate-y-2 opacity-0' : 'animate-fade-in'
            } ${t.variant === 'copper' ? 'border-copper/30 text-copper' : 'border-positive/30 text-positive'}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Kennzahlen-Karte: einheitlicher Ersatz fuer die seitenlokalen Kpi-Varianten.
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  icon,
  delta,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Hebt den Wert in Copper hervor (z. B. Umsatz). */
  accent?: boolean;
  /** Icon-Pfad(e) aus ICONS; wird im Copper-Chip gerendert. */
  icon?: React.ReactNode;
  /** Veraenderung in Prozent; positiv/negativ eingefaerbt. */
  delta?: number | null;
  /** Mit href wird die Karte ein Link mit Hover-Lift. */
  href?: string;
}) {
  const hatFuss = (delta !== undefined && delta !== null) || !!hint;
  const cls = href
    ? 'card group block transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-600'
    : 'card block';
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-chrome-500">{label}</span>
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20 transition-transform duration-150 group-hover:scale-105">
            <Icon>{icon}</Icon>
          </span>
        )}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${accent ? 'text-copper' : 'text-chrome-50'}`}>
        {value}
      </div>
      {hatFuss && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {delta !== undefined && delta !== null && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                delta >= 0 ? 'text-positive' : 'text-danger'
              }`}
            >
              <Icon className="h-3 w-3">
                {delta >= 0 ? <path d="m5 15 7-7 7 7" /> : <path d="m5 9 7 7 7-7" />}
              </Icon>
              {Math.abs(delta)} %
            </span>
          )}
          {hint && <span className="text-chrome-400">{hint}</span>}
        </div>
      )}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

/** Label-Wert-Zeile fuer Detail-Ansichten (Stil aus einstellungen/page.tsx). */
export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-700/50 py-2.5 last:border-0">
      <span className="text-sm text-chrome-500">{label}</span>
      <span className="text-sm font-medium text-chrome-100">{value}</span>
    </div>
  );
}
