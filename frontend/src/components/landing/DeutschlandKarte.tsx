'use client';

// ===========================================================================
// Deutschlandkarte der Detailly-Betriebe (Qualitaetssiegel auf der Landing).
// ---------------------------------------------------------------------------
// Vollstaendig handgebaut: eine stilisierte, grob gezeichnete Deutschland-
// Silhouette als Inline-SVG (KEINE Karten-Library, keine externen Tiles/Requests)
// plus anklickbare Punkte je belegter PLZ-Leitregion. Datensparsam: es kommt NUR
// die 2-stellige Leitregion (`plzRegion`) aus dem Backend an – nie die volle PLZ
// oder Adresse; und nur fuer aktiv ZAHLENDE, zustimmende Betriebe. Die Karte
// plottet ausschliesslich Eintraege mit gesetztem `plzRegion`.
//
// Ehrlichkeit: rendert NUR ab >= 3 Betrieben mit Leitregion – sonst gar nicht.
// ===========================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { BETRIEBSTYP_LABEL_KEY, type Betriebstyp } from '@/lib/branche';

/**
 * Minimale Form, die die Karte braucht (strukturell von `PublicMitglied` erfuellt).
 * Bewusst schlank, damit die Karte keine PII kennt, die sie nicht anzeigt.
 */
export type KartenBetrieb = {
  firmenname: string;
  betriebstyp: Betriebstyp;
  stadt: string | null;
  webseite: string | null;
  plzRegion: string | null;
};

/**
 * Position je 2-stelliger PLZ-Leitregion im viewBox 0 0 600 800.
 * Abgeleitet aus den realen Geokoordinaten der jeweiligen Leitstadt und linear
 * ins viewBox projiziert (x ~ Laengengrad, y ~ Breitengrad). Anker geprueft:
 * 01 Dresden (Ost), 04 Leipzig, 10–14 Berlin (Nordost), 18 Rostock (Nord),
 * 20–22 Hamburg (Nord), 24 Kiel (Nord), 28 Bremen, 30 Hannover, 34 Kassel (Mitte),
 * 40 Duesseldorf (West), 44–45 Ruhrgebiet, 50–51 Koeln (West), 55 Mainz,
 * 60 Frankfurt, 66 Saarbruecken (Suedwest), 70 Stuttgart, 79 Freiburg (Suedwest),
 * 80–85 Muenchen (Suedost), 90 Nuernberg, 99 Erfurt.
 * Unbekannte Leitregion -> kein Eintrag hier -> Punkt wird weggelassen (kein Crash).
 */
