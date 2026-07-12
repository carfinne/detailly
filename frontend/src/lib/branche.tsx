'use client';

// Branchen-Theming: Der Betriebstyp des Mandanten faerbt die App um (Akzent),
// steuert den Kalkulations-Katalog und typspezifische Optionen.
// Quelle ist GET /tenants/me/branding (alle Rollen); der letzte Wert wird pro
// Geraet gecacht, damit das Theme beim naechsten Laden ohne Flackern steht.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type Betriebstyp = 'aufbereitung' | 'folierung' | 'ppf' | 'komplett';

// Akzentfarbe je Betriebstyp (sprachneutrales Theming).
export const BETRIEBSTYP_META: Record<Betriebstyp, { akzent: string }> = {
  aufbereitung: { akzent: '#E8923B' }, // Kupfer (Detailly-Stammfarbe)
  folierung: { akzent: '#9B76FC' }, // Ultraviolett
  ppf: { akzent: '#3EBFB9' }, // Eis-Teal
  komplett: { akzent: '#E8923B' },
};

// i18n-Keys für die Texte je Betriebstyp. React-frei; Aufrufer rendern per
//   t(BETRIEBSTYP_LABEL_KEY[typ].label) usw.
export const BETRIEBSTYP_LABEL_KEY: Record<
  Betriebstyp,
  { label: string; claim: string; beschreibung: string }
> = {
  aufbereitung: {
    label: 'labels.betriebstyp.aufbereitung.label',
    claim: 'labels.betriebstyp.aufbereitung.claim',
    beschreibung: 'labels.betriebstyp.aufbereitung.beschreibung',
  },
  folierung: {
    label: 'labels.betriebstyp.folierung.label',
    claim: 'labels.betriebstyp.folierung.claim',
    beschreibung: 'labels.betriebstyp.folierung.beschreibung',
  },
  ppf: {
    label: 'labels.betriebstyp.ppf.label',
    claim: 'labels.betriebstyp.ppf.claim',
    beschreibung: 'labels.betriebstyp.ppf.beschreibung',
  },
  komplett: {
    label: 'labels.betriebstyp.komplett.label',
    claim: 'labels.betriebstyp.komplett.claim',
    beschreibung: 'labels.betriebstyp.komplett.beschreibung',
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
