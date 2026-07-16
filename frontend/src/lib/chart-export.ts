// Dependency-freie Export-Helfer fuer Diagramme (CSV + PNG).
//
// Bewusst ohne Fremd-Bibliothek: CSV wird aus den bereits im Client
// vorhandenen Datenreihen gebaut, PNG entsteht durch Serialisieren eines
// SVG-Charts -> Canvas -> toBlob. Alle Funktionen laufen nur im Browser
// (Aufruf ausschliesslich aus Event-Handlern); defensive typeof-Guards
// schuetzen den statischen Export/SSR-Pfad.
//
// CSV-Format (bewusste Entscheidung, im PR dokumentiert):
//   - UTF-8 mit BOM (﻿) -> gaengige Tabellenkalkulationen erkennen Umlaute.
//   - Semikolon als Trenner -> passt zum deutschen Listentrenner.
//   - Deutsches Zahlenformat: Dezimal-Komma, KEIN Tausenderpunkt, damit die
//     Zellen numerisch/parsebar bleiben. Einheit gehoert in die Spaltenkopf-
//     Zeile (z. B. "Umsatz (EUR)").
//   - RFC-4180-Quoting: Felder mit ; " oder Zeilenumbruch werden in "…" gesetzt,
//     enthaltene Anfuehrungszeichen verdoppelt.

export type CsvCell = string | number;

/** Deutsches Zahlenformat ohne Tausenderpunkt (Dezimal-Komma). */
export function csvNum(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return '';
  const fixed = typeof decimals === 'number' ? value.toFixed(decimals) : String(value);
  return fixed.replace('.', ',');
}

function escapeCell(cell: CsvCell): string {
  const raw = typeof cell === 'number' ? csvNum(cell) : cell;
  if (/[";\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Baut den CSV-Text (inkl. BOM) aus Kopfzeile + Datenzeilen. */
export function buildCsv(header: CsvCell[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(';'));
  // CRLF als breit kompatible Zeilentrennung fuer Tabellenkalkulationen.
  return '﻿' + lines.join('\r\n');
}

/** Startet einen Datei-Download fuer einen Blob (haengt kurz ein <a> ein). */
function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Kurz verzoegert freigeben, damit der Download sicher gestartet ist.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Baut eine CSV-Datei aus Kopf + Zeilen und laedt sie herunter. */
export function downloadCsv(filename: string, header: CsvCell[], rows: CsvCell[][]): void {
  const csv = buildCsv(header, rows);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

/** Loest alle CSS-Variablen `var(--x)` im serialisierten Markup zu konkreten
 *  Werten auf (aus dem Root-ComputedStyle). Notwendig, weil ein serialisiertes
 *  Standalone-SVG die Design-Tokens der Seite sonst nicht kennt. */
function resolveCssVars(markup: string, computed: CSSStyleDeclaration): string {
  return markup.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_match, name: string) => {
    const value = computed.getPropertyValue(name).trim();
    return value || 'transparent';
  });
}

export interface SvgToPngOptions {
  /** Skalierung fuer knackige Aufloesung (Standard 2×). */
  scale?: number;
  /** Hintergrundfarbe (Standard: aufgeloestes --ink-850, der Karten-Grund). */
  background?: string;
}

/**
 * Serialisiert ein SVG-Chart in ein PNG und laedt es herunter.
 * Loest zuvor die Token-basierten CSS-Variablen auf und fuellt einen
 * deckenden Hintergrund (das Chart selbst ist transparent).
 */
export async function svgToPng(
  svg: SVGSVGElement,
  filename: string,
  opts: SvgToPngOptions = {},
): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const computed = getComputedStyle(document.documentElement);
  const scale = opts.scale ?? 2;

  // Groesse aus Layout (bevorzugt) oder viewBox ableiten.
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox?.baseVal;
  const width = Math.max(1, Math.round(rect.width || vb?.width || 600));
  const height = Math.max(1, Math.round(rect.height || vb?.height || 190));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  let markup = new XMLSerializer().serializeToString(clone);
  markup = resolveCssVars(markup, computed);

  const svgUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG-Bild konnte nicht geladen werden.'));
      img.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas-Kontext nicht verfuegbar.');

    const bg = opts.background ?? `rgb(${computed.getPropertyValue('--ink-850').trim()})`;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, filename);
        resolve();
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Sprechender Dateiname-Baustein: aktuelles Jahr-Monat, z. B. "2026-07". */
export function jahrMonat(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
