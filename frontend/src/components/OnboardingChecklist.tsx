'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Setup-Checkliste (T-008): dismissbare "Erste Schritte"-Karte ueber den
// Dashboard-Kennzahlen. Kriterien werden aus bereits geladenen Daten
// abgeleitet (KEIN eigener Endpoint) und als erledigt/offen dargestellt.
// Dismiss + vollstaendige Erledigung blenden die Karte dauerhaft aus.
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  key: string;
  label: string;
  /** Kriterium erfuellt (aus vorhandenen Daten abgeleitet). */
  done: boolean;
  /** Zielseite fuer den naechsten Schritt. */
  href: string;
  /**
   * Optionale Ein-Satz-Erklaerung ("warum lohnt sich das?") in Handwerker-Sprache.
   * Wird nur bei OFFENEN Schritten unter dem Label gezeigt – erledigte Schritte
   * bleiben schlank. Schritte ohne Hint rendern exakt wie bisher (einzeilig).
   */
  hint?: string;
}

// Dismiss pro Tenant merken. Zugriff defensiv (gesperrter Speicher in
// eingebetteten Vorschau-iFrames wirft sonst) – analog zum api.ts-Muster.
function dismissKey(tenantId?: string): string {
  return `detailly_onboarding_dismissed_${tenantId ?? 'anon'}`;
}

function readDismissed(tenantId?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(dismissKey(tenantId)) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(tenantId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(dismissKey(tenantId), '1');
  } catch {
    /* Speicher gesperrt – Karte bleibt in dieser Session ausgeblendet. */
  }
}

export function OnboardingChecklist({
  steps,
  tenantId,
}: {
  steps: OnboardingStep[];
  tenantId?: string;
}) {
  const t = useT();
  // Initialer Dismiss-Zustand aus dem Speicher (einmalig, lazy).
  const [dismissed, setDismissed] = useState(() => readDismissed(tenantId));

  const erledigt = useMemo(() => steps.filter((s) => s.done).length, [steps]);
  const alleFertig = steps.length > 0 && erledigt === steps.length;

  // Nichts anzeigen, wenn dismissed oder bereits alles eingerichtet.
  if (dismissed || alleFertig) return null;

  function schliessen() {
    writeDismissed(tenantId);
    setDismissed(true);
  }

  return (
    <section className="card-flush animate-fade-in overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b border-ink-700/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20">
            <Icon>{ICON_PATHS.plus}</Icon>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-chrome-50">{t('ui.onboarding.title')}</h2>
            <p className="mt-0.5 text-xs text-chrome-400">
              {t('ui.onboarding.progress', { done: erledigt, total: steps.length })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={schliessen}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
          aria-label={t('ui.onboarding.dismiss')}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>
      <ul className="divide-y divide-ink-700/50 px-5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 py-3">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                s.done
                  ? 'dl-check-done bg-positive text-ink-950'
                  : 'border border-ink-600 text-chrome-600'
              }`}
              aria-hidden="true"
            >
              {s.done ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-chrome-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={`block truncate text-sm ${
                  s.done ? 'text-chrome-400 line-through' : 'text-chrome-100'
                }`}
              >
                {s.label}
              </span>
              {/* "Warum lohnt sich das?" – nur bei offenen Schritten, dezent. */}
              {s.hint && !s.done && (
                <p className="mt-0.5 text-xs leading-snug text-chrome-500">{s.hint}</p>
              )}
            </div>
            {!s.done && (
              <Link href={s.href} className="link-action inline-flex shrink-0 items-center gap-1 text-sm">
                {t('ui.onboarding.go')}
                <Icon className="h-3.5 w-3.5">{ICON_PATHS.arrow}</Icon>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
