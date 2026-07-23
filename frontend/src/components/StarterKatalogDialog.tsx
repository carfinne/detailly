'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type {
  StarterGewerk,
  StarterKatalog,
  StarterKatalogGruppe,
  StarterImportResult,
} from '@/lib/types';
import { Modal, ErrorBox } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { useT } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Starter-Katalog-Dialog (Pilot-Onboarding): Gewerke waehlen und typische
// Leistungen per Klick uebernehmen. Katalog + Anlegen laufen serverseitig
// (Single Source of Truth); hier nur Auswahl + Vorschau + Aufruf.
// ---------------------------------------------------------------------------

const GEWERK_LABEL: Record<StarterGewerk, string> = {
  aufbereitung: 'starter.gewerk.aufbereitung',
  folierung: 'starter.gewerk.folierung',
  ppf: 'starter.gewerk.ppf',
};

const EINHEIT_KEY: Record<string, string> = {
  pauschal: 'leistungen.einheit.pauschal',
  qm: 'leistungen.einheit.qm',
  stunde: 'leistungen.einheit.stunde',
};

// Wie viele Leistungen pro Gewerk in der Vorschau gelistet werden (Rest gebündelt).
const VORSCHAU_MAX = 4;

export function StarterKatalogDialog({
  open,
  onClose,
  onDone,
  defaultGewerke = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Ruft der Dialog nach erfolgreichem Import auf (Parent lädt Liste neu + Toast). */
  onDone: (result: StarterImportResult) => void;
  /** Vorauswahl aus dem Betriebstyp (leer => alle Gewerke vorausgewählt). */
  defaultGewerke?: StarterGewerk[];
}) {
  const t = useT();
  const [gruppen, setGruppen] = useState<StarterKatalogGruppe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Set<StarterGewerk>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Katalog laden, sobald der Dialog öffnet; Auswahl aus dem Betriebstyp vorbelegen.
  useEffect(() => {
    if (!open) return;
    let aktiv = true;
    setLoading(true);
    setLoadError('');
    setImportError('');
    api
      .get<StarterKatalog>('/services/starter/catalog')
      .then((res) => {
        if (!aktiv) return;
        setGruppen(res.gewerke);
        const gueltig = new Set(res.gewerke.map((g) => g.gewerk));
        const vor = defaultGewerke.filter((g) => gueltig.has(g));
        // Vorauswahl: Betriebstyp-Gewerke; sonst alle (bleibt „ein Klick").
        setSelected(new Set(vor.length ? vor : res.gewerke.map((g) => g.gewerk)));
      })
      .catch((e) => {
        if (aktiv) setLoadError(e instanceof Error ? e.message : t('starter.error.load'));
      })
      .finally(() => {
        if (aktiv) setLoading(false);
      });
    return () => {
      aktiv = false;
    };
    // Nur beim Öffnen laden; defaultGewerke wird beim Öffnen ausgewertet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(gewerk: StarterGewerk) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gewerk)) next.delete(gewerk);
      else next.add(gewerk);
      return next;
    });
  }

  const gesamt = useMemo(
    () =>
      (gruppen ?? [])
        .filter((g) => selected.has(g.gewerk))
        .reduce((sum, g) => sum + g.anzahl, 0),
    [gruppen, selected],
  );

  async function importieren() {
    if (selected.size === 0) {
      setImportError(t('starter.error.none'));
      return;
    }
    setImporting(true);
    setImportError('');
    try {
      const result = await api.post<StarterImportResult>('/services/starter/import', {
        gewerke: Array.from(selected),
      });
      onDone(result);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : t('starter.error.import'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('starter.title')} size="lg">
      <p className="text-sm text-chrome-300">{t('starter.intro')}</p>

      {loading ? (
        // Animierter Ladezustand (nie totes „Lädt…").
        <div className="mt-5 space-y-3" aria-busy="true" aria-label={t('starter.loading')}>
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-20 w-full opacity-80" />
          <div className="skeleton h-32 w-full opacity-60" />
        </div>
      ) : loadError ? (
        <div className="mt-5">
          <ErrorBox message={loadError} />
        </div>
      ) : (
        <div className="mt-5 space-y-5 animate-fade-in">
          {/* Gewerk-Auswahl als Toggle-Karten */}
          <div className="grid gap-3 sm:grid-cols-3">
            {(gruppen ?? []).map((g) => {
              const on = selected.has(g.gewerk);
              return (
                <button
                  key={g.gewerk}
                  type="button"
                  onClick={() => toggle(g.gewerk)}
                  aria-pressed={on}
                  className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 ${
                    on
                      ? 'border-copper/60 bg-copper-soft ring-1 ring-copper/20'
                      : 'border-ink-700 bg-ink-850 hover:border-ink-600'
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                      on ? 'border-copper bg-copper text-ink-950' : 'border-ink-600 text-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${on ? 'text-chrome-50' : 'text-chrome-100'}`}>
                      {t(GEWERK_LABEL[g.gewerk])}
                    </span>
                    <span className="block text-xs text-chrome-400">
                      {t('starter.gewerk.count', { count: g.anzahl })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Vorschau der ausgewählten Leistungen */}
          {selected.size === 0 ? (
            <p className="text-sm text-chrome-400">{t('starter.selectHint')}</p>
          ) : (
            <div className="rounded-xl border border-ink-700 bg-ink-900/40">
              <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-chrome-400">
                  {t('starter.preview.title')}
                </span>
                <span className="text-xs text-chrome-400">
                  {t('starter.selectedCount', { count: gesamt })}
                </span>
              </div>
              <div className="max-h-64 space-y-4 overflow-y-auto p-4">
                {(gruppen ?? [])
                  .filter((g) => selected.has(g.gewerk))
                  .map((g) => (
                    <div key={g.gewerk}>
                      <div className="mb-1.5 text-xs font-semibold text-copper">
                        {t(GEWERK_LABEL[g.gewerk])}
                      </div>
                      <ul className="space-y-1">
                        {g.leistungen.slice(0, VORSCHAU_MAX).map((l) => (
                          <li key={l.name} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-chrome-100">
                              {l.name}
                              <span className="ml-1.5 text-xs text-chrome-500">
                                · {t(EINHEIT_KEY[l.einheit] ?? l.einheit)}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-chrome-300">{eur(l.basispreis)}</span>
                          </li>
                        ))}
                      </ul>
                      {g.anzahl > VORSCHAU_MAX && (
                        <p className="mt-1 text-xs text-chrome-500">
                          {t('starter.preview.more', { count: g.anzahl - VORSCHAU_MAX })}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <p className="flex items-center gap-2 text-xs text-chrome-400">
            <Icon className="h-4 w-4 shrink-0 text-positive">
              <path d="M20 6 9 17l-5-5" />
            </Icon>
            {t('starter.hintEditable')}
          </p>

          {importError && <ErrorBox message={importError} />}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={importing}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={importieren}
              disabled={importing || selected.size === 0}
            >
              {importing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-transparent" aria-hidden="true" />
                  {t('starter.importing')}
                </span>
              ) : (
                t('starter.import')
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
