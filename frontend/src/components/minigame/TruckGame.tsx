'use client';

// ===========================================================================
// „Detailly-Truck" – ein kleines, charmantes Snake-Spiel als Easter-Egg.
// ---------------------------------------------------------------------------
// Dependency-frei: nur Canvas 2D + requestAnimationFrame, Grid-basiert. Ein
// Lieferwagen sammelt Pakete ein und wird pro Paket länger; Kollision mit Wand
// oder sich selbst = Game over. Highscore in localStorage, kein Backend.
//
// WICHTIG: Diese (vergleichsweise schwere) Datei wird ausschließlich lazy per
// next/dynamic({ ssr:false }) aus dem TruckGameLauncher geladen – sie landet
// deshalb NICHT im First-Load-Bundle. Nichts hier läuft beim SSR/Export.
//
// Steuerung: Pfeiltasten + WASD, Wischen (Touch), On-Screen-Steuerkreuz.
// Leertaste = Pause/Weiter, Esc/X = schließen. prefers-reduced-motion wird
// respektiert (keine dekorativen Umgebungs-Animationen; nur das Spiel bewegt
// sich, und das erst nach dem Start). Pausiert automatisch bei Tab-Wechsel.
// ===========================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { pushModalToken, popModalToken, isTopModalToken } from '@/components/ui';

type Dir = 'up' | 'down' | 'left' | 'right';
type Cell = { x: number; y: number };
type Status = 'idle' | 'running' | 'paused' | 'over';

interface State {
  snake: Cell[]; // snake[0] = Kopf (der Truck)
  dir: Dir; // zuletzt ausgeführte Richtung
  nextDir: Dir; // gepufferte Eingabe für den nächsten Schritt
  food: Cell;
  tick: number; // ms pro Schritt (wird mit jedem Paket schneller)
  score: number;
}

const GRID = 15; // Zellen je Seite (quadratisches Feld)
const TICK_START = 155; // Start-Tempo (ms/Schritt)
const TICK_MIN = 85; // schnellstes Tempo
const TICK_STEP = 4; // Beschleunigung je eingesammeltem Paket
const HIGHSCORE_KEY = 'detailly.truckgame.highscore';

const DIRV: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

// --- Reine Hilfsfunktionen (modul-lokal, nicht pro Render neu erzeugt) ------

function placeFood(snake: Cell[]): Cell {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

function makeInitial(): State {
  const m = Math.floor(GRID / 2);
  const snake: Cell[] = [
    { x: m, y: m },
    { x: m - 1, y: m },
    { x: m - 2, y: m },
  ];
  return { snake, dir: 'right', nextDir: 'right', food: placeFood(snake), tick: TICK_START, score: 0 };
}

interface Palette {
  cell: string;
  grid: string;
  truck: string;
  truckHead: string;
  truckDark: string;
  pkg: string;
  pkgStrap: string;
}

/** Liest die aktiven Design-Tokens (Kupfer/Ink/Chrome) → passt sich Theme &
 *  Farbschema automatisch an. Token liegen als „r g b"-Tripel vor. */
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (name: string, fb: string): string => {
    const v = cs.getPropertyValue(name).trim();
    return v ? `rgb(${v.split(/\s+/).join(', ')})` : fb;
  };
  return {
    cell: rgb('--ink-850', 'rgb(16, 19, 25)'),
    grid: cs.getPropertyValue('--grid-line').trim() || 'rgba(255, 255, 255, 0.05)',
    truck: rgb('--copper-500', 'rgb(232, 146, 59)'),
    truckHead: rgb('--copper-400', 'rgb(237, 164, 85)'),
    truckDark: rgb('--ink-950', 'rgb(7, 8, 9)'),
    pkg: rgb('--chrome-100', 'rgb(226, 230, 238)'),
    pkgStrap: rgb('--copper-500', 'rgb(232, 146, 59)'),
  };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBody(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, pal: Palette): void {
  const pad = cell * 0.12;
  ctx.fillStyle = pal.truck;
  roundRectPath(ctx, x + pad, y + pad, cell - 2 * pad, cell - 2 * pad, cell * 0.22);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, dir: Dir, pal: Palette): void {
  const pad = cell * 0.08;
  ctx.fillStyle = pal.truckHead;
  roundRectPath(ctx, x + pad, y + pad, cell - 2 * pad, cell - 2 * pad, cell * 0.26);
  ctx.fill();
  // „Windschutzscheibe" zur Fahrtrichtung – lässt den Kopf wie eine Fahrerkabine wirken.
  const ws = cell * 0.3;
  const cx = x + cell / 2;
  const cy = y + cell / 2;
  let wx = cx - ws / 2;
  let wy = cy - ws / 2;
  const edge = cell * 0.1;
  if (dir === 'up') wy = y + pad + edge;
  else if (dir === 'down') wy = y + cell - pad - edge - ws;
  else if (dir === 'left') wx = x + pad + edge;
  else wx = x + cell - pad - edge - ws;
  ctx.fillStyle = pal.truckDark;
  roundRectPath(ctx, wx, wy, ws, ws, cell * 0.1);
  ctx.fill();
}

function drawPackage(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, pal: Palette): void {
  const pad = cell * 0.18;
  const s = cell - 2 * pad;
  ctx.fillStyle = pal.pkg;
  roundRectPath(ctx, x + pad, y + pad, s, s, cell * 0.14);
  ctx.fill();
  // Kupfer-Klebeband als Kreuz.
  ctx.strokeStyle = pal.pkgStrap;
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + pad + s / 2, y + pad);
  ctx.lineTo(x + pad + s / 2, y + pad + s);
  ctx.moveTo(x + pad, y + pad + s / 2);
  ctx.lineTo(x + pad + s, y + pad + s / 2);
  ctx.stroke();
}

