'use client';

// Interaktive Kalkulation je Betriebstyp: Bauteile/Leistungen anklicken
// (Liste ODER Fahrzeug-Draufsicht) -> der Preis rechnet sich live aus
// Basispreis x Fahrzeuggroesse x Materialstufe; jede Position ist manuell
// uebersteuerbar. Keramik-Versiegelung ist bewusst eine OPTION innerHALB
// der Kalkulation (kein eigenes Modul, s. Nacht-Brief).
//
// Preis-Anpassungen gelten fuer die aktuelle Kalkulation (kein Server-State);
// eine je Betrieb gepflegte Preisliste ist als Folgeschritt dokumentiert.

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Betriebstyp } from '@/lib/branche';
import { BETRIEBSTYP_META } from '@/lib/branche';
import {
  FAHRZEUG_GROESSEN,
  KATALOGE,
  KATALOG_REIHENFOLGE,
  KERAMIK_OPTION,
  type KalkKatalog,
} from '@/lib/kalkulation-katalog';
import { PageHeader, SectionCard } from '@/components/ui';

const MWST = 0.19;
const rund2 = (n: number) => Math.round(n * 100) / 100;

// Fahrzeug-Draufsicht: gleiche Zonen-Geometrie wie die Schadenserfassung
// (100x100-viewBox), hier fuers An-/Abwaehlen von Bauteilen.
const AUTO_ZONEN: { id: string; d: string }[] = [
  { id: 'stossstange_v', d: 'M30 6 H70 V14 H30 Z' },
  { id: 'motorhaube', d: 'M30 14 H70 V30 H30 Z' },
  { id: 'dach', d: 'M32 40 H68 V64 H32 Z' },
  { id: 'heckklappe', d: 'M30 74 H70 V86 H30 Z' },
  { id: 'stossstange_h', d: 'M30 86 H70 V94 H30 Z' },
  { id: 'kotfluegel_vl', d: 'M18 14 H30 V34 H18 Z' },
  { id: 'kotfluegel_vr', d: 'M70 14 H82 V34 H70 Z' },
  { id: 'tuer_vl', d: 'M18 34 H30 V54 H18 Z' },
  { id: 'tuer_vr', d: 'M70 34 H82 V54 H70 Z' },
  { id: 'tuer_hl', d: 'M18 54 H30 V74 H18 Z' },
  { id: 'tuer_hr', d: 'M70 54 H82 V74 H70 Z' },
  { id: 'kotfluegel_hl', d: 'M18 74 H30 V88 H18 Z' },
  { id: 'kotfluegel_hr', d: 'M70 74 H82 V88 H70 Z' },
];

function AutoDiagramm({
  katalog,
  gewaehlt,
  onToggle,
}: {
  katalog: KalkKatalog;
  gewaehlt: Set<string>;
  onToggle: (id: string) => void;
}) {
  const posByZone = useMemo(() => {
    const m = new Map<string, { id: string; label: string }>();
    for (const p of katalog.positionen) if (p.zone) m.set(p.zone, p);
    return m;
  }, [katalog]);

  return (
    <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[260px]" role="group" aria-label="Fahrzeug-Draufsicht: Bauteile anklicken">
      {/* Karosserie-Silhouette */}
      <rect x="16" y="4" width="68" height="92" rx="14" className="fill-ink-800 stroke-ink-600" strokeWidth="1" />
      {/* Scheiben (nicht waehlbar) */}
      <path d="M30 30 H70 V40 H30 Z" className="fill-ink-700/60" />
      <path d="M30 64 H70 V74 H30 Z" className="fill-ink-700/60" />
      {AUTO_ZONEN.map((z) => {
        const pos = posByZone.get(z.id);
        if (!pos) return <path key={z.id} d={z.d} className="fill-ink-750" />;
        const aktiv = gewaehlt.has(pos.id);
        return (
          <path
            key={z.id}
            d={z.d}
            role="button"
            tabIndex={0}
            aria-pressed={aktiv}
            aria-label={pos.label}
            onClick={() => onToggle(pos.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle(pos.id);
              }
            }}
            className={`cursor-pointer stroke-ink-600 transition-colors ${
              aktiv ? 'fill-copper/70 stroke-copper' : 'fill-ink-750 hover:fill-copper/25'
            }`}
            strokeWidth="0.6"
          >
            <title>{pos.label}</title>
          </path>
        );
      })}
    </svg>
  );
}

