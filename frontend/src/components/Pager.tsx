'use client';

// Kompakter Seiten-Blaetterer fuer paginierte Listen. Zeigt sich erst ab der
// zweiten Seite. Fenster-Logik: 1 … (page-1) page (page+1) … letzte.

import { useT } from '@/lib/i18n';

export function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  // Sichtbare Seitenzahlen: erste, letzte, aktuelle ±1 – dazwischen Ellipsen.
  const sichtbar = Array.from(new Set([1, page - 1, page, page + 1, pages]))
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);

  const btn =
    'grid h-8 min-w-[32px] place-items-center rounded-lg border px-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-chrome-500">
        {t('ui.pager.page', { current: page, total: pages })} · {total.toLocaleString('de-DE')} {t('ui.pager.entries')}
      </span>
      <nav className="flex items-center gap-1" aria-label={t('ui.pager.nav')}>
        <button
          className={`${btn} border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50`}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('ui.pager.prev')}
        >
          ‹
        </button>
        {sichtbar.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - sichtbar[i - 1] > 1 && <span className="px-1 text-xs text-chrome-600">…</span>}
            <button
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${
                p === page
                  ? 'border-copper/60 bg-copper-soft font-semibold text-copper'
                  : 'border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50'
              }`}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          className={`${btn} border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50`}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('ui.pager.next')}
        >
          ›
        </button>
      </nav>
    </div>
  );
}