const PLZ_REGION_POS: Record<string, { x: number; y: number }> = {
  '01': { x: 469, y: 414 }, // Dresden
  '02': { x: 516, y: 404 }, // Bautzen/Goerlitz (Ostspitze)
  '03': { x: 499, y: 350 }, // Cottbus
  '04': { x: 397, y: 387 }, // Leipzig
  '06': { x: 376, y: 375 }, // Halle/Dessau
  '07': { x: 357, y: 429 }, // Gera/Jena
  '08': { x: 395, y: 455 }, // Zwickau/Plauen
  '09': { x: 426, y: 433 }, // Chemnitz
  '10': { x: 449, y: 279 }, // Berlin
  '12': { x: 455, y: 287 }, // Berlin
  '13': { x: 447, y: 272 }, // Berlin
  '14': { x: 435, y: 292 }, // Berlin/Potsdam
  '15': { x: 511, y: 297 }, // Frankfurt (Oder)
  '16': { x: 461, y: 247 }, // Brandenburg Nord/Prenzlau
  '17': { x: 444, y: 188 }, // Neubrandenburg/Stralsund
  '18': { x: 385, y: 140 }, // Rostock
  '19': { x: 347, y: 181 }, // Schwerin
  '20': { x: 273, y: 187 }, // Hamburg
  '21': { x: 281, y: 182 }, // Hamburg Ost
  '22': { x: 266, y: 193 }, // Hamburg West
  '23': { x: 310, y: 160 }, // Luebeck
  '24': { x: 281, y: 119 }, // Kiel
  '25': { x: 232, y: 139 }, // Husum/Itzehoe
  '26': { x: 160, y: 220 }, // Oldenburg/Emden
  '27': { x: 200, y: 189 }, // Bremerhaven/Cuxhaven
  '28': { x: 212, y: 231 }, // Bremen
  '29': { x: 295, y: 216 }, // Lueneburg/Celle
  '30': { x: 260, y: 295 }, // Hannover
  '31': { x: 268, y: 310 }, // Hildesheim/Hameln
  '32': { x: 206, y: 319 }, // Herford/Minden
  '33': { x: 206, y: 337 }, // Bielefeld/Paderborn
  '34': { x: 248, y: 390 }, // Kassel
  '35': { x: 210, y: 436 }, // Marburg/Giessen
  '36': { x: 257, y: 459 }, // Fulda
  '37': { x: 271, y: 370 }, // Goettingen
  '38': { x: 301, y: 304 }, // Braunschweig
  '39': { x: 359, y: 316 }, // Magdeburg
  '40': { x: 107, y: 397 }, // Duesseldorf
  '41': { x: 88, y: 401 }, //  Moenchengladbach
  '42': { x: 127, y: 395 }, // Wuppertal
  '44': { x: 142, y: 372 }, // Dortmund
  '45': { x: 119, y: 377 }, // Essen
  '46': { x: 100, y: 369 }, // Oberhausen/Wesel
  '47': { x: 97, y: 387 }, //  Duisburg/Krefeld
  '48': { x: 151, y: 332 }, // Muenster
  '49': { x: 173, y: 303 }, // Osnabrueck
  '50': { x: 114, y: 421 }, // Koeln
  '51': { x: 122, y: 427 }, // Koeln/Leverkusen
  '52': { x: 70, y: 438 }, //  Aachen
  '53': { x: 123, y: 442 }, // Bonn
  '54': { x: 99, y: 531 }, //  Trier
  '55': { x: 184, y: 508 }, // Mainz
  '56': { x: 149, y: 476 }, // Koblenz
  '57': { x: 171, y: 429 }, // Siegen
  '58': { x: 142, y: 386 }, // Hagen
  '59': { x: 165, y: 364 }, // Hamm/Soest
  '60': { x: 203, y: 497 }, // Frankfurt am Main
  '61': { x: 200, y: 483 }, // Bad Homburg/Friedberg
  '63': { x: 216, y: 498 }, // Offenbach/Hanau/Aschaffenburg
  '64': { x: 204, y: 520 }, // Darmstadt
  '65': { x: 183, y: 501 }, // Wiesbaden
  '66': { x: 118, y: 576 }, // Saarbruecken
  '67': { x: 158, y: 558 }, // Kaiserslautern/Ludwigshafen
  '68': { x: 194, y: 554 }, // Mannheim
  '69': { x: 205, y: 562 }, // Heidelberg
  '70': { x: 229, y: 616 }, // Stuttgart
  '71': { x: 238, y: 624 }, // Ludwigsburg
  '72': { x: 220, y: 626 }, // Reutlingen/Tuebingen
  '73': { x: 243, y: 610 }, // Esslingen/Goeppingen/Aalen
  '74': { x: 233, y: 585 }, // Heilbronn
  '75': { x: 206, y: 608 }, // Pforzheim
  '76': { x: 191, y: 597 }, // Karlsruhe
  '77': { x: 167, y: 646 }, // Offenburg
  '78': { x: 206, y: 697 }, // Villingen/Konstanz
  '79': { x: 162, y: 689 }, // Freiburg
  '80': { x: 354, y: 673 }, // Muenchen
  '81': { x: 361, y: 678 }, // Muenchen
  '82': { x: 345, y: 682 }, // Starnberg/Muenchen West
  '83': { x: 372, y: 686 }, // Rosenheim/Muenchen Suedost
  '84': { x: 378, y: 660 }, // Landshut
  '85': { x: 346, y: 663 }, // Freising/Muenchen Nord
  '86': { x: 321, y: 655 }, // Augsburg
  '87': { x: 290, y: 712 }, // Kempten
  '88': { x: 254, y: 708 }, // Ravensburg/Friedrichshafen
  '89': { x: 274, y: 652 }, // Ulm
  '90': { x: 328, y: 556 }, // Nuernberg
  '91': { x: 336, y: 563 }, // Erlangen/Ansbach
  '92': { x: 373, y: 553 }, // Weiden/Amberg
  '93': { x: 383, y: 597 }, // Regensburg
  '94': { x: 440, y: 634 }, // Passau/Deggendorf
  '95': { x: 362, y: 508 }, // Bayreuth/Hof
  '96': { x: 321, y: 517 }, // Bamberg/Coburg
  '97': { x: 271, y: 527 }, // Wuerzburg/Schweinfurt
  '98': { x: 310, y: 454 }, // Suhl
  '99': { x: 328, y: 420 }, // Erfurt
};

