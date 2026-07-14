// ===========================================================================
// Detailly Wrapped – dependency-freier Bild-Export (nativer Canvas 2D → PNG).
// ---------------------------------------------------------------------------
// KEIN html2canvas / kein externes Paket. Die On-Screen-Karte (WrappedCard.tsx)
// und dieser Renderer teilen sich EIN View-Model (WrappedView) mit bereits
// lokalisierten, formatierten Strings -> identischer Inhalt in beiden.
//
// Bewusst KEIN Betriebs-Logo (evtl. Cross-Origin -> wuerde das Canvas „tainten“
// und toBlob() verbieten). Die Marke wird als Text/Formen gezeichnet.
// ===========================================================================

/** Bereits lokalisiertes/formatiertes View-Model (Quelle fuer Karte UND Export). */
export interface WrappedView {
  jahr: number;
  betriebsname: string;
  /** kleines Label oben rechts, z. B. „Jahresrückblick“. */
  badge: string;
  /** Fußzeile, z. B. „Aufbereitung · Folierung · PPF“. */
  tagline: string;
  /** 6 Kennzahlen (Label + fertig formatierter Wert). */
  stats: { label: string; value: string }[];
}

// Feste, markentreue Dunkel-Palette (unabhaengig vom aktiven Theme), damit die
// geteilte Karte immer gleich edel aussieht. Werte = Default-Dark-Design-Tokens.
const COL = {
  bg: '#070809',
  bg2: '#0b0d11',
  card: '#101319',
  cardBorder: 'rgba(255,255,255,0.08)',
  chrome50: '#f4f6fa',
  chrome400: '#8a93a6',
  chrome500: '#727b8d',
  copper300: '#f2b877',
  copper500: '#e8923b',
};

const FONT = '-apple-system, "Segoe UI", Roboto, Inter, system-ui, sans-serif';

const W = 1080;
const H = 1350;

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Kuerzt Text mit Ellipse, bis er in maxWidth passt (Canvas-Messung). */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

/** Zeichnet die Wrapped-Karte auf ein Offscreen-Canvas (1080×1350, Hochformat). */
export async function renderWrappedCanvas(view: WrappedView): Promise<HTMLCanvasElement> {
  // Fonts abwarten, damit der Text mit der gewuenschten Schrift gerastert wird.
  try {
    await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* fonts-API nicht verfuegbar -> Systemschrift */
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D nicht verfuegbar');

  // Hintergrund + Copper-Schein oben rechts.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COL.bg2);
  bg.addColorStop(1, COL.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W - 120, 170, 40, W - 120, 170, 560);
  glow.addColorStop(0, 'rgba(232,146,59,0.20)');
  glow.addColorStop(1, 'rgba(232,146,59,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Wortmarke.
  ctx.fillStyle = COL.copper500;
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText('DETAILLY', pad, 132);

  // Badge-Pille oben rechts.
  const badgeText = view.badge.toUpperCase();
  ctx.font = `600 24px ${FONT}`;
  const bw = ctx.measureText(badgeText).width + 48;
  roundRectPath(ctx, W - pad - bw, 100, bw, 46, 23);
  ctx.fillStyle = 'rgba(232,146,59,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,146,59,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = COL.copper300;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, W - pad - bw / 2, 131);
  ctx.textAlign = 'left';

  // Jahr (gross) + Betriebsname.
  ctx.fillStyle = COL.chrome50;
  ctx.font = `800 210px ${FONT}`;
  ctx.fillText(String(view.jahr), pad - 4, 400);
  ctx.fillStyle = COL.chrome400;
  ctx.font = `500 40px ${FONT}`;
  ctx.fillText(fitText(ctx, view.betriebsname, W - 2 * pad), pad, 466);

  // Kennzahlen-Raster (2 Spalten × 3 Reihen).
  const gx = 32;
  const gy = 28;
  const cardW = (W - pad * 2 - gx) / 2;
  const cardH = 196;
  const startY = 548;
  view.stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cardW + gx);
    const y = startY + row * (cardH + gy);
    roundRectPath(ctx, x, y, cardW, cardH, 28);
    ctx.fillStyle = COL.card;
    ctx.fill();
    ctx.strokeStyle = COL.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COL.copper300;
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(fitText(ctx, s.label.toUpperCase(), cardW - 56), x + 36, y + 64);
    ctx.fillStyle = COL.chrome50;
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText(fitText(ctx, s.value, cardW - 56), x + 36, y + 134);
  });

  // Fußzeile.
  ctx.fillStyle = COL.chrome500;
  ctx.font = `500 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(view.tagline, W / 2, H - 72);
  ctx.textAlign = 'left';

  return canvas;
}

/** Rendert die Karte und stoesst den PNG-Download an (Review-before-send: nur auf Nutzeraktion). */
export async function downloadWrappedPng(view: WrappedView, filename: string): Promise<void> {
  const canvas = await renderWrappedCanvas(view);
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG konnte nicht erzeugt werden'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Nicht synchron freigeben (sonst bricht der Download in FF/Safari ab).
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve();
    }, 'image/png');
  });
}
