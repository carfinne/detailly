'use client';

// „Zum Inhalt springen"-Link (WCAG 2.4.1 Blöcke umgehen). Erstes fokussierbares
// Element der öffentlichen Seiten mit wiederkehrender Kopf-/Navigationsleiste:
// nur bei Tastatur-Fokus sichtbar (sr-only + focus:not-sr-only), springt per
// Anker auf das Ziel (Standard: #hauptinhalt, das dort tabIndex={-1} trägt).
// Muster + i18n-Key (ui.skipToContent) sind identisch zur App-Shell.

import { useT } from '@/lib/i18n';

export function SkipLink({ targetId = 'hauptinhalt' }: { targetId?: string }) {
  const t = useT();
  return (
    <a
      href={`#${targetId}`}
      className="btn-primary btn-sm sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]"
    >
      {t('ui.skipToContent')}
    </a>
  );
}