export default function KalkulationPage() {
  const [betriebstyp, setBetriebstyp] = useState<Betriebstyp>('komplett');
  const [katalogTyp, setKatalogTyp] = useState<(typeof KATALOG_REIHENFOLGE)[number]>('aufbereitung');

  // Auswahl + Anpassungen (je Katalog frisch).
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [override, setOverride] = useState<Record<string, string>>({});
  const [groesse, setGroesse] = useState('mittel');
  const [material, setMaterial] = useState('standard');

  // Keramik-Option (innerhalb der Kalkulation, alle Typen).
  const [keramik, setKeramik] = useState(false);
  const [keramikBasis, setKeramikBasis] = useState(String(KERAMIK_OPTION.basispreis));
  const [keramikSchichten, setKeramikSchichten] = useState(0); // ZUSAETZLICHE Schichten
  const [keramikProSchicht, setKeramikProSchicht] = useState(String(KERAMIK_OPTION.preisProWeitereSchicht));

  const [kopiert, setKopiert] = useState(false);

  // Betriebstyp laden: bestimmt, welche Kataloge angeboten werden.
  useEffect(() => {
    api
      .get<{ betriebstyp: Betriebstyp }>('/tenants/me/branding')
      .then((r) => {
        setBetriebstyp(r.betriebstyp);
        if (r.betriebstyp !== 'komplett') setKatalogTyp(r.betriebstyp);
      })
      .catch(() => undefined);
  }, []);

  const katalog = KATALOGE[katalogTyp];
  const groesseFaktor = FAHRZEUG_GROESSEN.find((g) => g.id === groesse)?.faktor ?? 1;
  const materialFaktor = katalog.materialStufen.find((m) => m.id === material)?.faktor ?? 1;

  function wechsleKatalog(typ: (typeof KATALOG_REIHENFOLGE)[number]) {
    setKatalogTyp(typ);
    setGewaehlt(new Set());
    setOverride({});
    setMaterial('standard');
  }

  function toggle(id: string) {
    setGewaehlt((s) => {
      const neu = new Set(s);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function paketWaehlen(ids: string[]) {
    // Paket ergaenzt die Auswahl (nochmal klicken schadet nicht).
    setGewaehlt((s) => {
      const neu = new Set(s);
      for (const id of ids) neu.add(id);
      return neu;
    });
  }

  /** Berechneter Preis einer Position (vor manueller Uebersteuerung). */
  function berechnet(id: string): number {
    const p = katalog.positionen.find((x) => x.id === id);
    if (!p) return 0;
    return rund2(p.basispreis * groesseFaktor * materialFaktor);
  }

  /** Effektiver Zeilenpreis: Override (falls gueltig) sonst berechnet. */
  function zeilenPreis(id: string): number {
    const o = override[id];
    if (o !== undefined && o !== '' && !Number.isNaN(Number(o))) return Math.max(0, Number(o));
    return berechnet(id);
  }

  const zeilen = katalog.positionen.filter((p) => gewaehlt.has(p.id));
  const keramikSumme = keramik
    ? Math.max(0, Number(keramikBasis) || 0) + keramikSchichten * Math.max(0, Number(keramikProSchicht) || 0)
    : 0;
  const netto = rund2(zeilen.reduce((s, p) => s + zeilenPreis(p.id), 0) + keramikSumme);
  const mwst = rund2(netto * MWST);
  const brutto = rund2(netto + mwst);

  async function zusammenfassungKopieren() {
    const g = FAHRZEUG_GROESSEN.find((x) => x.id === groesse)?.label ?? '';
    const m = katalog.materialStufen.find((x) => x.id === material)?.label;
    const teile = zeilen.map((p) => `- ${p.label}${p.hinweis ? ` (${p.hinweis})` : ''}: ${eur(zeilenPreis(p.id))}`);
    if (keramik) {
      teile.push(
        `- ${KERAMIK_OPTION.label} (1${keramikSchichten ? `+${keramikSchichten}` : ''} Schicht${keramikSchichten ? 'en' : ''}): ${eur(keramikSumme)}`,
      );
    }
    const text = [
      `Kalkulation ${katalog.titel} – ${g}${m ? `, ${m}` : ''}`,
      ...teile,
      `Netto: ${eur(netto)}`,
      `MwSt (19 %): ${eur(mwst)}`,
      `Gesamt: ${eur(brutto)}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch {
      /* Clipboard evtl. gesperrt */
    }
  }

  const hatDiagramm = katalog.positionen.some((p) => p.zone);

  return (
    <div>
      <PageHeader
        title="Kalkulation"
        subtitle="Bauteile bzw. Leistungen anklicken – der Preis rechnet sich live. Jede Position bleibt anpassbar."
        icon={<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2" /></>}
      />

      {/* Katalog-Tabs: nur fuer Komplett-Anbieter; sonst ist der Typ fix. */}
      {betriebstyp === 'komplett' && (
        <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-ink-700 bg-ink-850 p-1">
          {KATALOG_REIHENFOLGE.map((t) => (
            <button
              key={t}
              onClick={() => wechsleKatalog(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                katalogTyp === t ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
              }`}
            >
              {KATALOGE[t].titel}
            </button>
          ))}
        </div>
      )}
      {betriebstyp !== 'komplett' && (
        <p className="mb-5 text-sm text-chrome-500">
          Katalog: <span className="font-medium text-copper">{BETRIEBSTYP_META[betriebstyp].label}</span>
          {' '}– weitere Kataloge über Einstellungen → Betriebstyp „Komplett-Anbieter".
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Linke Spalte: Auswahl */}
        <div className="space-y-5">
          {/* Rahmenparameter */}
          <SectionCard title="Fahrzeug & Material">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="kalk-groesse">Fahrzeuggröße</label>
                <select id="kalk-groesse" className="input" value={groesse} onChange={(e) => setGroesse(e.target.value)}>
                  {FAHRZEUG_GROESSEN.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}{g.faktor !== 1 ? ` (×${g.faktor})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {katalog.materialStufen.length > 0 && (
                <div className="field">
                  <label className="label" htmlFor="kalk-material">{katalog.materialLabel}</label>
                  <select id="kalk-material" className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>
                    {katalog.materialStufen.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}{m.faktor !== 1 ? ` (×${m.faktor})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {katalog.pakete.length > 0 && (
              <div className="mt-4">
                <span className="label mb-1.5 block">Schnellauswahl</span>
                <div className="flex flex-wrap gap-2">
                  {katalog.pakete.map((paket) => (
                    <button key={paket.label} className="btn-subtle btn-sm" onClick={() => paketWaehlen(paket.ids)}>
                      + {paket.label}
                    </button>
                  ))}
                  {gewaehlt.size > 0 && (
                    <button className="btn-ghost btn-sm" onClick={() => { setGewaehlt(new Set()); setOverride({}); }}>
                      Auswahl leeren
                    </button>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Bauteil-/Leistungsauswahl */}
          <SectionCard title={katalog.gruppenLabel} subtitle="Anklicken zum Hinzufügen – im Diagramm oder in der Liste.">
            <div className={hatDiagramm ? 'grid gap-5 sm:grid-cols-[240px_1fr]' : ''}>
              {hatDiagramm && (
                <AutoDiagramm katalog={katalog} gewaehlt={gewaehlt} onToggle={toggle} />
              )}
              <ul className="space-y-1">
                {katalog.positionen.map((p) => {
                  const aktiv = gewaehlt.has(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => toggle(p.id)}
                        aria-pressed={aktiv}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          aktiv
                            ? 'border-copper/50 bg-copper-soft text-chrome-50'
                            : 'border-transparent text-chrome-300 hover:bg-ink-800/60 hover:text-chrome-100'
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {p.label}
                          {p.hinweis && <span className="ml-1.5 text-xs text-chrome-500">({p.hinweis})</span>}
                        </span>
                        <span className={`shrink-0 tabular-nums ${aktiv ? 'font-semibold text-copper' : 'text-chrome-500'}`}>
                          {eur(rund2(p.basispreis * groesseFaktor * materialFaktor))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </SectionCard>

          {/* Keramik: Option INNERHALB der Kalkulation (kein eigenes Modul) */}
          <SectionCard title={KERAMIK_OPTION.label} subtitle={KERAMIK_OPTION.beschreibung}>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-chrome-200">Keramik-Versiegelung hinzufügen</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                checked={keramik}
                onChange={(e) => setKeramik(e.target.checked)}
              />
            </label>
            {keramik && (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="field">
                  <label className="label" htmlFor="keramik-basis">Basispreis (inkl. 1 Schicht)</label>
                  <input id="keramik-basis" type="number" min="0" step="1" className="input" value={keramikBasis} onChange={(e) => setKeramikBasis(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="keramik-schichten">Weitere Schichten</label>
                  <select id="keramik-schichten" className="input" value={keramikSchichten} onChange={(e) => setKeramikSchichten(Number(e.target.value))}>
                    {Array.from({ length: KERAMIK_OPTION.maxWeitereSchichten + 1 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? 'keine' : `+${i}`}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="keramik-pro">Preis je weitere Schicht</label>
                  <input id="keramik-pro" type="number" min="0" step="1" className="input" value={keramikProSchicht} onChange={(e) => setKeramikProSchicht(e.target.value)} />
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Rechte Spalte: Live-Summe */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <SectionCard title="Kalkulation" subtitle={`${zeilen.length + (keramik ? 1 : 0)} Position(en)`}>
            {zeilen.length === 0 && !keramik ? (
              <p className="py-6 text-center text-sm text-chrome-500">
                Noch nichts gewählt – Bauteile im Diagramm oder in der Liste anklicken.
              </p>
            ) : (
              <div className="space-y-1.5">
                {zeilen.map((p) => {
                  const berechneterPreis = berechnet(p.id);
                  const o = override[p.id] ?? '';
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-chrome-200">{p.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={o}
                          placeholder={String(berechneterPreis)}
                          onChange={(e) => setOverride((x) => ({ ...x, [p.id]: e.target.value }))}
                          className="input h-8 w-24 py-0 text-right text-sm tabular-nums"
                          aria-label={`Preis für ${p.label}`}
                        />
                        <span className="text-xs text-chrome-600">€</span>
                      </span>
                    </div>
                  );
                })}
                {keramik && (
                  <div className="flex items-center justify-between gap-2 border-t border-ink-700/50 pt-1.5 text-sm">
                    <span className="text-chrome-200">
                      {KERAMIK_OPTION.label}
                      <span className="ml-1 text-xs text-chrome-500">
                        (1{keramikSchichten > 0 ? `+${keramikSchichten}` : ''} Schicht{keramikSchichten > 0 ? 'en' : ''})
                      </span>
                    </span>
                    <span className="tabular-nums font-medium text-chrome-100">{eur(keramikSumme)}</span>
                  </div>
                )}

                <div className="mt-3 space-y-1 border-t border-ink-700 pt-3 text-sm">
                  <div className="flex items-center justify-between text-chrome-300">
                    <span>Netto</span><span className="tabular-nums">{eur(netto)}</span>
                  </div>
                  <div className="flex items-center justify-between text-chrome-400">
                    <span>MwSt (19 %)</span><span className="tabular-nums">{eur(mwst)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-base font-semibold">
                    <span className="text-chrome-50">Gesamt</span>
                    <span className="tabular-nums text-copper">{eur(brutto)}</span>
                  </div>
                </div>

                <button className="btn-primary mt-3 w-full justify-center" onClick={zusammenfassungKopieren}>
                  {kopiert ? 'Kopiert ✓' : 'Zusammenfassung kopieren'}
                </button>
                <p className="text-xs leading-relaxed text-chrome-500">
                  Richtwerte auf Basis von Fahrzeuggröße{katalog.materialStufen.length ? ' und Materialstufe' : ''} –
                  jede Position kann direkt überschrieben werden.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
