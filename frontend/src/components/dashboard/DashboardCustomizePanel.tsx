'use client';

// ---------------------------------------------------------------------------
// Anpassen-Modus des Dashboards: kompakte, dependency-freie Layout-Verwaltung.
// Statt die grossen Live-Kacheln zu verschieben, zeigt der Modus eine ruhige
// Liste aller anpassbaren Kacheln (Icon + Name + Kurzbeschreibung) mit
// Hoch/Runter- und Aus-/Einblenden-Steuerung. Voll per Tastatur bedienbar.
//
// Reihenfolge/Sichtbarkeit werden im Elternteil gehalten (localStorage je
// Nutzer); dieses Panel ist rein praesentational + Callbacks.
// ---------------------------------------------------------------------------

import { Icon, ICON_PATHS } from '@/lib/icons';
import { Empty } from '@/components/ui';
import { useT } from '@/lib/i18n';

export interface CustomizeItem {
  id: string;
  /** Icon-Pfad (aus ICON_PATHS) fuer die Kachel. */
  icon: JSX.Element;
  title: string;
  desc: string;
  hidden: boolean;
}

// Kleiner Inline-SVG-Rahmen im Stil der uebrigen Steuer-Icons (2px, runde Enden).
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CTRL_BTN =
  'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors ' +
  'hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-copper/50 disabled:pointer-events-none disabled:opacity-30';

export function DashboardCustomizePanel({
  items,
  onSwap,
  onToggleHidden,
  onReset,
  onDone,
}: {
  items: CustomizeItem[];
  onSwap: (a: string, b: string) => void;
  onToggleHidden: (id: string) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const t = useT();

  return (
    <section className="card-flush animate-fade-in overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-copper-soft text-copper ring-1 ring-copper/20">
            <Icon>{ICON_PATHS.settings}</Icon>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-chrome-50">
              {t('dashboard.anpassen.title')}
            </h2>
            <p className="mt-0.5 text-xs text-chrome-400">{t('dashboard.anpassen.subtitle')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onReset} className="btn-ghost btn-sm">
            {t('dashboard.anpassen.reset')}
          </button>
          <button type="button" onClick={onDone} className="btn-primary btn-sm">
            {t('dashboard.anpassen.done')}
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="p-5">
          <Empty text={t('dashboard.anpassen.empty')} />
        </div>
      ) : (
        <ul className="divide-y divide-ink-700/50 px-3">
          {items.map((item, i) => {
            const first = i === 0;
            const last = i === items.length - 1;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2.5">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 transition-colors ${
                    item.hidden
                      ? 'bg-ink-800 text-chrome-600 ring-ink-700'
                      : 'bg-copper-soft text-copper ring-copper/20'
                  }`}
                >
                  <Icon className="h-4 w-4">{item.icon}</Icon>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm font-medium ${
                        item.hidden ? 'text-chrome-500' : 'text-chrome-100'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.hidden && (
                      <span className="badge badge-neutral shrink-0">
                        {t('dashboard.anpassen.hidden')}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-chrome-500">{item.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className={CTRL_BTN}
                    disabled={first}
                    onClick={() => !first && onSwap(item.id, items[i - 1].id)}
                    aria-label={t('dashboard.anpassen.moveUp')}
                    title={t('dashboard.anpassen.moveUp')}
                  >
                    <Glyph>
                      <path d="m6 15 6-6 6 6" />
                    </Glyph>
                  </button>
                  <button
                    type="button"
                    className={CTRL_BTN}
                    disabled={last}
                    onClick={() => !last && onSwap(item.id, items[i + 1].id)}
                    aria-label={t('dashboard.anpassen.moveDown')}
                    title={t('dashboard.anpassen.moveDown')}
                  >
                    <Glyph>
                      <path d="m6 9 6 6 6-6" />
                    </Glyph>
                  </button>
                  <button
                    type="button"
                    className={CTRL_BTN}
                    onClick={() => onToggleHidden(item.id)}
                    aria-label={item.hidden ? t('dashboard.anpassen.show') : t('dashboard.anpassen.hide')}
                    title={item.hidden ? t('dashboard.anpassen.show') : t('dashboard.anpassen.hide')}
                  >
                    {item.hidden ? (
                      <Glyph>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </Glyph>
                    ) : (
                      <Glyph>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <path d="M1 1l22 22" />
                      </Glyph>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
