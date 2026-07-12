'use client';

// Material-Rechner (Folie) — Folierer-Welle 2, Baustein 2 (Excel-Ablösung).
//
// Fläche (qm) -> Laufmeter (lfm) bei Rollenbreite + Verschnitt -> Materialkosten
// (EK), VK-Vorschlag und Marge, gespeist aus der Folien-Bibliothek
// (GET /shop/products?kategorie=folie). Reine Rechnung in lib/lfm-rechner.
//
// Flächenquellen: manuelle qm-Eingabe IMMER möglich; optional ein Bauteil-Picker
// (Mehrfachauswahl, Richtwerte je Bauteil × Fahrzeuggröße) als Hilfe zum Füllen
// des qm-Felds. Ergebnis lässt sich in die Zwischenablage kopieren (kein
// Server-State; Übernahme in einen Auftrag geschieht in der Auftrags-Materialkarte).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import type { Product } from '@/lib/types';
import { FAHRZEUG_GROESSEN } from '@/lib/kalkulation-katalog';
import { VEHICLE_PARTS } from '@/lib/vehicle-parts';
import { PART_FLAECHE_QM } from '@/lib/flaechen-preise';
import {
  berechneLfm,
  toNum,
  VERSCHNITT_DEFAULT,
  VERSCHNITT_MIN,
  VERSCHNITT_MAX,
} from '@/lib/lfm-rechner';
import { Loading, Empty, ErrorBox, SectionCard, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

const num = (n: number, digits = 2) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: digits });

/** Sprechendes Label einer Folie: Hersteller/Serie/Farbe/Finish + Breite; sonst Name. */
function folieLabel(p: Product): string {
  const kopf = [p.hersteller, p.serie].filter(Boolean).join(' ').trim();
  const detail = [p.farbcode, p.finish].filter(Boolean).join(' ').trim();
  const basis = [kopf || p.name, detail].filter(Boolean).join(' – ');
  const breite = toNum(p.breiteCm);
  return breite > 0 ? `${basis} (${num(breite, 0)} cm)` : basis;
}

