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
import { useRouter } from 'next/navigation';
import { api, appPath } from '@/lib/api';
import { buildUebernahmePayload, UEBERNAHME_STORAGE_KEY } from '@/lib/kalkulation-uebernahme';
import { eur } from '@/lib/format';
import { toNum } from '@/lib/lfm-rechner';
import type { ServiceItem } from '@/lib/types';
import type { Betriebstyp } from '@/lib/branche';
import { BETRIEBSTYP_LABEL_KEY } from '@/lib/branche';
import {
  FAHRZEUG_GROESSEN,
  KATALOGE,
  KATALOG_REIHENFOLGE,
  KERAMIK_OPTION,
  type KalkKatalog,
} from '@/lib/kalkulation-katalog';
import { PageHeader, SectionCard, useToast } from '@/components/ui';
import { FolieMaterialRechner } from '@/components/FolieMaterialRechner';
import { useT } from '@/lib/i18n';
import { useSteuer, useHasFeature } from '@/lib/entitlements';

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
  const t = useT();
  const posByZone = useMemo(() => {
    const m = new Map<string, { id: string; label: string }>();
    for (const p of katalog.positionen) if (p.zone) m.set(p.zone, p);
    return m;
  }, [katalog]);

  return (
    <svg viewBox="0 0 100 100" className="mx-auto w-full max-w-[260px]" role="group" aria-label={t('kalkulation.diagram.aria')}>
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

  // Modus: Leistungs-Kalkulation (Standard) vs. Folien-Material-Rechner. Der
  // Material-Rechner ist nur für Folierer sinnvoll (Folie/PPF/Komplett).
  const [modus, setModus] = useState<'leistung' | 'material'>('leistung');

  // Auswahl + Anpassungen (je Katalog frisch).
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [override, setOverride] = useState<Record<string, string>>({});
  const [groesse, setGroesse] = useState('mittel');
  const [material, setMaterial] = useState('standard');

  // Eigener Leistungskatalog (services) als zusätzliche Kalkulations-Positionen mit
  // den ECHTEN Betriebspreisen ("dein Preis", überschreibbar) – im Gegensatz zu den
  // Katalog-Basispreisen (Richtwert). Bewusst KEINE Auto-Zuordnung Katalogzeile↔
  // Leistung (dafür gibt es keinen stabilen Schlüssel), sondern additives Hinzufügen.
  const [eigeneKatalog, setEigeneKatalog] = useState<ServiceItem[] | null>(null);
  const [eigene, setEigene] = useState<{ key: string; name: string; einheit: string; preis: string }[]>([]);

  // Keramik-Option (innerhalb der Kalkulation, alle Typen).
  const [keramik, setKeramik] = useState(false);
  const [keramikBasis, setKeramikBasis] = useState(String(KERAMIK_OPTION.basispreis));
  const [keramikSchichten, setKeramikSchichten] = useState(0); // ZUSAETZLICHE Schichten
  const [keramikProSchicht, setKeramikProSchicht] = useState(String(KERAMIK_OPTION.preisProWeitereSchicht));

  const t = useT();
  const toast = useToast();
  const router = useRouter();
  // Kurzer Uebergabe-Zustand (Kalk -> Auftrag): der Button zeigt bis zur
  // Navigation einen Spinner statt tot dazustehen.
  const [uebernahmeBusy, setUebernahmeBusy] = useState(false);
  // §19 UStG: Kleinunternehmer rechnen ohne MwSt (0 %); sonst gilt der
  // Standard-Satz des Betriebs (Vorwahl neuer Belege, i. d. R. 19 %).
  const { kleinunternehmer, standardMwstSatz } = useSteuer();
  const mwstProzent = kleinunternehmer ? 0 : standardMwstSatz;

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

  // Eigenen Leistungskatalog laden (tenant-scoped über die API). Fehlt der
  // Zugriff / gibt es keine Leistungen, bleibt der Bereich einfach leer (kein
  // Crash) und die Kalkulation läuft mit den Katalog-Richtwerten weiter.
  useEffect(() => {
    api
      .get<ServiceItem[]>('/services')
      .then(setEigeneKatalog)
      .catch(() => setEigeneKatalog([]));
  }, []);

  const katalog = KATALOGE[katalogTyp];
  const groesseFaktor = FAHRZEUG_GROESSEN.find((g) => g.id === groesse)?.faktor ?? 1;
  const materialFaktor = katalog.materialStufen.find((m) => m.id === material)?.faktor ?? 1;

  function wechsleKatalog(typ: (typeof KATALOG_REIHENFOLGE)[number]) {
    setKatalogTyp(typ);
    setGewaehlt(new Set());
    setOverride({});
    setEigene([]);
    setMaterial('standard');
  }

  // Eigene Leistungen des aktiven Gewerks (plus 'sonstiges' als Quer-Kategorie).
  const eigeneVerfuegbar = useMemo(
    () =>
      (eigeneKatalog ?? []).filter(
        (s) => s.aktiv !== false && (s.kategorie === katalogTyp || s.kategorie === 'sonstiges'),
      ),
    [eigeneKatalog, katalogTyp],
  );

  const EIGENE_EINHEIT_KEY: Record<string, string> = {
    qm: 'kalkulation.eigene.unit.qm',
    stunde: 'kalkulation.eigene.unit.stunde',
  };

  function addEigene(s: ServiceItem) {
    setEigene((cur) =>
      cur.some((e) => e.key === s.id)
        ? cur
        : [...cur, { key: s.id, name: s.name, einheit: s.einheit, preis: String(toNum(s.basispreis)) }],
    );
  }
  function setEigenePreis(key: string, preis: string) {
    setEigene((cur) => cur.map((e) => (e.key === key ? { ...e, preis } : e)));
  }
  function removeEigene(key: string) {
    setEigene((cur) => cur.filter((e) => e.key !== key));
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
  const eigenePreis = (e: { preis: string }) => Math.max(0, Number(e.preis) || 0);
  const eigeneSumme = rund2(eigene.reduce((s, e) => s + eigenePreis(e), 0));
  const netto = rund2(zeilen.reduce((s, p) => s + zeilenPreis(p.id), 0) + keramikSumme + eigeneSumme);
  const mwst = rund2(netto * (mwstProzent / 100));
  const brutto = rund2(netto + mwst);

  async function zusammenfassungKopieren() {
    const g = FAHRZEUG_GROESSEN.find((x) => x.id === groesse)?.label ?? '';
    const m = katalog.materialStufen.find((x) => x.id === material)?.label;
    const teile = zeilen.map((p) => `- ${p.label}${p.hinweis ? ` (${p.hinweis})` : ''}: ${eur(zeilenPreis(p.id))}`);
    if (keramik) {
      const schichtWort = keramikSchichten
        ? t('kalkulation.keramik.layerPlural')
        : t('kalkulation.keramik.layerSingular');
      teile.push(
        `- ${KERAMIK_OPTION.label} (1${keramikSchichten ? `+${keramikSchichten}` : ''} ${schichtWort}): ${eur(keramikSumme)}`,
      );
    }
    for (const e of eigene) teile.push(`- ${e.name}: ${eur(eigenePreis(e))}`);
    const text = [
      t('kalkulation.summaryHeadline', { titel: katalog.titel, rahmen: `${g}${m ? `, ${m}` : ''}` }),
      ...teile,
      // §19: Netto/MwSt weglassen, Preis ist Endpreis (Hinweiszeile ergaenzen).
      ...(kleinunternehmer
        ? []
        : [`${t('kalkulation.netto')}: ${eur(netto)}`, `${t('kalkulation.mwst')}: ${eur(mwst)}`]),
      `${t('kalkulation.gesamt')}: ${eur(brutto)}`,
      ...(kleinunternehmer ? [t('kalkulation.kleinunternehmerNote')] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast(t('kalkulation.toast.copied'));
    } catch {
      /* Clipboard evtl. gesperrt */
    }
  }

  /**
   * Uebernimmt die aktuell angezeigte Kalkulation als Auftrag: baut die Positionen
   * EXAKT aus den kalkulierten Zeilen (Beschreibung + effektiver Zeilenpreis, Menge 1;
   * Keramik als eigene Position) und den ServiceType aus dem aktiven Katalog. Die
   * Nutzdaten reisen ueber sessionStorage; die Auftrags-Seite oeffnet daraufhin den
   * Anlage-Flow vorbefuellt (?uebernahme=1). Per Konstruktion gilt: Σ Einzelpreise
   * === Kalkulations-Netto.
   */
  function alsAuftragUebernehmen() {
    const zeilenPositionen = zeilen.map((p) => ({
      beschreibung: `${p.label}${p.hinweis ? ` (${p.hinweis})` : ''}`,
      einzelpreis: zeilenPreis(p.id),
    }));
    let keramikPos: { beschreibung: string; einzelpreis: number } | null = null;
    if (keramik) {
      const schichtWort = keramikSchichten
        ? t('kalkulation.keramik.layerPlural')
        : t('kalkulation.keramik.layerSingular');
      keramikPos = {
        beschreibung: `${KERAMIK_OPTION.label} (1${keramikSchichten ? `+${keramikSchichten}` : ''} ${schichtWort})`,
        einzelpreis: keramikSumme,
      };
    }
    // Eigene Leistungen (dein Preis) reisen als vollwertige Positionen mit.
    const eigenePositionen = eigene.map((e) => ({ beschreibung: e.name, einzelpreis: eigenePreis(e) }));
    const payload = buildUebernahmePayload({
      serviceType: katalogTyp,
      zeilen: [...zeilenPositionen, ...eigenePositionen],
      keramik: keramikPos,
    });
    setUebernahmeBusy(true);
    try {
      sessionStorage.setItem(UEBERNAHME_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* Speicher gesperrt: die Uebernahme kann dann nicht vorbefuellen (Fallback: Kopieren). */
    }
    router.push(`${appPath('/auftraege')}?uebernahme=1`);
  }

  const hatDiagramm = katalog.positionen.some((p) => p.zone);

  // Material-Rechner nur für Folierer anbieten (Folie/PPF/Komplett) UND nur mit
  // gebuchtem à-la-carte Add-on 'folierung_ppf' (4,99 €/Monat). Reine Aufbereiter
  // ODER Folierer ohne Add-on (nach dem Test) sehen die Leistungs-Kalkulation
  // unverändert – nur der Folien-Material-Umschalter entfällt. Trial: features==null -> frei.
  const hasFeature = useHasFeature();
  const materialGewerk = betriebstyp === 'folierung' || betriebstyp === 'ppf' || betriebstyp === 'komplett';
  const materialVerfuegbar = materialGewerk && hasFeature('folierung_ppf');
  const effektiverModus = materialVerfuegbar ? modus : 'leistung';

  return (
    <div>
      <PageHeader
        title={t('kalkulation.title')}
        subtitle={t('kalkulation.subtitle')}
        icon={<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2" /></>}
      />

      {/* Modus-Umschalter (nur für Folierer): Leistungen vs. Folien-Material. */}
      {materialVerfuegbar && (
        <div className="seg-group mb-5">
          <button
            onClick={() => setModus('leistung')}
            className={`seg ${effektiverModus === 'leistung' ? 'seg-active' : ''}`}
          >
            {t('kalkulation.mode.leistung')}
          </button>
          <button
            onClick={() => setModus('material')}
            className={`seg ${effektiverModus === 'material' ? 'seg-active' : ''}`}
          >
            {t('kalkulation.mode.material')}
          </button>
        </div>
      )}

      {effektiverModus === 'material' && <FolieMaterialRechner />}

      {effektiverModus === 'leistung' && (
      <>
      {/* Katalog-Tabs: nur fuer Komplett-Anbieter; sonst ist der Typ fix. */}
      {betriebstyp === 'komplett' && (
        <div className="seg-group mb-5">
          {KATALOG_REIHENFOLGE.map((kt) => (
            <button
              key={kt}
              onClick={() => wechsleKatalog(kt)}
              className={`seg ${
                katalogTyp === kt ? 'seg-active' : ''
              }`}
            >
              {KATALOGE[kt].titel}
            </button>
          ))}
        </div>
      )}
      {betriebstyp !== 'komplett' && (
        <p className="mb-5 text-sm text-chrome-500">
          {t('kalkulation.katalog.prefix')}{' '}
          <span className="font-medium text-copper">{t(BETRIEBSTYP_LABEL_KEY[betriebstyp].label)}</span>
          {' '}{t('kalkulation.katalog.suffix')}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Linke Spalte: Auswahl */}
        <div className="space-y-5">
          {/* Rahmenparameter */}
          <SectionCard title={t('kalkulation.section.fahrzeugMaterial')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label className="label" htmlFor="kalk-groesse">{t('kalkulation.field.groesse')}</label>
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
                <span className="label mb-1.5 block">{t('kalkulation.field.schnellauswahl')}</span>
                <div className="flex flex-wrap gap-2">
                  {katalog.pakete.map((paket) => (
                    <button key={paket.label} className="btn-subtle btn-sm" onClick={() => paketWaehlen(paket.ids)}>
                      + {paket.label}
                    </button>
                  ))}
                  {gewaehlt.size > 0 && (
                    <button className="btn-ghost btn-sm" onClick={() => { setGewaehlt(new Set()); setOverride({}); }}>
                      {t('kalkulation.clearSelection')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Bauteil-/Leistungsauswahl */}
          <SectionCard title={katalog.gruppenLabel} subtitle={t('kalkulation.section.auswahlSubtitle')}>
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
              <span className="text-sm text-chrome-200">{t('kalkulation.keramik.add')}</span>
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
                  <label className="label" htmlFor="keramik-basis">{t('kalkulation.keramik.basis')}</label>
                  <input id="keramik-basis" type="number" min="0" step="1" className="input" value={keramikBasis} onChange={(e) => setKeramikBasis(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="keramik-schichten">{t('kalkulation.keramik.weitereSchichten')}</label>
                  <select id="keramik-schichten" className="input" value={keramikSchichten} onChange={(e) => setKeramikSchichten(Number(e.target.value))}>
                    {Array.from({ length: KERAMIK_OPTION.maxWeitereSchichten + 1 }, (_, i) => (
                      <option key={i} value={i}>{i === 0 ? t('kalkulation.keramik.none') : `+${i}`}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="keramik-pro">{t('kalkulation.keramik.proSchicht')}</label>
                  <input id="keramik-pro" type="number" min="0" step="1" className="input" value={keramikProSchicht} onChange={(e) => setKeramikProSchicht(e.target.value)} />
                </div>
              </div>
            )}
          </SectionCard>

          {/* Aus deinem Leistungskatalog: eigene Leistungen mit ECHTEN Betriebs-
              preisen ("dein Preis") ergaenzen – nur sichtbar, wenn welche passen. */}
          {eigeneVerfuegbar.length > 0 && (
            <SectionCard title={t('kalkulation.eigene.title')} subtitle={t('kalkulation.eigene.subtitle')}>
              <div className="flex flex-wrap gap-1.5">
                {eigeneVerfuegbar.map((s) => {
                  const drin = eigene.some((e) => e.key === s.id);
                  const suffix = EIGENE_EINHEIT_KEY[s.einheit] ? t(EIGENE_EINHEIT_KEY[s.einheit]) : '';
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={drin}
                      aria-label={t('kalkulation.eigene.add', { name: s.name })}
                      disabled={drin}
                      onClick={() => addEigene(s)}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                        drin
                          ? 'cursor-default border-copper/50 bg-copper-soft text-chrome-100'
                          : 'border-ink-700 text-chrome-300 hover:bg-ink-800/60 hover:text-chrome-100'
                      }`}
                    >
                      + {s.name} <span className="text-chrome-500">· {eur(toNum(s.basispreis))}{suffix}</span>
                    </button>
                  );
                })}
              </div>
              <p className="help mt-3">{t('kalkulation.eigene.hint')}</p>
            </SectionCard>
          )}
        </div>

        {/* Rechte Spalte: Live-Summe */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <SectionCard title={t('kalkulation.title')} subtitle={t('kalkulation.positionCount', { count: zeilen.length + (keramik ? 1 : 0) + eigene.length })}>
            {zeilen.length === 0 && !keramik && eigene.length === 0 ? (
              <p className="py-6 text-center text-sm text-chrome-500">
                {t('kalkulation.empty')}
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
                          aria-label={t('kalkulation.priceAria', { label: p.label })}
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
                        (1{keramikSchichten > 0 ? `+${keramikSchichten}` : ''} {keramikSchichten > 0 ? t('kalkulation.keramik.layerPlural') : t('kalkulation.keramik.layerSingular')})
                      </span>
                    </span>
                    <span className="tabular-nums font-medium text-chrome-100">{eur(keramikSumme)}</span>
                  </div>
                )}

                {/* Eigene Leistungen (dein Preis, überschreibbar). */}
                {eigene.map((e) => (
                  <div key={e.key} className="flex items-center justify-between gap-2 border-t border-ink-700/50 pt-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-chrome-200">{e.name}</span>
                      <span className="shrink-0 rounded bg-copper-soft px-1.5 py-0.5 text-[10px] font-medium text-copper">
                        {t('kalkulation.eigene.deinPreis')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={e.preis}
                        onChange={(ev) => setEigenePreis(e.key, ev.target.value)}
                        className="input h-8 w-24 py-0 text-right text-sm tabular-nums"
                        aria-label={t('kalkulation.eigene.priceAria', { label: e.name })}
                      />
                      <button
                        type="button"
                        className="text-chrome-600 transition-colors hover:text-danger"
                        aria-label={t('kalkulation.eigene.remove')}
                        onClick={() => removeEigene(e.key)}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </span>
                  </div>
                ))}

                <div className="mt-3 space-y-1 border-t border-ink-700 pt-3 text-sm">
                  {/* §19: Netto-/MwSt-Zeile ausblenden, Preis ist Endpreis. */}
                  {!kleinunternehmer && (
                    <>
                      <div className="flex items-center justify-between text-chrome-300">
                        <span>{t('kalkulation.netto')}</span><span className="tabular-nums">{eur(netto)}</span>
                      </div>
                      <div className="flex items-center justify-between text-chrome-400">
                        <span>{t('kalkulation.mwst')}</span><span className="tabular-nums">{eur(mwst)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between pt-1 text-base font-semibold">
                    <span className="text-chrome-50">{t('kalkulation.gesamt')}</span>
                    <span className="tabular-nums text-copper">{eur(brutto)}</span>
                  </div>
                  {kleinunternehmer && (
                    <p className="pt-1 text-xs text-chrome-500">{t('kalkulation.kleinunternehmerNote')}</p>
                  )}
                </div>

                <button
                  className="btn-primary mt-3 w-full justify-center"
                  onClick={alsAuftragUebernehmen}
                  disabled={uebernahmeBusy}
                >
                  {uebernahmeBusy ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                      </svg>
                      {t('kalkulation.uebernahme.busy')}
                    </>
                  ) : (
                    t('kalkulation.uebernahme.auftrag')
                  )}
                </button>
                <button className="btn-subtle mt-2 w-full justify-center" onClick={zusammenfassungKopieren}>
                  {t('kalkulation.copyButton')}
                </button>
                <p className="text-xs leading-relaxed text-chrome-500">
                  {t('kalkulation.hint.base', { material: katalog.materialStufen.length ? t('kalkulation.hint.materialSuffix') : '' })}
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
