'use client';

// ===========================================================================
// LIVE- und INTERAKTIVE Betriebskarte fuer die Landing („Bundesweit"). Zeigt ECHTE
// Daten aus dem oeffentlichen Endpunkt GET /public/betriebskarte:
//   - benannte, ANKLICK-/HOVERBARE Punkte NUR fuer aktiv ZAHLENDE Betriebe mit
//     Opt-in (Server-Whitelist: firmenname, grobe Stadt, 2-stellige PLZ-Leitregion,
//     grobe Zentroid-Koordinate),
//   - einen Zaehler „X Betriebe bundesweit" aus `gesamtZahlend` (anonyme Gesamtzahl).
//
// DATENSPARSAM: es werden AUSSCHLIESSLICH die drei oeffentlichen Felder
// firmenname/stadt/plzRegion angezeigt – KEIN zusaetzliches PII, KEIN Nachladen
// (genau EIN Fetch beim Mount). Self-contained SVG-Silhouette (KEINE Karten-
// Library, keine externen Tiles/Requests). Punkt-Koordinaten kommen fertig vom
// Server (Regions-Zentroid im viewBox 600x800) – das Frontend fuehrt KEINE
// PLZ-Tabelle.
//
// Interaktion: Hover ODER Tap/Klick ODER Tastatur (fokussierbar, Enter/Space)
// oeffnet ein dezentes Popover mit Firmenname + Stadt/Region; der aktive Punkt
// bekommt einen Kupfer-Ring + sanften Puls. Beim Scroll-in-View erscheinen die
// Punkte ruhig gestaffelt (Fade/Scale, ~40 ms Versatz). prefers-reduced-motion /
// „Bewegung reduzieren": alles still, Punkte sofort sichtbar. Ladezustand +
// leerer „bald hier"-Fallback (nie totes Leer). Die Karte ist bewusst SEKUNDAER
// (Signature bleibt µm/3D).
// ===========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { motionOk } from '@/lib/motion';

/** Ein Punkt der oeffentlichen Betriebskarte (spiegelt BetriebskartePunkt im Backend). */
type BetriebskartePunkt = {
  firmenname: string;
  stadt: string | null;
  plzRegion: string;
  x: number;
  y: number;
};

/** Antwort des oeffentlichen Endpunkts (spiegelt BetriebskarteResponse im Backend). */
type BetriebskarteResponse = {
  betriebe: BetriebskartePunkt[];
  gesamtZahlend: number;
};

const VB_W = 600;
const VB_H = 800;

/**
 * Stuetzpunkte der stilisierten Deutschland-Silhouette (im Uhrzeigersinn, viewBox
 * 0 0 600 800) – identischer Umriss wie die uebrige Landing-Karte, hier bewusst
 * self-contained gehalten (statische Geometrie, aendert sich nie). Wird per
 * smoothClosedPath zu weichen Ecken verrundet.
 */
const SILHOUETTE: readonly (readonly [number, number])[] = [
  [150, 205], [180, 150], [205, 105], [225, 62], [262, 58], [300, 96], [340, 128],
  [404, 118], [472, 136], [494, 210], [522, 286], [534, 402], [472, 472], [452, 560],
  [454, 644], [434, 716], [352, 722], [278, 730], [218, 714], [150, 690], [112, 606],
  [84, 558], [66, 502], [50, 440], [74, 386], [95, 328], [106, 273], [126, 230],
];