export function FolieMaterialRechner() {
  const t = useT();
  const toast = useToast();

  const [produkte, setProdukte] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gesperrt, setGesperrt] = useState(false); // 403: Shop-/Lager-Modul fehlt

  const [suche, setSuche] = useState('');
  const [folieId, setFolieId] = useState('');
  const [flaeche, setFlaeche] = useState('');
  const [verschnitt, setVerschnitt] = useState(VERSCHNITT_DEFAULT);

  // Bauteil-Picker (optionale Flächenhilfe).
  const [bauteilOffen, setBauteilOffen] = useState(false);
  const [groesse, setGroesse] = useState('mittel');
  const [teile, setTeile] = useState<Set<string>>(new Set());

  useEffect(() => {
    let aktiv = true;
    setLoading(true);
    api
      .get<Product[]>('/shop/products?kategorie=folie')
      .then((r) => {
        if (!aktiv) return;
        setProdukte(r.filter((p) => p.aktiv !== false));
        setError('');
        setGesperrt(false);
      })
      .catch((e) => {
        if (!aktiv) return;
        // 403 = Tarif ohne Shop-/Lager-Modul: sanfter Hinweis statt Crash.
        if (e instanceof ApiError && e.status === 403) setGesperrt(true);
        else setError(e instanceof Error ? e.message : t('kalkulation.material.loadError'));
      })
      .finally(() => {
        if (aktiv) setLoading(false);
      });
    return () => {
      aktiv = false;
    };
  }, [t]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return produkte;
    return produkte.filter((p) =>
      [p.name, p.hersteller, p.serie, p.farbcode, p.finish]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q)),
    );
  }, [produkte, suche]);

  const folie = produkte.find((p) => p.id === folieId);

  const groesseFaktor = FAHRZEUG_GROESSEN.find((g) => g.id === groesse)?.faktor ?? 1;
  const bauteilSumme = useMemo(() => {
    let s = 0;
    for (const id of Array.from(teile)) s += (PART_FLAECHE_QM[id] ?? 0) * groesseFaktor;
    return Math.round(s * 100) / 100;
  }, [teile, groesseFaktor]);

  function toggleTeil(id: string) {
    setTeile((s) => {
      const neu = new Set(s);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  const ergebnis = berechneLfm({
    flaecheQm: toNum(flaeche),
    breiteCm: toNum(folie?.breiteCm),
    verschnittProzent: verschnitt,
    einkaufspreis: toNum(folie?.einkaufspreis),
    verkaufspreis: toNum(folie?.verkaufspreis),
  });

  const bestand = toNum(folie?.bestand);
  const bestandKnapp = !!folie && ergebnis.gueltig && ergebnis.lfmMitVerschnitt > bestand;

  async function kopieren() {
    if (!folie || !ergebnis.gueltig) return;
    const zeilen = [
      t('kalkulation.material.copySummary', { folie: folieLabel(folie) }),
      `${t('kalkulation.material.flaeche.label')}: ${num(toNum(flaeche))} ${t('kalkulation.material.flaeche.unit')} · ${t('kalkulation.material.verschnitt.label')}: ${verschnitt} %`,
      `${t('kalkulation.material.result.lfm')}: ${num(ergebnis.lfmMitVerschnitt)} ${t('kalkulation.material.result.lfmUnit')}`,
      `${t('kalkulation.material.result.ek')}: ${eur(ergebnis.ekKosten)}`,
      `${t('kalkulation.material.result.vk')}: ${eur(ergebnis.vkVorschlag)}`,
      `${t('kalkulation.material.result.marge')}: ${eur(ergebnis.marge)} (${num(ergebnis.margeProzent, 1)} %)`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(zeilen);
      toast(t('kalkulation.material.copied'));
    } catch {
      /* Clipboard evtl. gesperrt */
    }
  }

  if (loading) {
    return (
      <SectionCard title={t('kalkulation.material.title')} subtitle={t('kalkulation.material.subtitle')}>
        <Loading />
      </SectionCard>
    );
  }

  if (gesperrt) {
    return (
      <SectionCard title={t('kalkulation.material.title')} subtitle={t('kalkulation.material.subtitle')}>
        <ErrorBox message={t('kalkulation.material.locked')} />
      </SectionCard>
    );
  }

  if (!error && produkte.length === 0) {
    return (
      <SectionCard title={t('kalkulation.material.title')} subtitle={t('kalkulation.material.subtitle')}>
        <Empty
          text={t('kalkulation.material.empty')}
          action={
            <Link href="/shop" className="btn-subtle btn-sm">
              {t('kalkulation.material.empty.cta')}
            </Link>
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Eingaben */}
      <div className="space-y-5">
        <SectionCard title={t('kalkulation.material.title')} subtitle={t('kalkulation.material.subtitle')}>
          {error && <ErrorBox message={error} className="mb-4" />}

          {/* Folie wählen */}
          <div className="field">
            <label className="label" htmlFor="folie-suche">{t('kalkulation.material.folie.label')}</label>
            <input
              id="folie-suche"
              type="search"
              className="input mb-2"
              placeholder={t('kalkulation.material.folie.search')}
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            <select
              className="select"
              value={folieId}
              onChange={(e) => setFolieId(e.target.value)}
              aria-label={t('kalkulation.material.folie.label')}
            >
              <option value="">{t('kalkulation.material.folie.choose')}</option>
              {gefiltert.map((p) => (
                <option key={p.id} value={p.id}>{folieLabel(p)}</option>
              ))}
            </select>
            {suche.trim() && gefiltert.length === 0 && (
              <p className="help">{t('kalkulation.material.folie.none')}</p>
            )}
          </div>

          {/* Fläche */}
          <div className="field mt-4">
            <label className="label" htmlFor="folie-flaeche">{t('kalkulation.material.flaeche.label')}</label>
            <div className="flex items-center gap-2">
              <input
                id="folie-flaeche"
                type="number"
                min="0"
                step="0.1"
                className="input"
                value={flaeche}
                onChange={(e) => setFlaeche(e.target.value)}
              />
              <span className="shrink-0 text-sm text-chrome-500">{t('kalkulation.material.flaeche.unit')}</span>
            </div>
            <p className="help">{t('kalkulation.material.flaeche.help')}</p>
          </div>

          {/* Bauteil-Picker (optional) */}
          <div className="mt-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              aria-expanded={bauteilOffen}
              onClick={() => setBauteilOffen((v) => !v)}
            >
              {bauteilOffen ? '▾ ' : '▸ '}{t('kalkulation.material.bauteil.toggle')}
            </button>
            {bauteilOffen && (
              <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-850/40 p-4 animate-fade-in">
                <div className="field">
                  <label className="label" htmlFor="folie-groesse">{t('kalkulation.field.groesse')}</label>
                  <select id="folie-groesse" className="select" value={groesse} onChange={(e) => setGroesse(e.target.value)}>
                    {FAHRZEUG_GROESSEN.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}{g.faktor !== 1 ? ` (×${g.faktor})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {VEHICLE_PARTS.filter((p) => PART_FLAECHE_QM[p.id]).map((p) => {
                    const aktiv = teile.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={aktiv}
                        onClick={() => toggleTeil(p.id)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          aktiv
                            ? 'border-copper/50 bg-copper-soft text-chrome-50'
                            : 'border-ink-700 text-chrome-300 hover:bg-ink-800/60 hover:text-chrome-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-chrome-300">
                    {t('kalkulation.material.bauteil.sum', { qm: num(bauteilSumme) })}
                  </span>
                  <button
                    type="button"
                    className="btn-subtle btn-sm"
                    disabled={bauteilSumme <= 0}
                    onClick={() => setFlaeche(String(bauteilSumme))}
                  >
                    {t('kalkulation.material.bauteil.apply')}
                  </button>
                  {teile.size > 0 && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setTeile(new Set())}>
                      {t('kalkulation.material.bauteil.clear')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Verschnitt */}
          <div className="field mt-4">
            <label className="label" htmlFor="folie-verschnitt">
              {t('kalkulation.material.verschnitt.label')}: <span className="tabular-nums text-copper">{verschnitt} %</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                id="folie-verschnitt"
                type="range"
                min={VERSCHNITT_MIN}
                max={VERSCHNITT_MAX}
                step="1"
                value={verschnitt}
                onChange={(e) => setVerschnitt(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-copper"
              />
              <input
                type="number"
                min={VERSCHNITT_MIN}
                max={VERSCHNITT_MAX}
                step="1"
                value={verschnitt}
                onChange={(e) =>
                  setVerschnitt(Math.min(VERSCHNITT_MAX, Math.max(VERSCHNITT_MIN, Number(e.target.value) || 0)))
                }
                className="input h-9 w-20 py-0 text-right text-sm tabular-nums"
                aria-label={t('kalkulation.material.verschnitt.label')}
              />
            </div>
            <p className="help">{t('kalkulation.material.verschnitt.help')}</p>
          </div>
        </SectionCard>
      </div>

      {/* Ergebnis */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <SectionCard title={t('kalkulation.material.result.title')}>
          {!folie || !ergebnis.gueltig ? (
            <p className="py-6 text-center text-sm text-chrome-500">
              {t('kalkulation.material.result.empty')}
            </p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-chrome-400">
                <span>{t('kalkulation.material.result.bahn')}</span>
                <span className="tabular-nums">{num(ergebnis.bahnenBreiteM)} m</span>
              </div>
              <div className="flex items-center justify-between text-chrome-400">
                <span>{t('kalkulation.material.result.lfmRoh')}</span>
                <span className="tabular-nums">{num(ergebnis.lfmRoh)} {t('kalkulation.material.result.lfmUnit')}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ink-700/50 pt-2 text-base font-semibold">
                <span className="text-chrome-50">{t('kalkulation.material.result.lfm')}</span>
                <span className="tabular-nums text-copper">
                  {num(ergebnis.lfmMitVerschnitt)} {t('kalkulation.material.result.lfmUnit')}
                </span>
              </div>

              {bestandKnapp && (
                <ErrorBox
                  message={t('kalkulation.material.result.bestandWarn', { bestand: num(bestand) })}
                  className="!py-2"
                />
              )}

              <div className="mt-2 space-y-1.5 border-t border-ink-700 pt-3">
                <div className="flex items-center justify-between text-chrome-300">
                  <span>{t('kalkulation.material.result.ek')}</span>
                  <span className="tabular-nums">{eur(ergebnis.ekKosten)}</span>
                </div>
                <div className="flex items-center justify-between text-chrome-300">
                  <span>{t('kalkulation.material.result.vk')}</span>
                  <span className="tabular-nums">{eur(ergebnis.vkVorschlag)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 font-semibold">
                  <span className="text-chrome-50">{t('kalkulation.material.result.marge')}</span>
                  <span className="tabular-nums text-chrome-50">
                    {eur(ergebnis.marge)}
                    <span className="ml-1 text-xs font-normal text-chrome-500">({num(ergebnis.margeProzent, 1)} %)</span>
                  </span>
                </div>
              </div>

              <button className="btn-primary mt-3 w-full justify-center" onClick={kopieren}>
                {t('kalkulation.material.copy')}
              </button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
