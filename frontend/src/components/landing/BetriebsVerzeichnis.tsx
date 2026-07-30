'use client';

// ===========================================================================
// OEFFENTLICHES Betriebs-VERZEICHNIS der Landing: verbindet die LIVE-Karte
// (BetriebskarteLive) mit der gedrosselten, paginierten Betriebs-Suche
// (BetriebsSuche) zu einer ruhigen, wechselseitig verknuepften Einheit.
//
// EINE gemeinsame Zustands-Klammer (kein Effekt-Feuerwerk):
//   - Klick auf ein Suchergebnis  -> `highlightRegion`: die Karte hebt den Punkt
//     hervor (Ring + sanfter Puls) und scrollt in den Blick.
//   - Klick auf einen Kartenpunkt -> `mapClickRegion`: die Suche filtert auf diese
//     Leitregion und scrollt zum Eintrag (in BetriebsSuche).
//
// Die Datenhoheit (Whitelist, Opt-in, active/pilot) liegt vollstaendig im Backend;
// diese Komponente orchestriert nur die zwei bestehenden oeffentlichen Endpunkte.
// ===========================================================================

import { useEffect, useRef, useState } from 'react';
import { motionOk } from '@/lib/motion';
import BetriebskarteLive from './BetriebskarteLive';
import BetriebsSuche from './BetriebsSuche';

export default function BetriebsVerzeichnis() {
  // Suche -> Karte: extern hervorgehobene Leitregion (Klick auf ein Ergebnis).
  const [highlightRegion, setHighlightRegion] = useState<string | null>(null);
  // Karte -> Suche: angeklickte Leitregion (filtert + scrollt die Suche).
  const [mapClickRegion, setMapClickRegion] = useState<string | null>(null);

  const karteRef = useRef<HTMLDivElement | null>(null);

  // Klick auf ein Suchergebnis: Karte in den Blick holen, damit der hervorgehobene
  // Punkt sichtbar wird. Ruhig (reduced-motion -> ohne Smooth-Scroll).
  useEffect(() => {
    if (highlightRegion) {
      karteRef.current?.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'nearest' });
    }
  }, [highlightRegion]);

  return (
    <section className="pb-24">
      <div ref={karteRef} className="scroll-mt-24">
        <BetriebskarteLive
          highlightRegion={highlightRegion}
          onRegionClick={(region) => {
            // Toggle: derselbe Punkt erneut -> Auswahl aufheben. Karten-Klick hat
            // Vorrang, daher die (Such-)Hervorhebung zuruecksetzen.
            setMapClickRegion((prev) => (prev === region ? null : region));
            setHighlightRegion(null);
          }}
        />
      </div>

      <BetriebsSuche focusRegion={mapClickRegion} onHighlightRegion={setHighlightRegion} />
    </section>
  );
}