// ===========================================================================

export default function TruckGame({ onClose }: { onClose: () => void }) {
  const t = useT();

  const panelRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef<State>(makeInitial());
  const statusRef = useRef<Status>('idle');
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const paletteRef = useRef<Palette | null>(null);
  const sizeRef = useRef<number>(0);
  const highscoreRef = useRef<number>(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const tokenRef = useRef<symbol | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [score, setScore] = useState(0);
  const [highscore, setHighscore] = useState(0);
  const [isNewHigh, setIsNewHigh] = useState(false);

  // ---- Zeichnen ------------------------------------------------------------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const pal = paletteRef.current;
    const size = sizeRef.current;
    if (!canvas || !pal || !size) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const st = stateRef.current;
    const cell = size / GRID;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = pal.cell;
    roundRectPath(ctx, 0, 0, size, size, Math.min(16, cell));
    ctx.fill();

    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
    }
    ctx.stroke();

    drawPackage(ctx, st.food.x * cell, st.food.y * cell, cell, pal);

    // Von hinten nach vorne, damit der Kopf oben liegt.
    for (let i = st.snake.length - 1; i >= 0; i--) {
      const seg = st.snake[i];
      const x = seg.x * cell;
      const y = seg.y * cell;
      if (i === 0) drawHead(ctx, x, y, cell, st.dir, pal);
      else drawBody(ctx, x, y, cell, pal);
    }
  }, []);

  const cancelLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const gameOver = useCallback(() => {
    statusRef.current = 'over';
    setStatus('over');
    cancelLoop();
    const sc = stateRef.current.score;
    if (sc > highscoreRef.current) {
      highscoreRef.current = sc;
      setHighscore(sc);
      setIsNewHigh(true);
      try {
        localStorage.setItem(HIGHSCORE_KEY, String(sc));
      } catch {
        /* localStorage evtl. gesperrt – Highscore bleibt nur in dieser Sitzung */
      }
    } else {
      setIsNewHigh(false);
    }
  }, [cancelLoop]);

  const step = useCallback(() => {
    const st = stateRef.current;
    const dir = st.nextDir;
    st.dir = dir;
    const head = st.snake[0];
    const nx = head.x + DIRV[dir].x;
    const ny = head.y + DIRV[dir].y;

    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      gameOver();
      return;
    }
    const willGrow = nx === st.food.x && ny === st.food.y;
    // Beim Wachsen bleibt das Schwanzende liegen, sonst rückt es nach.
    const body = willGrow ? st.snake : st.snake.slice(0, -1);
    if (body.some((c) => c.x === nx && c.y === ny)) {
      gameOver();
      return;
    }
    st.snake.unshift({ x: nx, y: ny });
    if (willGrow) {
      st.score += 1;
      st.tick = Math.max(TICK_MIN, st.tick - TICK_STEP);
      st.food = placeFood(st.snake);
      setScore(st.score);
    } else {
      st.snake.pop();
    }
  }, [gameOver]);

  const loop = useCallback(
    (ts: number) => {
      if (statusRef.current !== 'running') return;
      const st = stateRef.current;
      if (ts - lastRef.current >= st.tick) {
        lastRef.current = ts;
        step();
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    },
    [draw, step],
  );

  const startGame = useCallback(() => {
    stateRef.current = makeInitial();
    setScore(0);
    setIsNewHigh(false);
    statusRef.current = 'running';
    setStatus('running');
    lastRef.current = performance.now();
    cancelLoop();
    rafRef.current = requestAnimationFrame(loop);
  }, [cancelLoop, loop]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    statusRef.current = 'paused';
    setStatus('paused');
    cancelLoop();
    draw();
  }, [cancelLoop, draw]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    statusRef.current = 'running';
    setStatus('running');
    lastRef.current = performance.now();
    cancelLoop();
    rafRef.current = requestAnimationFrame(loop);
  }, [cancelLoop, loop]);

  const setDir = useCallback((d: Dir) => {
    if (statusRef.current !== 'running') return;
    const st = stateRef.current;
    // Kein 180°-Wendemanöver in den eigenen Körper.
    if (st.snake.length > 1 && OPPOSITE[st.dir] === d) return;
    st.nextDir = d;
  }, []);

  /** Vom Steuerkreuz/Touch: startet im Leerlauf und setzt dann die Richtung. */
  const handleDir = useCallback(
    (d: Dir) => {
      if (statusRef.current === 'idle') startGame();
      setDir(d);
    },
    [startGame, setDir],
  );

  // ---- Highscore laden -----------------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIGHSCORE_KEY);
      const v = raw ? parseInt(raw, 10) : 0;
      if (!Number.isNaN(v) && v > 0) {
        highscoreRef.current = v;
        setHighscore(v);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ---- Canvas einrichten + auf Größe reagieren -----------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paletteRef.current = readPalette();
    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const size = Math.max(160, Math.round(rect.width));
      sizeRef.current = size;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // ---- Tastatur: Steuerung + Pause + Esc + Fokus-Falle ---------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Nur das oberste Overlay verarbeitet Tasten. So schließt ein Escape aus
      // einem Spiel-über-Modal nur das Spiel; das Modal (nicht top-of-stack)
      // ignoriert dasselbe Ereignis über seinen eigenen Stack-Guard.
      const token = tokenRef.current;
      if (token && !isTopModalToken(token)) return;

      if (e.key === 'Tab') {
        const root = panelRef.current;
        if (!root) return;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        ).filter((n) => n.offsetParent !== null);
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        // Wenn ein Button/Link fokussiert ist, Leertaste dem nativen
        // Button-Verhalten überlassen (aktiviert das Control), sonst Pause/Weiter.
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'BUTTON' || ae.tagName === 'A')) return;
        e.preventDefault();
        if (statusRef.current === 'running') pause();
        else if (statusRef.current === 'paused') resume();
        else startGame();
        return;
      }
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };
      const dir = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (dir) {
        e.preventDefault();
        handleDir(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pause, resume, startGame, handleDir]);

  // ---- Bei Tab-/Fensterwechsel pausieren (kein Weiterlaufen im Verborgenen) -
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pause]);

  // ---- Aufräumen: laufende Animation stoppen -------------------------------
  useEffect(() => cancelLoop, [cancelLoop]);

  // ---- Am Modal-Stack teilnehmen + Fokus verwalten -------------------------
  // pushModalToken() macht das Spiel zum obersten Overlay (Escape wird nur hier
  // verarbeitet, ein darunterliegendes Modal bleibt offen) und sperrt den
  // Body-Scroll ref-counted. Beim Schließen geht der Fokus an den auslösenden
  // Launcher-Button zurück (WCAG 2.4.3), statt auf document.body zu fallen.
  useEffect(() => {
    const token = pushModalToken();
    tokenRef.current = token;
    const prevActive = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      popModalToken(token);
      tokenRef.current = null;
      prevActive?.focus?.();
    };
  }, []);

  // ---- Touch: Wischen = Richtung, Tippen = Pause/Weiter ---------------------
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touchRef.current = { x: p.clientX, y: p.clientY };
    if (statusRef.current === 'idle') startGame();
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < 18) {
      if (statusRef.current === 'running') pause();
      else if (statusRef.current === 'paused') resume();
      return;
    }
    if (ax > ay) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
  };

  const dpadBtn = (d: Dir, label: string, path: string, cls: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => handleDir(d)}
      className={`grid h-11 w-11 place-items-center rounded-xl border border-ink-600 bg-ink-800/60 text-chrome-200 transition-colors hover:border-copper/50 hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 active:scale-95 ${cls}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('minigame.title')}
        tabIndex={-1}
        className="dl-modal-in w-full max-w-md rounded-2xl border border-ink-700 bg-ink-850 shadow-pop focus:outline-none"
      >
        {/* Kopf: Titel + Schließen */}
        <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-chrome-50">
            <span aria-hidden="true">🚚</span>
            {t('minigame.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('minigame.close')}
            className="grid h-8 w-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Punkte / Bestwert */}
          <div className="mb-3 flex items-center justify-between text-sm" aria-live="polite">
            <span className="font-semibold text-copper">{t('minigame.score', { n: score })}</span>
            <span className="text-chrome-400">{t('minigame.highscore', { n: highscore })}</span>
          </div>

          {/* Spielfeld + Overlays */}
          <div className="relative mx-auto aspect-square w-full max-w-[24rem]">
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none rounded-xl"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              aria-label={t('minigame.title')}
            />

            {status === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-ink-950/70 p-6 text-center backdrop-blur-sm">
                <p className="text-sm text-chrome-300">{t('minigame.intro')}</p>
                <button type="button" className="btn-primary" onClick={startGame}>
                  {t('minigame.start')}
                </button>
              </div>
            )}

            {status === 'paused' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-ink-950/70 p-6 text-center backdrop-blur-sm">
                <p className="font-display text-lg font-semibold text-chrome-50">{t('minigame.pause')}</p>
                <button type="button" className="btn-primary" onClick={resume}>
                  {t('minigame.resume')}
                </button>
              </div>
            )}

            {status === 'over' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-ink-950/80 p-6 text-center backdrop-blur-sm">
                <p className="font-display text-xl font-bold text-chrome-50">{t('minigame.gameOver')}</p>
                {isNewHigh && (
                  <span className="rounded-lg border border-copper/30 bg-copper-soft px-3 py-1 text-sm font-semibold text-copper">
                    {t('minigame.newHighscore')}
                  </span>
                )}
                <p className="text-sm text-chrome-300">{t('minigame.score', { n: score })}</p>
                <button type="button" className="btn-primary mt-1" onClick={startGame}>
                  {t('minigame.restart')}
                </button>
              </div>
            )}
          </div>

          {/* Steuerkreuz (mobil hilfreich, überall bedienbar) */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="grid grid-cols-3 grid-rows-2 gap-1.5" role="group" aria-label={t('minigame.controls')}>
              {dpadBtn('up', t('minigame.dir.up'), 'M12 19V5M5 12l7-7 7 7', 'col-start-2 row-start-1')}
              {dpadBtn('left', t('minigame.dir.left'), 'M19 12H5M12 5l-7 7 7 7', 'col-start-1 row-start-2')}
              {dpadBtn('down', t('minigame.dir.down'), 'M12 5v14M5 12l7 7 7-7', 'col-start-2 row-start-2')}
              {dpadBtn('right', t('minigame.dir.right'), 'M5 12h14M12 5l7 7-7 7', 'col-start-3 row-start-2')}
            </div>

            {(status === 'running' || status === 'paused') && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => (status === 'running' ? pause() : resume())}
              >
                {status === 'running' ? t('minigame.pause') : t('minigame.resume')}
              </button>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-chrome-500">{t('minigame.hint')}</p>
        </div>
      </div>
    </div>
  );
}
