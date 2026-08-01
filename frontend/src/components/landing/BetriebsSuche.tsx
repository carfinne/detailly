'use client';

// ===========================================================================
// OEFFENTLICHE Betriebs-Suche fuer die Landing (Teil des Betriebs-Verzeichnisses).
// Fragt den gedrosselten, paginierten Endpunkt GET /public/mitglieder/suche ab und
// zeigt NUR die serverseitige, PII-arme Whitelist (Firmenname, Ort, Gewerk,
// 2-stellige PLZ-Leitregion, Logo/Monogramm) – KEINE Adresse/Mail/Telefon.
//
// Cross-Link zur Karte (dezent, kein Effekt-Feuerwerk):
//   - Klick auf ein Ergebnis  -> `onHighlightRegion(region)`: die Karte hebt den
//     Punkt hervor (Ring + sanfter Puls).
//   - `focusRegion` (Klick auf einen Kartenpunkt) -> setzt den Leitregion-Filter
//     und scrollt die Suche in den Blick.
//
// Zustaende: Lade-Skelette (nie totes „Lädt…"), sinnvoller Leerzustand (leere
// Plattform vs. keine Treffer), Fehler-Fallback. Bewegung wird global per
// reduced-motion/„Bewegung reduzieren" ruhiggestellt.
// ===========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, appPath } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { motionOk } from '@/lib/motion';
import { BETRIEBSTYP_META, BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';

/** Ein Suchtreffer (spiegelt PublicMitglied im Backend – strikte PII-arme Whitelist). */
type Treffer = {
  firmenname: string;
  /** URL-Slug der auffindbaren Betriebs-Einzelseite (/betrieb/<slug>/). */
  slug: string;
  betriebstyp: Betriebstyp;
  stadt: string | null;
  kurzbeschreibung: string | null;
  webseite: string | null;
  logoUrl: string | null;
  initiale: string;
  plzRegion: string | null;
};

/** Antwort des Such-Endpunkts (spiegelt PublicMitgliederSeite im Backend). */
type Seite = { items: Treffer[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 12;
/** Auswaehlbare Gewerke im Filter (deckt sich mit dem Backend-Betriebstyp-Enum). */
const GEWERKE: Betriebstyp[] = ['aufbereitung', 'folierung', 'ppf', 'komplett'];

type Props = {
  /** Aus einem Kartenpunkt-Klick: auf diese Leitregion filtern + hinscrollen. */
  focusRegion: string | null;
  /** Nutzer hat ein Ergebnis angeklickt -> Karte hervorheben (oder aufheben mit null). */
  onHighlightRegion: (region: string | null) => void;
};

/** Avatar eines Treffers (Logo oder Monogramm), im Branchen-Akzent eingefaerbt. */
function TrefferAvatar({ m }: { m: Treffer }) {
  const meta = BETRIEBSTYP_META[m.betriebstyp] ?? BETRIEBSTYP_META.komplett;
  if (m.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-ink-500" />;
  }
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg font-display text-sm font-bold text-white ring-1 ring-ink-500"
      style={{ background: `linear-gradient(135deg, ${meta.akzent}, ${meta.akzent}99)` }}
      aria-hidden
    >
      {m.initiale}
    </span>
  );
}

export default function BetriebsSuche({ focusRegion, onHighlightRegion }: Props) {
  const t = useT();

  // Eingaben. `q` wird entprellt (debouncedQ) -> keine Anfrage je Tastendruck.
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [gewerk, setGewerk] = useState<Betriebstyp | ''>('');
  const [plzRegion, setPlzRegion] = useState('');
  const [page, setPage] = useState(1);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [seite, setSeite] = useState<Seite>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  // Merkt, ob die Plattform ueberhaupt schon Betriebe fuehrt (fuer den Leerzustand:
  // „noch keine Betriebe" vs. „keine Treffer"). Wird beim ersten ungefilterten Load gesetzt.
  const [plattformLeer, setPlattformLeer] = useState<boolean | null>(null);
  // Lokal angeklicktes Ergebnis (rein visuell hervorgehoben; die Karte steuert der Parent).
  const [aktivesErgebnis, setAktivesErgebnis] = useState<string | null>(null);

  const wurzelRef = useRef<HTMLDivElement | null>(null);

  const hatFilter = debouncedQ.trim() !== '' || gewerk !== '' || plzRegion !== '';

  // Entprellen der Freitext-Eingabe (300 ms). Setzt zugleich die Seite zurueck.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  // Cross-Link aus der Karte: der Kartenpunkt-Klick setzt die Leitregion als Filter
  // und scrollt die Suche in den Blick. `focusRegion === null` (Punkt abgewaehlt) hebt ihn auf.
  useEffect(() => {
    setPlzRegion(focusRegion ?? '');
    setPage(1);
    if (focusRegion) {
      wurzelRef.current?.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'nearest' });
    }
  }, [focusRegion]);

  // Datenabruf: bei jeder Filter-/Seiten-Aenderung genau eine Anfrage; Rennen werden
  // per Sequenznummer verworfen (nur die juengste Antwort zaehlt).
  const laufRef = useRef(0);
  useEffect(() => {
    const lauf = ++laufRef.current;
    setStatus('loading');
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    if (gewerk) params.set('betriebstyp', gewerk);
    if (plzRegion) params.set('plzRegion', plzRegion);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));

    api
      .get<Seite>(`/public/mitglieder/suche?${params.toString()}`)
      .then((r) => {
        if (lauf !== laufRef.current) return;
        const daten: Seite = {
          items: Array.isArray(r?.items) ? r.items : [],
          total: typeof r?.total === 'number' ? r.total : 0,
          page: typeof r?.page === 'number' ? r.page : 1,
          pageSize: typeof r?.pageSize === 'number' ? r.pageSize : PAGE_SIZE,
        };
        setSeite(daten);
        // Erstbefund ohne Filter: ist die Plattform leer? (Fuer den Leerzustand-Text.)
        setPlattformLeer((prev) => (prev === null && !hatFilter ? daten.total === 0 : prev));
        setStatus('ready');
      })
      .catch(() => {
        if (lauf !== laufRef.current) return;
        setStatus('error');
      });
  }, [debouncedQ, gewerk, plzRegion, page, hatFilter]);

  const seitenAnzahl = Math.max(1, Math.ceil(seite.total / seite.pageSize));

  const ergebnisKlick = useCallback(
    (m: Treffer) => {
      // Toggle: nochmaliger Klick hebt die Hervorhebung auf.
      const naechste = aktivesErgebnis === m.firmenname ? null : m.firmenname;
      setAktivesErgebnis(naechste);
      onHighlightRegion(naechste && m.plzRegion ? m.plzRegion : null);
    },
    [aktivesErgebnis, onHighlightRegion],
  );

  const filterLeeren = useCallback(() => {
    setQ('');
    setDebouncedQ('');
    setGewerk('');
    setPlzRegion('');
    setPage(1);
  }, []);

  // Die Sektion blendet sich komplett aus, wenn die Plattform (ungefiltert) leer ist –
  // dann traegt die Karte den Leerzustand. Sonst ist die Suche immer bedienbar.
  const komplettAus = plattformLeer === true && !hatFilter;

  const skelette = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  if (komplettAus) return null;

  return (
    <div ref={wurzelRef} className="mx-auto mt-14 w-full max-w-3xl scroll-mt-24">
      <div className="mb-6 text-center">
        <h3 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{t('landing.suche.title')}</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-chrome-400">{t('landing.suche.sub')}</p>
      </div>

      {/* Filterleiste: Freitext + Gewerk + Leitregion. */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
          </span>
          <input
            type="search"
            className="input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
            placeholder={t('landing.suche.placeholder')}
            aria-label={t('landing.suche.placeholder')}
          />
        </div>
        <select
          className="input sm:w-44"
          value={gewerk}
          onChange={(e) => {
            setGewerk(e.target.value as Betriebstyp | '');
            setPage(1);
          }}
          aria-label={t('landing.suche.gewerkLabel')}
        >
          <option value="">{t('landing.suche.gewerkAlle')}</option>
          {GEWERKE.map((g) => (
            <option key={g} value={g}>
              {t(BETRIEBSTYP_LABEL_KEY[g].label)}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          className="input sm:w-28"
          value={plzRegion}
          onChange={(e) => {
            // Nur 2-stellige Leitregion zulassen (datensparsam, matcht das Backend).
            setPlzRegion(e.target.value.replace(/\D/g, '').slice(0, 2));
            setPage(1);
          }}
          maxLength={2}
          placeholder={t('landing.suche.plzPlaceholder')}
          aria-label={t('landing.suche.plzLabel')}
        />
      </div>

      {/* Aktive Filter als entfernbarer Hinweis. */}
      {hatFilter && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-chrome-500" aria-live="polite">
            {status === 'ready' &&
              (seite.total === 1
                ? t('landing.suche.trefferEiner')
                : t('landing.suche.treffer', { anzahl: seite.total }))}
          </p>
          <button
            type="button"
            onClick={filterLeeren}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-copper-300 transition-colors hover:bg-ink-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            {t('landing.suche.filterLeeren')}
          </button>
        </div>
      )}

      {/* Ergebnisbereich. */}
      <div className="mt-5">
        {status === 'loading' && (
          <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
            {skelette.map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-ink-700/70" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 rounded bg-ink-700/70" />
                    <div className="h-2.5 w-1/3 rounded bg-ink-700/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-center text-sm text-chrome-200">
            {t('landing.suche.fehler')}
          </div>
        )}

        {status === 'ready' && seite.items.length === 0 && (
          <div className="rounded-2xl border border-ink-700/70 bg-ink-800/50 p-8 text-center">
            <p className="text-sm font-medium text-chrome-200">
              {hatFilter ? t('landing.suche.leerFilter') : t('landing.suche.leerPlattform')}
            </p>
            {hatFilter && (
              <button
                type="button"
                onClick={filterLeeren}
                className="mt-3 inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-copper-300 transition-colors hover:bg-ink-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
              >
                {t('landing.suche.filterLeeren')}
              </button>
            )}
          </div>
        )}

        {status === 'ready' && seite.items.length > 0 && (
          <ul className="grid animate-fade-in gap-3 sm:grid-cols-2">
            {seite.items.map((m, i) => {
              const meta = BETRIEBSTYP_META[m.betriebstyp] ?? BETRIEBSTYP_META.komplett;
              const label = t(BETRIEBSTYP_LABEL_KEY[m.betriebstyp]?.label ?? BETRIEBSTYP_LABEL_KEY.komplett.label);
              const aktiv = aktivesErgebnis === m.firmenname;
              return (
                <li key={`${m.slug}-${i}`}>
                  {/* Progressiv: die Karte ist jetzt ein echter, crawlbarer Link auf die
                      serverseitig gerenderte Betriebs-Einzelseite (/betrieb/<slug>/). Die
                      Karten-Hervorhebung bleibt als separater Button erhalten (valides
                      HTML: <a> und <button> sind Geschwister, nicht verschachtelt). */}
                  <div
                    className={`card transition-colors ${
                      aktiv ? 'border-copper/60 ring-1 ring-copper/40' : 'hover:border-ink-600'
                    }`}
                  >
                    <a
                      href={appPath(`/betrieb/${m.slug}/`)}
                      aria-label={`${t('landing.suche.zurBetriebsseite')}: ${m.firmenname}`}
                      className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
                    >
                      <div className="flex items-center gap-3">
                        <TrefferAvatar m={m} />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-display text-sm font-semibold text-chrome-50">{m.firmenname}</h4>
                          <p className="truncate text-xs text-chrome-500">
                            {m.stadt || (m.plzRegion ? t('landing.suche.region', { region: m.plzRegion }) : '')}
                          </p>
                        </div>
                        {m.plzRegion && (
                          <span className="shrink-0 rounded-full bg-ink-700/60 px-2 py-0.5 text-[10px] font-bold tabular-nums text-copper-300 ring-1 ring-copper/30">
                            {m.plzRegion}
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1"
                          style={{ color: meta.akzent, background: `${meta.akzent}1a`, borderColor: `${meta.akzent}40` }}
                        >
                          {label}
                        </span>
                      </div>
                      {m.kurzbeschreibung && (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-chrome-400">{m.kurzbeschreibung}</p>
                      )}
                      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-copper-300">
                        {t('landing.suche.zurBetriebsseite')}
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </a>
                    {m.plzRegion && (
                      <button
                        type="button"
                        onClick={() => ergebnisKlick(m)}
                        aria-pressed={aktiv}
                        className="mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-chrome-500 transition-colors hover:bg-ink-700/50 hover:text-chrome-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
                      >
                        {aktiv ? t('landing.suche.aufKarteAktiv') : t('landing.suche.aufKarte')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pagination (nur wenn es mehr als eine Seite gibt). */}
        {status === 'ready' && seitenAnzahl > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3" aria-label={t('landing.suche.paginationLabel')}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={seite.page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-chrome-200 transition-colors hover:border-ink-600 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
            >
              {t('landing.suche.zurueck')}
            </button>
            <span className="text-xs text-chrome-500 tabular-nums">
              {t('landing.suche.seite', { seite: seite.page, gesamt: seitenAnzahl })}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(seitenAnzahl, p + 1))}
              disabled={seite.page >= seitenAnzahl}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-chrome-200 transition-colors hover:border-ink-600 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
            >
              {t('landing.suche.weiter')}
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