/** Verrundet ein geschlossenes Polygon zu einer weichen Kurve (Ecken als Q-Kontrollpunkte). */
function smoothClosedPath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  const mid = (a: readonly [number, number], b: readonly [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const start = mid(pts[n - 1], pts[0]);
  let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const c = pts[i];
    const m = mid(c, pts[(i + 1) % n]);
    d += ` Q ${c[0].toFixed(1)} ${c[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

const GERMANY_PATH = smoothClosedPath(SILHOUETTE);

type Gruppe = { region: string; x: number; y: number; namen: { firmenname: string; stadt: string | null }[] };

/** Popover-Platzierung: klappt je nach Lage nach oben/unten und an den Rand-Kanten. */
function popoverStyle(x: number, y: number): React.CSSProperties {
  const leftPct = (x / VB_W) * 100;
  const topPct = (y / VB_H) * 100;
  const below = y < VB_H * 0.46;
  const tx = leftPct < 26 ? '-14%' : leftPct > 74 ? '-86%' : '-50%';
  const ty = below ? '16px' : 'calc(-100% - 16px)';
  return { left: `${leftPct}%`, top: `${topPct}%`, transform: `translate(${tx}, ${ty})` };
}

/**
 * Optionale Steuerung von aussen fuer den Verbund mit der Betriebs-Suche
 * (BetriebsVerzeichnis). Ohne diese Props verhaelt sich die Karte exakt wie zuvor
 * (eigenstaendige Social-Proof-Karte) – voll rueckwaertskompatibel.
 */
type BetriebskarteLiveProps = {
  /**
   * Extern hervorgehobene Leitregion (Cross-Link: Klick auf ein Suchergebnis).
   * Der zugehoerige Punkt bekommt Ring + sanften Puls – DEZENT, ohne das Popover
   * zu erzwingen (das bleibt Hover/Klick vorbehalten).
   */
  highlightRegion?: string | null;
  /** Klick auf einen Kartenpunkt (Cross-Link zur Suche: dort filtern + scrollen). */
  onRegionClick?: (region: string) => void;
};

export default function BetriebskarteLive({
  highlightRegion = null,
  onRegionClick,
}: BetriebskarteLiveProps = {}) {
  const t = useT();
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [data, setData] = useState<BetriebskarteResponse>({ betriebe: [], gesamtZahlend: 0 });
  // Angeheftet per Klick/Tap/Enter (bleibt offen) vs. transient per Hover/Fokus.
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Scroll-in-View-Enthuellung + Motion-Schalter (nur clientseitig entscheidbar).
  const [revealed, setRevealed] = useState(false);
  const [animate, setAnimate] = useState(false);

  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const popRef = useRef<HTMLDivElement | null>(null);
  const buehneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let aktiv = true;
    api
      .get<BetriebskarteResponse>('/public/betriebskarte')
      .then((r) => {
        if (!aktiv) return;
        setData({
          betriebe: Array.isArray(r?.betriebe) ? r.betriebe : [],
          gesamtZahlend: typeof r?.gesamtZahlend === 'number' ? r.gesamtZahlend : 0,
        });
        setStatus('ready');
      })
      .catch(() => {
        // Kein Blocker fuer die Landingpage: bei Fehler leerer Fallback.
        if (aktiv) setStatus('ready');
      });
    return () => {
      aktiv = false;
    };
  }, []);

  // Motion-Entscheidung EINMAL clientseitig: bei reduzierter Bewegung sind die
  // Punkte sofort sichtbar (revealed=true, keine Animation).
  useEffect(() => {
    const ok = motionOk();
    setAnimate(ok);
    if (!ok) setRevealed(true);
  }, []);

  // Gestaffelte Enthuellung: sobald die Karten-Buehne in den Viewport kommt.
  // Nur relevant, wenn Bewegung erlaubt ist (sonst schon revealed=true).
  useEffect(() => {
    if (!animate || revealed) return;
    const el = buehneRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate, revealed]);

  // Nach Leitregion gruppieren (mehrere Betriebe je Region teilen sich einen Punkt).
  const gruppen = useMemo<Gruppe[]>(() => {
    const map = new Map<string, Gruppe>();
    for (const b of data.betriebe) {
      const g = map.get(b.plzRegion);
      if (g) g.namen.push({ firmenname: b.firmenname, stadt: b.stadt });
      else map.set(b.plzRegion, { region: b.plzRegion, x: b.x, y: b.y, namen: [{ firmenname: b.firmenname, stadt: b.stadt }] });
    }
    return Array.from(map.values()).sort((a, b) => a.y - b.y || a.x - b.x);
  }, [data.betriebe]);

  // Angezeigtes Popover: Angeheftetes hat Vorrang vor Hover/Fokus.
  const aktivRegion = pinned ?? hovered;
  const aktiveGruppe = aktivRegion ? gruppen.find((g) => g.region === aktivRegion) : undefined;

  const schliessen = useCallback((fokusRegion?: string) => {
    setPinned(null);
    setHovered(null);
    if (fokusRegion) btnRefs.current[fokusRegion]?.focus();
  }, []);

  // Esc schliesst (Fokus zurueck an den Punkt); Klick/Tap ausserhalb schliesst.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        schliessen(pinned);
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (btnRefs.current[pinned]?.contains(target)) return;
      schliessen();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [pinned, schliessen]);

  const zaehler = data.gesamtZahlend;

  return (
    <div>
      <div className="mb-10 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">
          {t('landing.betriebskarte.kicker')}
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t('landing.betriebskarte.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">
          {t('landing.betriebskarte.sub')}
        </p>
      </div>

      {/* Zaehler „X Betriebe bundesweit" (anonym, aus gesamtZahlend). */}
      {status === 'ready' && zaehler > 0 && (
        <p className="mb-8 text-center">
          <span className="font-display text-3xl font-bold text-copper-300 sm:text-4xl tabular-nums">{zaehler}</span>
          <span className="ml-2 text-sm text-chrome-400">
            {t(zaehler === 1 ? 'landing.betriebskarte.zaehlerEiner' : 'landing.betriebskarte.zaehler')}
          </span>
        </p>
      )}

      <div className="relative mx-auto w-full max-w-[520px]">
        <div className="relative" ref={buehneRef}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="dl-betriebskarte-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--ink-750))" stopOpacity="0.85" />
                <stop offset="100%" stopColor="rgb(var(--ink-850))" stopOpacity="0.7" />
              </linearGradient>
              <radialGradient id="dl-betriebskarte-glow" cx="52%" cy="42%" r="60%">
                <stop offset="0%" stopColor="var(--copper-glow)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            <path d={GERMANY_PATH} fill="url(#dl-betriebskarte-glow)" opacity="0.5" />
            <path
              d={GERMANY_PATH}
              fill="url(#dl-betriebskarte-fill)"
              stroke="rgb(var(--copper-500))"
              strokeOpacity="0.45"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>

          {/* Ladezustand: dezent pulsierende Platzhalter-Punkte (nie totes „Lädt…"). */}
          {status === 'loading' && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {[
                { x: 449, y: 279 },
                { x: 273, y: 187 },
                { x: 203, y: 497 },
                { x: 354, y: 673 },
                { x: 114, y: 421 },
              ].map((p, i) => (
                <span
                  key={i}
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-ink-600/70"
                  style={{ left: `${(p.x / VB_W) * 100}%`, top: `${(p.y / VB_H) * 100}%` }}
                />
              ))}
            </div>
          )}

          {/* Interaktive, benannte Punkte – nur zahlende Opt-in-Betriebe. */}
          {status === 'ready' &&
            gruppen.map((g, i) => {
              const anzahl = g.namen.length;
              const istAktiv = aktivRegion === g.region;
              // Cross-Link aus der Suche: Punkt hervorheben (Ring + Puls), ohne das
              // Popover zu erzwingen. Wirkt zusaetzlich zum internen Hover/Klick.
              const istHervorgehoben = highlightRegion === g.region;
              const betont = istAktiv || istHervorgehoben;
              const label =
                anzahl === 1
                  ? t('landing.betriebskarte.pinAria.one', { name: g.namen[0].firmenname, region: g.region })
                  : t('landing.betriebskarte.pinAria', { anzahl, region: g.region });
              // Gestaffelte Enthuellung (nur bei erlaubter Bewegung); sonst sofort sichtbar.
              const sichtbar = revealed || !animate;
              const punktStyle: React.CSSProperties = {
                left: `${(g.x / VB_W) * 100}%`,
                top: `${(g.y / VB_H) * 100}%`,
                opacity: sichtbar ? 1 : 0,
                transform: `translate(-50%, -50%) scale(${sichtbar ? 1 : 0.6})`,
                transition: animate ? 'opacity 480ms ease, transform 480ms cubic-bezier(0.22,1,0.36,1)' : undefined,
                transitionDelay: animate && sichtbar ? `${i * 40}ms` : undefined,
              };
              return (
                <button
                  key={g.region}
                  type="button"
                  ref={(el) => {
                    btnRefs.current[g.region] = el;
                  }}
                  onClick={() => {
                    setPinned((r) => (r === g.region ? null : g.region));
                    // Cross-Link: die Suche auf diese Region filtern + hinscrollen.
                    onRegionClick?.(g.region);
                  }}
                  onMouseEnter={() => setHovered(g.region)}
                  onMouseLeave={() => setHovered((h) => (h === g.region ? null : h))}
                  onFocus={() => setHovered(g.region)}
                  onBlur={() => setHovered((h) => (h === g.region ? null : h))}
                  aria-label={label}
                  aria-expanded={istAktiv}
                  className="group absolute grid h-7 w-7 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                  style={punktStyle}
                >
                  {/* Sanfter Puls am aktiven ODER extern hervorgehobenen Punkt (ruhig; reduced-motion still). */}
                  {betont && <span className="dl-ping absolute inset-1.5 rounded-full bg-copper-glow" />}
                  <span
                    className={`relative rounded-full bg-copper-grad shadow-glow transition-all duration-180 ease-emphasized group-hover:scale-125 ${
                      betont ? 'h-3.5 w-3.5 scale-125 ring-2 ring-copper' : 'h-2.5 w-2.5 ring-2 ring-ink-900/70'
                    }`}
                  />
                  {anzahl > 1 && (
                    <span className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink-900 px-1 text-[10px] font-bold leading-none text-copper-300 ring-1 ring-copper/40">
                      {anzahl}
                    </span>
                  )}
                </button>
              );
            })}

          {/* Popover: die benannten Betriebe der aktiven Region (Hover/Fokus/Klick). */}
          {aktiveGruppe && (
            <div
              className="pointer-events-none absolute z-20 w-56 max-w-[76vw]"
              style={popoverStyle(aktiveGruppe.x, aktiveGruppe.y)}
            >
              <div
                ref={popRef}
                role="dialog"
                aria-label={t('landing.betriebskarte.pop.aria', { region: aktiveGruppe.region })}
                onMouseEnter={() => setHovered(aktiveGruppe.region)}
                onMouseLeave={() => setHovered((h) => (h === aktiveGruppe.region ? null : h))}
                className="pointer-events-auto animate-fade-in rounded-2xl border border-ink-700/70 bg-ink-800/95 p-3 shadow-pop backdrop-blur-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-copper-300">
                    {t('landing.betriebskarte.pop.region', { region: aktiveGruppe.region })}
                  </span>
                  {pinned === aktiveGruppe.region && (
                    <button
                      type="button"
                      onClick={() => schliessen(aktiveGruppe.region)}
                      aria-label={t('common.close')}
                      className="grid h-6 w-6 place-items-center rounded-lg text-chrome-500 transition-colors hover:bg-ink-700/60 hover:text-chrome-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
                <ul className="space-y-2">
                  {aktiveGruppe.namen.map((b, i) => (
                    <li key={`${b.firmenname}-${i}`} className="border-ink-700/60 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-2">
                      <p className="truncate text-sm font-semibold text-chrome-50">{b.firmenname}</p>
                      {b.stadt && <p className="mt-0.5 truncate text-xs text-chrome-500">{b.stadt}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Fussnote: ehrliche Zahl ODER dezenter „bald hier"-Fallback (nie leer). */}
        <p className="mt-6 text-center text-xs text-chrome-500">
          {status === 'loading'
            ? t('landing.betriebskarte.laedt')
            : gruppen.length > 0
              ? t('landing.betriebskarte.legende', { regionen: gruppen.length })
              : t('landing.betriebskarte.leer')}
        </p>
      </div>
    </div>
  );
}
