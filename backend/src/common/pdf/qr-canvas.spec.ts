import { buildQrCanvas, MM_TO_PT } from './qr-canvas';
import { QrCode, Ecc } from './qrcodegen';

/**
 * QR-Canvas-Wrapper: Beweist, dass die vom Nayuki-Generator berechnete
 * Modul-Matrix modulgenau in pdfmake-Rechtecke uebersetzt wird, dass die
 * 4-Modul-Ruhezone eingehalten ist und die Kantenlaenge im Zielbereich liegt.
 */
const url = 'https://app.detailly.de/track/?t=deadbeefdeadbeef';

describe('buildQrCanvas', () => {
  it('rastert die QR-Matrix modulgenau in Rechtecke (Modulzahl + Ruhezone)', () => {
    const qr = QrCode.encodeText(url, Ecc.MEDIUM);
    let dunkel = 0;
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) dunkel++;

    const res = buildQrCanvas(url);
    expect(res.moduleCount).toBe(qr.size);
    expect(res.quietModules).toBe(4);

    // Erstes Rect = weisser Hintergrund ueber das gesamte Symbol.
    expect(res.canvas[0]).toMatchObject({ type: 'rect', x: 0, y: 0, color: '#FFFFFF' });

    // Genau ein schwarzes Quadrat je gesetztem Modul (+1 Hintergrund).
    const dunkelRects = res.canvas.filter((r) => r.color === '#000000');
    expect(dunkelRects.length).toBe(dunkel);
    expect(res.canvas.length).toBe(dunkel + 1);

    // Ruhezone: kein schwarzes Modul beginnt vor 4 Modulbreiten und keines endet
    // hinter (size+4) Modulbreiten -> rundum 4 Module frei.
    const m = res.modulePt;
    const minStart = 4 * m - 1e-6;
    const maxEnde = (qr.size + 4) * m + 1e-6;
    for (const r of dunkelRects) {
      expect(r.x).toBeGreaterThanOrEqual(minStart);
      expect(r.y).toBeGreaterThanOrEqual(minStart);
      expect(r.x + r.w).toBeLessThanOrEqual(maxEnde);
      expect(r.y + r.h).toBeLessThanOrEqual(maxEnde);
      expect(r.w).toBeCloseTo(m, 6);
      expect(r.h).toBeCloseTo(m, 6);
    }
  });

  it('Kantenlaenge ~30 mm inkl. Ruhezone (im Zielbereich 28–32 mm)', () => {
    const res = buildQrCanvas(url);
    expect(res.totalPt).toBeCloseTo(30 * MM_TO_PT, 5);
    expect(res.totalPt).toBeGreaterThanOrEqual(28 * MM_TO_PT);
    expect(res.totalPt).toBeLessThanOrEqual(32 * MM_TO_PT);
    // Hintergrund-Rect deckt das gesamte Symbol; (size + 2*quiet) Module fuellen es.
    expect(res.canvas[0]).toMatchObject({ w: res.totalPt, h: res.totalPt });
    expect(res.modulePt * (res.moduleCount + 8)).toBeCloseTo(res.totalPt, 5);
  });

  it('kodiert genau den uebergebenen Text (anderer Inhalt -> anderes Muster)', () => {
    const a = buildQrCanvas('https://app.detailly.de/track/?t=aaaaaaaa');
    const b = buildQrCanvas('https://app.detailly.de/track/?t=bbbbbbbb');
    const musterA = a.canvas.slice(1).map((r) => `${r.x},${r.y}`).join('|');
    const musterB = b.canvas.slice(1).map((r) => `${r.x},${r.y}`).join('|');
    expect(musterA).not.toBe(musterB);
  });
});
