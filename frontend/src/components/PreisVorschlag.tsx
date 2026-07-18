'use client';

// Dezenter Preisvorschlag aus der eigenen Auftragshistorie.
//
// Gibt der Werkstatt beim Kalkulieren einer Leistung eine unaufdringliche
// Orientierung: fuer eine eingegebene Leistung (+ dem Gewerk des Auftrags) werden
// der zuletzt berechnete Preis und der Median aus den EIGENEN Auftraegen gezeigt.
// Nichts wird automatisch gesetzt oder ueberschrieben; ohne Treffer erscheint
// nichts. Der Endpoint ist strikt tenant-gescoped (Server), es kommen nur die
// aggregierten Zahlen zurueck (keine Kundendaten).
//
// Hinweis: Der LeistungDetailsEditor hat selbst kein Preis-Eingabefeld (er pflegt
// Material-/Garantie-Details). "Uebernehmen" kopiert den Median daher in die
// Zwischenablage, sodass er dort eingefuegt werden kann, wo der Preis erfasst wird.

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useT } from '@/lib/i18n';

interface Vorschlag {
  median: number | null;
  letzterPreis: number | null;
  treffer: number;
}

export function PreisVorschlag({ serviceType }: { serviceType: string }) {
  const t = useT();
  const [beschreibung, setBeschreibung] = useState('');
  const [daten, setDaten] = useState<Vorschlag | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  // Sequenz-Guard: nur die Antwort der JUENGSTEN Abfrage darf den State setzen
  // (schuetzt gegen out-of-order eintreffende Antworten beim schnellen Tippen).
  const seq = useRef(0);

  // Debounced-Abfrage (~350 ms): erst wenn der Nutzer kurz pausiert, wird geladen.
  useEffect(() => {
    const q = beschreibung.trim();
    if (q.length < 3 || !serviceType) {
      setDaten(null);
      setLaedt(false);
      return;
    }
    const meineSeq = ++seq.current;
    let abgebrochen = false;
    setLaedt(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<Vorschlag>(
          `/preis-vorschlag?beschreibung=${encodeURIComponent(q)}&serviceType=${encodeURIComponent(serviceType)}`,
        );
        // Nur uebernehmen, wenn weder abgebrochen (Unmount/neuer Lauf) noch veraltet.
        if (!abgebrochen && meineSeq === seq.current) {
          setDaten(res && res.treffer > 0 ? res : null);
        }
      } catch {
        // Lookup ist rein optional -> Fehler still schlucken, nichts anzeigen.
        if (!abgebrochen && meineSeq === seq.current) setDaten(null);
      } finally {
        if (!abgebrochen && meineSeq === seq.current) setLaedt(false);
      }
    }, 350);
    return () => {
      abgebrochen = true;
      clearTimeout(timer);
    };
  }, [beschreibung, serviceType]);

  async function uebernehmen() {
    if (!daten || daten.median == null) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(String(daten.median));
        setKopiert(true);
        setTimeout(() => setKopiert(false), 1500);
      }
    } catch {
      /* Zwischenablage gesperrt (z. B. eingebettete Vorschau) -> stumm ignorieren */
    }
  }

  return (
    <div className="mt-4 border-t border-ink-700/70 pt-4">
      <label className="label" htmlFor="preisvorschlag-leistung">
        {t('preisvorschlag.label')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="preisvorschlag-leistung"
          className="input"
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          placeholder={t('preisvorschlag.placeholder')}
          autoComplete="off"
        />
        {laedt && <span className="spinner shrink-0" aria-hidden />}
      </div>
      <p className="help mt-1">{t('preisvorschlag.hint')}</p>

      {daten && daten.median != null && (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-copper/25 bg-copper-soft/40 px-3 py-2 transition-opacity"
          aria-live="polite"
        >
          <span className="text-sm text-chrome-100">
            {t('preisvorschlag.chip', {
              letzterPreis: eur(daten.letzterPreis),
              median: eur(daten.median),
              treffer: daten.treffer,
            })}
          </span>
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0"
            onClick={uebernehmen}
            title={t('preisvorschlag.uebernehmenHint')}
          >
            {kopiert ? t('preisvorschlag.kopiert') : t('preisvorschlag.uebernehmen')}
          </button>
        </div>
      )}
    </div>
  );
}
