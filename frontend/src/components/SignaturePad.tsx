'use client';

// Unterschriften-Feld: eine selbst-enthaltene Canvas, die per PointerEvents
// (Touch/Stift UND Maus) einen Strichzug aufnimmt und als PNG-Data-URL liefert.
// Es gibt KEIN Canvas-/Zeichenmuster im Repo – diese Komponente ist neu und
// bewusst ohne externe Signatur-Bibliothek (leichtgewichtig, ein <canvas>).
//
// Bedienung:
//   - Mit Finger/Stift/Maus im Feld unterschreiben.
//   - "Leeren" setzt die Zeichenflaeche zurueck.
//   - "Unterschreiben & abschliessen" ist erst aktiv, wenn etwas gezeichnet
//     wurde UND der Name ausgefuellt ist; ruft onConfirm(dataUrl, name).

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SignaturePadProps {
  /** Eingefrorener Einwilligungstext (Spiegel des serverseitigen CONSENT_TEXT). */
  consentText: string;
  /** Liefert die PNG-Data-URL + den Namen des Unterzeichnenden. */
  onConfirm: (unterschriftPng: string, unterschriebenVonName: string) => void;
  /** Abbrechen (Modal schliessen). */
  onCancel: () => void;
  /** Laeuft gerade ein Speichervorgang (Button-Sperre). */
  busy?: boolean;
}

export default function SignaturePad({
  consentText,
  onConfirm,
  onCancel,
  busy = false,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const letzter = useRef<{ x: number; y: number } | null>(null);
  const [istLeer, setIstLeer] = useState(true);
  const istLeerRef = useRef(true);
  const [name, setName] = useState('');

  // Canvas in Geraete-Aufloesung (devicePixelRatio) initialisieren, damit der
  // Strich auf Tablets/Retina scharf bleibt. Hintergrund weiss, Linie dunkel.
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#11161f';
  }, []);

  useEffect(() => {
    initCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    // ResizeObserver passt die Zeichenflaeche an die finale Groesse an (z.B. wenn
    // das Modal erst aufklappt). NUR neu aufsetzen, solange noch nichts gezeichnet
    // wurde – sonst wuerde eine laufende/fertige Unterschrift geloescht (Tablet:
    // Tastatur oeffnet sich beim Namensfeld / Geraet wird gedreht).
    const ro = new ResizeObserver(() => {
      if (istLeerRef.current) initCanvas();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [initCanvas]);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    letzter.current = punkt(e);
    setIstLeer(false);
    istLeerRef.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const von = letzter.current;
    if (!ctx || !von) return;
    const zu = punkt(e);
    ctx.beginPath();
    ctx.moveTo(von.x, von.y);
    ctx.lineTo(zu.x, zu.y);
    ctx.stroke();
    letzter.current = zu;
  }

  function onPointerUp() {
    zeichnet.current = false;
    letzter.current = null;
  }

  function leeren() {
    initCanvas();
    setIstLeer(true);
    istLeerRef.current = true;
  }

  function bestaetigen() {
    const canvas = canvasRef.current;
    if (!canvas || istLeer || !name.trim() || busy) return;
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl, name.trim());
  }

  const kannBestaetigen = !istLeer && name.trim().length > 0 && !busy;

  return (
    <div className="space-y-4">
      {/* Einwilligungstext – read-only Spiegel; der wahre Wert kommt vom Server. */}
      <div className="rounded-xl border border-ink-700 bg-ink-800/60 px-4 py-3 text-sm text-chrome-300">
        {consentText}
      </div>

      <div>
        <label className="label" htmlFor="sig-name">
          Name des Unterzeichnenden
        </label>
        <input
          id="sig-name"
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="z. B. Max Mustermann"
          disabled={busy}
          autoComplete="off"
        />
      </div>

      <div>
        <label className="label">Unterschrift</label>
        <div className="overflow-hidden rounded-xl border border-ink-600 bg-white">
          <canvas
            ref={canvasRef}
            className="block h-48 w-full cursor-crosshair touch-none select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="help">Mit Finger, Stift oder Maus im Feld unterschreiben.</p>
          <button
            type="button"
            className="btn-subtle text-xs"
            onClick={leeren}
            disabled={istLeer || busy}
          >
            Leeren
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={bestaetigen}
          disabled={!kannBestaetigen}
        >
          {busy ? 'Speichere…' : 'Unterschreiben & abschließen'}
        </button>
      </div>
    </div>
  );
}
