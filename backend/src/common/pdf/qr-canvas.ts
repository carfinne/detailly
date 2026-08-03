/**
 * QR-Code als pdfmake-`canvas`-Element (kein Bild, kein natives Rendering).
 *
 * pdfmake kann in einem `canvas`-Knoten Rechtecke zeichnen
 * (`{ type:'rect', x, y, w, h, color }`). Damit rastern wir die vom
 * abhaengigkeitsfreien Nayuki-Generator (./qrcodegen) berechnete Modul-Matrix
 * in schwarze Quadrate auf weissem Grund – so entsteht ein scanbarer QR-Code
 * OHNE zusaetzliches npm-Paket und ohne Rasterbild.
 *
 * Druck-Robustheit (bewusst gesetzt):
 *  - Fehlerkorrektur mindestens Stufe M: gedruckte Codes werden geknickt/
 *    verschmutzt, ~15 % Redundanz faengt das ab.
 *  - Ruhezone von 4 Modulen rundum: viele Handykameras finden den Code sonst
 *    nicht (die "leise Zone" ist Teil der QR-Spezifikation).
 *  - Kantenlaenge ~30 mm inkl. Ruhezone: gross genug fuer Handscans vom Papier.
 *    pdfmake rechnet in Punkt (pt): 1 mm entspricht 2,834645 pt.
 */
import { QrCode, Ecc } from './qrcodegen';

/** 1 mm in PDF-Punkt (72 pt = 25,4 mm). */
export const MM_TO_PT = 72 / 25.4; // ~2,834645

export interface QrCanvasOptions {
  /** Kantenlaenge des GESAMTEN Symbols inkl. Ruhezone in mm (Default 30). */
  sizeMm?: number;
  /** Ruhezone rundum in Modulen (Default 4, QR-Spezifikationsminimum). */
  quietModules?: number;
  /** Fehlerkorrektur-Stufe (Default 'M'; 'Q' fuer stark beanspruchte Codes). */
  ecc?: 'M' | 'Q';
  /** Farbe der gesetzten Module (Default Schwarz). */
  dark?: string;
  /** Hintergrund-/Ruhezonenfarbe (Default Weiss). */
  light?: string;
}

/** Ein einzelnes pdfmake-Rechteck im canvas-Knoten. */
interface CanvasRect {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** Rueckgabe von {@link buildQrCanvas}: der pdfmake-Knoten plus Kennzahlen. */
export interface QrCanvasResult {
  /** Direkt in eine pdfmake-Dokumentdefinition einsetzbarer canvas-Knoten. */
  canvas: CanvasRect[];
  /** Modulzahl je Kante OHNE Ruhezone (qr.size). */
  moduleCount: number;
  /** Ruhezone in Modulen (rundum). */
  quietModules: number;
  /** Kantenlaenge eines Moduls in pt. */
  modulePt: number;
  /** Kantenlaenge des gesamten Symbols inkl. Ruhezone in pt. */
  totalPt: number;
}

/**
 * Baut aus einem Text (hier: der Track-Link) einen QR-Code und rastert ihn in
 * pdfmake-Rechtecke. Der erste Rect ist der weisse Hintergrund (deckt die
 * Ruhezone garantiert ab, auch auf farbigem Untergrund); danach folgt je
 * gesetztem Modul ein schwarzes Quadrat.
 *
 * Extra-Kennzahlen (moduleCount/…) sind fuer Layout + Tests; pdfmake liest
 * ausschliesslich `canvas` und ignoriert die uebrigen Felder.
 */
export function buildQrCanvas(text: string, opts: QrCanvasOptions = {}): QrCanvasResult {
  const sizeMm = opts.sizeMm ?? 30;
  const quiet = opts.quietModules ?? 4;
  const dark = opts.dark ?? '#000000';
  const light = opts.light ?? '#FFFFFF';
  const ecc = opts.ecc === 'Q' ? Ecc.QUARTILE : Ecc.MEDIUM;

  const qr = QrCode.encodeText(text, ecc);
  const moduleCount = qr.size;
  const totalModules = moduleCount + 2 * quiet;
  const totalPt = sizeMm * MM_TO_PT;
  const modulePt = totalPt / totalModules;

  const rects: CanvasRect[] = [
    // Weisser Grund ueber das gesamte Symbol (inkl. Ruhezone).
    { type: 'rect', x: 0, y: 0, w: totalPt, h: totalPt, color: light },
  ];

  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      if (!qr.getModule(x, y)) continue;
      rects.push({
        type: 'rect',
        x: (quiet + x) * modulePt,
        y: (quiet + y) * modulePt,
        w: modulePt,
        h: modulePt,
        color: dark,
      });
    }
  }

  return { canvas: rects, moduleCount, quietModules: quiet, modulePt, totalPt };
}
