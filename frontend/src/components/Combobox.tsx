'use client';

// Barrierefreie, dezente Combobox (Eingabefeld + Vorschlagsliste). Bewusst
// generisch und daten-agnostisch: der Aufrufer liefert die bereits gefilterten
// `suggestions`; hier steckt nur die Interaktion (Tastatur, Fokus, Rendering).
//
// FREITEXT bleibt IMMER moeglich: der Wert ist stets der rohe Input, eine
// Auswahl setzt ihn lediglich. Keine Pflichtauswahl, keine Validierung.
//
// A11y: role="combobox"/"listbox"/"option", aria-activedescendant, ↑/↓/↵/Esc.
// Mobil: grosse Trefferzeilen. RTL: logische Utilities (start/end). Bewegungs-
// reduktion greift global (globals.css) — animate-fade-in wird dort neutralisiert.

import { useEffect, useId, useRef, useState } from 'react';

interface ComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Bereits gefilterte + sortierte Vorschlaege (Historie zuerst, dann Liste). */
  suggestions: string[];
  /** Beim ERSTEN Fokus aufgerufen -> loest das Lazy-Laden der Datenliste aus. */
  onActivate?: () => void;
  /** Zeigt eine ruhige Ladezeile, solange die Datenliste geladen wird. */
  loading?: boolean;
  loadingLabel: string;
  listLabel: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function Combobox({
  id,
  label,
  value,
  onChange,
  suggestions,
  onActivate,
  loading = false,
  loadingLabel,
  listLabel,
  placeholder,
  required,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const aktiviert = useRef(false);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const zeigeListe = open && (loading || suggestions.length > 0);

  // Aktiven Eintrag zuruecksetzen, wenn sich die Vorschlaege aendern (neue
  // Eingabe). Bei reiner Tastaturnavigation bleibt die Liste identisch (der
  // Aufrufer memoisiert sie) -> der aktive Index bleibt erhalten.
  useEffect(() => {
    setActive(-1);
  }, [suggestions]);

  // Aktiven Eintrag bei Tastaturnavigation in den sichtbaren Bereich scrollen.
  // Wenn Vorschlaege gerendert sind, entsprechen die <li>-Kinder 1:1 den Indizes.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    (listRef.current.children[active] as HTMLElement | undefined)?.scrollIntoView({
      block: 'nearest',
    });
  }, [active]);

  function aktiviere() {
    if (aktiviert.current) return;
    aktiviert.current = true;
    onActivate?.();
  }

  function auswaehlen(wert: string) {
    onChange(wert);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Nur wenn ein Vorschlag aktiv ist: uebernehmen und das Absenden des
      // umgebenden Formulars unterdruecken. Sonst normal weiterreichen.
      if (zeigeListe && active >= 0 && active < suggestions.length) {
        e.preventDefault();
        auswaehlen(suggestions[active]);
      }
    } else if (e.key === 'Escape') {
      // Nur die eigene Liste schliessen; das umgebende Modal NICHT (stopPropagation).
      if (zeigeListe) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={zeigeListe}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          zeigeListe && active >= 0 ? `${listId}-opt-${active}` : undefined
        }
        autoComplete="off"
        className="input"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          aktiviere();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {zeigeListe && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={listLabel}
          className="absolute start-0 end-0 top-full z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-ink-700 bg-ink-850 p-1 shadow-pop animate-fade-in"
        >
          {loading && suggestions.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-chrome-400" aria-live="polite">
              <span className="spinner" aria-hidden />
              {loadingLabel}
            </li>
          ) : (
            suggestions.map((wert, i) => (
              <li
                key={wert}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                // Nicht per Klick den Input-Blur ausloesen -> mousedown abfangen.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => auswaehlen(wert)}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-[2.75rem] cursor-pointer items-center rounded-lg px-3 py-2.5 text-start text-sm transition-colors ${
                  i === active ? 'bg-ink-750 text-chrome-50' : 'text-chrome-200'
                }`}
              >
                {wert}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
