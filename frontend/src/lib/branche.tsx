'use client';

// Branchen-Theming: Der Betriebstyp des Mandanten faerbt die App um (Akzent),
// steuert den Kalkulations-Katalog und typspezifische Optionen.
// Quelle ist GET /tenants/me/branding (alle Rollen); der letzte Wert wird pro
// Geraet gecacht, damit das Theme beim naechsten Laden ohne Flackern steht.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type Betriebstyp = 'aufbereitung' | 'folierung' | 'ppf' | 'komplett';

export const BETRIEBSTYP_META: Record<
  Betriebstyp,
  { label: string; claim: string; beschreibung: string; akzent: string }
> = {
  aufbereitung: {
    label: 'Fahrzeugaufbereitung',
    claim: 'Glanz, Politur & Pflege',
    beschreibung: 'Innen-/Außenaufbereitung, Politur, Versiegelung – klassisches Detailing.',
    akzent: '#E8923B', // Kupfer (Detailly-Stammfarbe)
  },
  folierung: {
    label: 'Folierung',
    claim: 'Farbwechsel & Design',
    beschreibung: 'Voll-/Teilfolierung, Farbwechsel, Design- und Werbefolierung.',
    akzent: '#9B76FC', // Ultraviolett
  },
  ppf: {
    label: 'PPF / Lackschutz',
    claim: 'Schutz & Präzision',
    beschreibung: 'Lackschutzfolie (Paint Protection Film) – Teil- und Komplettschutz.',
    akzent: '#3EBFB9', // Eis-Teal
  },
  komplett: {
    label: 'Komplett-Anbieter',
    claim: 'Alles aus einer Hand',
    beschreibung: 'Aufbereitung, Folierung und PPF – alle Module und Kataloge aktiv.',
    akzent: '#E8923B',
  },
};

const STORAGE_KEY = 'detailly_branche';

/** Setzt das Branchen-Attribut (Theme) sofort und merkt es pro Geraet. */
export function applyBranche(b: Betriebstyp | null) {
  try {
    if (b && b !== 'aufbereitung' && b !== 'komplett') {
      document.documentElement.dataset.branche = b;
    } else {
      // Kupfer ist das Default-Theme -> Attribut weglassen (weniger CSS-Pfade).
      delete document.documentElement.dataset.branche;
    }
    if (b) localStorage.setItem(STORAGE_KEY, b);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage evtl. gesperrt -> nur Attribut setzen schlug fehl: ignorieren */
  }
}

function cached(): Betriebstyp | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in BETRIEBSTYP_META ? (v as Betriebstyp) : null;
  } catch {
    return null;
  }
}

/**
 * Laedt den Betriebstyp (gecacht -> sofort, dann Server-Wahrheit) und wendet
 * das Theme an. Fuer die App-Shell gedacht; raeumt das Attribut beim Verlassen
 * der App (z. B. Logout -> /login) wieder auf.
 */
export function useBrancheTheme(aktiv: boolean): Betriebstyp {
  const [branche, setBranche] = useState<Betriebstyp>(() => cached() ?? 'komplett');

  useEffect(() => {
    if (!aktiv) return;
    applyBranche(cached()); // sofort, ohne auf die API zu warten
    let steht = true;
    api
      .get<{ betriebstyp: Betriebstyp }>('/tenants/me/branding')
      .then((r) => {
        if (!steht) return;
        setBranche(r.betriebstyp);
        applyBranche(r.betriebstyp);
      })
      .catch(() => undefined); // Theme ist nie ein Blocker
    return () => {
      steht = false;
      delete document.documentElement.dataset.branche;
    };
  }, [aktiv]);

  return branche;
}
