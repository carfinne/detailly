'use client';

// Marke- + Modell-Eingabehilfe fuer das Fahrzeug-Anlegen. Rendert ZWEI Felder
// (als flache Grid-Kinder via Fragment, damit sie sich in bestehende Grids des
// Formulars UND der Schnellanlage einfuegen). Dreistufige Vorschlagsquelle:
//   1. eigene Historie zuerst (GET /vehicles/suggestions, tenant-scoped),
//   2. kuratierte Modellliste (lazy geladen, siehe fahrzeug-modelle.ts),
//   3. Freitext bleibt immer moeglich (Combobox erzwingt keine Auswahl).
// Modell-Vorschlaege werden auf die gewaehlte Marke gefiltert.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { vergleichsform, rankFilter } from '@/lib/fahrzeug-match';
import type { MarkenDaten } from '@/lib/fahrzeug-modelle';
import { Combobox } from './Combobox';

/** So viele Vorschlaege maximal je Feld anzeigen. */
const MAX_VORSCHLAEGE = 8;

interface Suggestions {
  makes: string[];
  models: { make: string; model: string }[];
}

// Modul-Cache fuer die (statische) Datenliste: nur EINMAL pro Session laden,
// egal wie oft das Formular geoeffnet wird. Die Historie ist tenant-/zeit-
// abhaengig und wird pro Mount frisch geholt.
let datenCache: MarkenDaten | null = null;
let datenPromise: Promise<MarkenDaten> | null = null;

function ladeDaten(): Promise<MarkenDaten> {
  if (datenCache) return Promise.resolve(datenCache);
  datenPromise ??= import('@/lib/fahrzeug-modelle').then((m) => (datenCache = m.FAHRZEUG_MARKEN));
  return datenPromise;
}

interface MarkeModellFelderProps {
  make: string;
  model: string;
  onMakeChange: (value: string) => void;
  onModelChange: (value: string) => void;
  labelMarke: string;
  labelModell: string;
  /** Eindeutiges Praefix fuer die beiden Feld-IDs (Label-Zuordnung). */
  idPrefix: string;
  required?: boolean;
}

export function MarkeModellFelder({
  make,
  model,
  onMakeChange,
  onModelChange,
  labelMarke,
  labelModell,
  idPrefix,
  required,
}: MarkeModellFelderProps) {
  const t = useT();
  const [daten, setDaten] = useState<MarkenDaten | null>(datenCache);
  const [historie, setHistorie] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const aktiviert = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Beim ersten Fokus eines der Felder: Datenliste (lazy chunk) + eigene
  // Historie parallel laden. Fehler bei der Historie sind unkritisch (die
  // Eingabehilfe ist optional) -> leise auf leere Liste zuruecksetzen.
  function aktiviere() {
    if (aktiviert.current) return;
    aktiviert.current = true;
    setLoading(true);
    Promise.all([
      ladeDaten(),
      api.get<Suggestions>('/vehicles/suggestions').catch(
        () => ({ makes: [], models: [] } as Suggestions),
      ),
    ])
      .then(([d, h]) => {
        if (!mounted.current) return;
        setDaten(d);
        setHistorie(h);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }

  const alleMarken = useMemo(() => (daten ? Object.keys(daten) : []), [daten]);

  const markeVorschlaege = useMemo(() => {
    const hist = rankFilter(historie?.makes ?? [], make, MAX_VORSCHLAEGE);
    const gesehen = new Set(hist.map(vergleichsform));
    const kuratiert = rankFilter(alleMarken, make, MAX_VORSCHLAEGE).filter(
      (m) => !gesehen.has(vergleichsform(m)),
    );
    return [...hist, ...kuratiert].slice(0, MAX_VORSCHLAEGE);
  }, [historie, alleMarken, make]);

  const modellVorschlaege = useMemo(() => {
    const mk = vergleichsform(make);
    // Historie: nur Modelle der aktuell getippten/gewaehlten Marke.
    const histModelle = (historie?.models ?? [])
      .filter((mm) => vergleichsform(mm.make) === mk)
      .map((mm) => mm.model);
    // Kuratierte Modelle: passenden Marken-Key exakt (in Vergleichsform) finden.
    let kuratierteModelle: string[] = [];
    if (daten && make.trim()) {
      const key = Object.keys(daten).find((k) => vergleichsform(k) === mk);
      if (key) kuratierteModelle = daten[key];
    }
    const hist = rankFilter(histModelle, model, MAX_VORSCHLAEGE);
    const gesehen = new Set(hist.map(vergleichsform));
    const kuratiert = rankFilter(kuratierteModelle, model, MAX_VORSCHLAEGE).filter(
      (m) => !gesehen.has(vergleichsform(m)),
    );
    return [...hist, ...kuratiert].slice(0, MAX_VORSCHLAEGE);
  }, [historie, daten, make, model]);

  return (
    <>
      <div>
        <Combobox
          id={`${idPrefix}-marke`}
          label={labelMarke}
          value={make}
          onChange={onMakeChange}
          suggestions={markeVorschlaege}
          onActivate={aktiviere}
          loading={loading}
          loadingLabel={t('vorschlag.loading')}
          listLabel={t('vorschlag.listLabel')}
          required={required}
        />
      </div>
      <div>
        <Combobox
          id={`${idPrefix}-modell`}
          label={labelModell}
          value={model}
          onChange={onModelChange}
          suggestions={modellVorschlaege}
          onActivate={aktiviere}
          loading={loading}
          loadingLabel={t('vorschlag.loading')}
          listLabel={t('vorschlag.listLabel')}
          required={required}
        />
      </div>
    </>
  );
}