/**
 * Stuetzpunkte der stilisierten Silhouette (im Uhrzeigersinn, viewBox 0 0 600 800).
 * Bewusst reduziert/geschmackvoll – umschliesst locker alle Leitregionen; echte
 * Grenzstaedte (Aachen, Freiburg, Saarbruecken, Passau) liegen absichtlich nah am
 * Rand. Wird per `smoothClosedPath` zu weichen Ecken verrundet.
 */
const SILHOUETTE: readonly (readonly [number, number])[] = [
  [150, 205], // Emsland Nordwest
  [180, 150], // Elbe-/Wesermuendung
  [205, 105], // Nordfriesische Kueste
  [225, 62], //  Richtung Sylt (Nordspitze)
  [262, 58], //  Flensburg (Grenze DK)
  [300, 96], //  Ostsee-Kueste Ost-Holstein
  [340, 128], // Luebecker Bucht
  [404, 118], // Rostock (Ostsee)
  [472, 136], // Ruegen/Nordost
  [494, 210], // Uckermark
  [522, 286], // Oder (Ostgrenze)
  [534, 402], // Goerlitz (Ostspitze)
  [472, 472], // Boehmische Grenze Nordwest
  [452, 560], // Bayerischer Wald
  [454, 644], // Passau (Donau, Suedost)
  [434, 716], // Berchtesgaden (Suedostspitze)
  [352, 722], // suedlich Muenchen (Alpen)
  [278, 730], // Allgaeu/Oberstdorf (Suedspitze)
  [218, 714], // Bodensee
  [150, 690], // Hochrhein/Freiburg (Suedwest)
  [112, 606], // Suedpfalz/Oberrhein
  [84, 558], //  Saarland (Westspitze Sued)
  [66, 502], //  Trier/Eifel
  [50, 440], //  Aachen (Westspitze)
  [74, 386], //  Niederrhein
  [95, 328], //  West-NRW (Grenze NL)
  [106, 273], // Grenze NL (Twente)
  [126, 230], // Emsland
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
const VB_W = 600;
const VB_H = 800;

type Gruppe = { region: string; x: number; y: number; betriebe: KartenBetrieb[] };

/** Popover-Platzierung: klappt je nach Lage nach oben/unten und an den Rand-Kanten. */
function popoverStyle(x: number, y: number): React.CSSProperties {
  const leftPct = (x / VB_W) * 100;
  const topPct = (y / VB_H) * 100;
  const below = y < VB_H * 0.46; // obere Kartenhaelfte -> Popover nach unten
  const tx = leftPct < 26 ? '-14%' : leftPct > 74 ? '-86%' : '-50%';
  const ty = below ? '16px' : 'calc(-100% - 16px)';
  return { left: `${leftPct}%`, top: `${topPct}%`, transform: `translate(${tx}, ${ty})` };
}

export default function DeutschlandKarte({ betriebe }: { betriebe: KartenBetrieb[] }) {
  const t = useT();
  const [offen, setOffen] = useState<string | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const popRef = useRef<HTMLDivElement | null>(null);

  // Nach Leitregion gruppieren; nur Regionen mit bekannter Position werden geplottet.
  const gruppen = useMemo<Gruppe[]>(() => {
    const map = new Map<string, KartenBetrieb[]>();
    for (const b of betriebe) {
      if (!b.plzRegion) continue;
      const arr = map.get(b.plzRegion);
      if (arr) arr.push(b);
      else map.set(b.plzRegion, [b]);
    }
    const out: Gruppe[] = [];
    Array.from(map.entries()).forEach(([region, list]) => {
      const pos = PLZ_REGION_POS[region];
      if (!pos) return; // unbekannte Region -> Punkt weglassen (kein Crash)
      out.push({ region, x: pos.x, y: pos.y, betriebe: list });
    });
    // Stabile, deterministische Reihenfolge (Nordost -> Suedwest wirkt ruhig).
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  }, [betriebe]);

  // Schliesst das Popover; gibt den Fokus optional an den Punkt der Region zurueck
  // (Tastatur-Ergonomie). Fokus bewusst AUSSERHALB des State-Updaters (StrictMode-fest).
  const schliessen = useCallback((fokusRegion?: string) => {
    setOffen(null);
    if (fokusRegion) btnRefs.current[fokusRegion]?.focus();
  }, []);

  // Esc schliesst (und gibt den Fokus an den Punkt zurueck); Klick ausserhalb schliesst.
  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        schliessen(offen);
      }
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (btnRefs.current[offen]?.contains(target)) return;
      schliessen();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [offen, schliessen]);

  // Ehrlichkeit: unter 3 Betrieben mit Leitregion rendert die Sektion GAR NICHT.
  const gesamt = gruppen.reduce((s, g) => s + g.betriebe.length, 0);
  if (gesamt < 3) return null;

  const offeneGruppe = offen ? gruppen.find((g) => g.region === offen) : undefined;

  return (
    <section className="pb-24">
      <div className="mb-10 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-copper-300">
          {t('landing.karte.kicker')}
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t('landing.karte.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chrome-400">
          {t('landing.karte.sub')}
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-[520px]">
        {/* Karten-Buehne: SVG-Silhouette als dezenter Grund, Punkte als HTML-Buttons. */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="dl-karte-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--ink-750))" stopOpacity="0.85" />
                <stop offset="100%" stopColor="rgb(var(--ink-850))" stopOpacity="0.7" />
              </linearGradient>
              <radialGradient id="dl-karte-glow" cx="52%" cy="42%" r="60%">
                <stop offset="0%" stopColor="var(--copper-glow)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
            {/* weicher Akzent-Schimmer hinter der Silhouette */}
            <path d={GERMANY_PATH} fill="url(#dl-karte-glow)" opacity="0.5" />
            <path
              d={GERMANY_PATH}
              fill="url(#dl-karte-fill)"
              stroke="rgb(var(--copper-500))"
              strokeOpacity="0.45"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>

          {/* Punkte */}
          {gruppen.map((g) => {
            const anzahl = g.betriebe.length;
            const istOffen = offen === g.region;
            return (
              <button
                key={g.region}
                type="button"
                ref={(el) => {
                  btnRefs.current[g.region] = el;
                }}
                onClick={() => setOffen((r) => (r === g.region ? null : g.region))}
                aria-label={t('landing.karte.pin.aria', { anzahl, region: g.region })}
                aria-expanded={istOffen}
                className="group absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
                style={{ left: `${(g.x / VB_W) * 100}%`, top: `${(g.y / VB_H) * 100}%` }}
              >
                <span className="dl-ping absolute inset-1.5 rounded-full bg-copper-glow" />
                <span
                  className={`relative rounded-full bg-copper-grad shadow-glow ring-2 ring-ink-900/70 transition-transform duration-180 ease-emphasized group-hover:scale-125 ${
                    istOffen ? 'h-3.5 w-3.5 scale-125' : 'h-2.5 w-2.5'
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

          {/* Popover fuer die offene Region */}
          {offeneGruppe && (
            <div
              className="absolute z-20 w-56 max-w-[76vw]"
              style={popoverStyle(offeneGruppe.x, offeneGruppe.y)}
            >
              <div
                ref={popRef}
                role="dialog"
                aria-label={t('landing.karte.pop.aria', { region: offeneGruppe.region })}
                className="animate-fade-in rounded-2xl border border-ink-700/70 bg-ink-800/95 p-3 shadow-pop backdrop-blur-md"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-copper-300">
                    {t('landing.karte.pop.region', { region: offeneGruppe.region })}
                  </span>
                  <button
                    type="button"
                    onClick={() => schliessen(offeneGruppe.region)}
                    aria-label={t('common.close')}
                    className="grid h-6 w-6 place-items-center rounded-lg text-chrome-500 transition-colors hover:bg-ink-700/60 hover:text-chrome-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <ul className="space-y-2">
                  {offeneGruppe.betriebe.map((b, i) => {
                    const label = t(
                      BETRIEBSTYP_LABEL_KEY[b.betriebstyp]?.label ?? BETRIEBSTYP_LABEL_KEY.komplett.label,
                    );
                    return (
                      <li key={`${b.firmenname}-${i}`} className="border-ink-700/60 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-2">
                        <p className="truncate text-sm font-semibold text-chrome-50">{b.firmenname}</p>
                        <p className="mt-0.5 truncate text-xs text-chrome-500">
                          {b.stadt ? `${b.stadt} · ${label}` : label}
                        </p>
                        {b.webseite && (
                          <a
                            href={b.webseite}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-copper-300 hover:text-copper-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-1 focus-visible:ring-offset-ink-800"
                          >
                            {t('landing.karte.pop.website')}
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 17L17 7M9 7h8v8" />
                            </svg>
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Legende (ehrlich, aus echten Zahlen) */}
        <p className="mt-6 text-center text-xs text-chrome-500">
          {t('landing.karte.legende', { betriebe: gesamt, regionen: gruppen.length })}
        </p>
      </div>
    </section>
  );
}
