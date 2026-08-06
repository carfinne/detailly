'use client';

// Geraete-Gebrauchtmarkt · Browse (cross-tenant, paginiert, kontaktfrei).
// Werkstaetten stoebern in gebrauchter Ausruestung anderer verifizierter
// Betriebe. Filter (Kategorie/Zustand/Region) + Sortierung laufen SERVERSEITIG
// ueber den paginierten Endpunkt GET /geraetemarkt.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import { PageHeader, ErrorBox, Empty } from '@/components/ui';
import { Pager } from '@/components/Pager';
import AuthedImage from '@/components/AuthedImage';
import { Icon, ICON_PATHS } from '@/lib/icons';
import {
  ART_BADGE,
  ART_KEY,
  BROWSE_LIMIT,
  BROWSE_SORT,
  GERAETE_KATEGORIEN,
  HILFE_KATEGORIEN,
  INSERAT_ART,
  INSERAT_ZUSTAND,
  KATEGORIE_KEY,
  UMKREIS_KEY,
  UMKREIS_STUFEN_KM,
  ZUSTAND_BADGE,
  ZUSTAND_KEY,
  bildStreamPath,
  primaerBild,
  regionText,
  type BrowseResult,
  type BrowseSort,
  type InseratPublicView,
} from '@/lib/geraetemarkt';

/** Preis-Anzeige je Modus (fest / VB / auf Anfrage). */
function preisText(inserat: InseratPublicView, t: (k: string) => string): React.ReactNode {
  if (inserat.preisModus === 'anfrage' || inserat.preis == null) {
    return <span className="font-normal text-chrome-400">{t('geraetemarkt.preisModus.anfrage')}</span>;
  }
  return (
    <>
      {eur(inserat.preis)}
      {inserat.preisModus === 'vb' && (
        <span className="ml-1 text-xs font-normal text-chrome-400">{t('geraetemarkt.preisModus.vbShort')}</span>
      )}
    </>
  );
}

/** Karten-Bild: Primaerbild via auth Stream, sonst edler Gradient-Fallback. */
function KartenBild({ inserat }: { inserat: InseratPublicView }) {
  const bild = primaerBild(inserat);
  if (!bild) {
    return (
      <div className="grid h-full w-full place-items-center bg-copper-grad">
        <Icon className="h-10 w-10 text-ink-950/60">{ICON_PATHS.box}</Icon>
      </div>
    );
  }
  return (
    <AuthedImage
      path={bildStreamPath(inserat.id, bild.id)}
      alt={inserat.titel}
      className="h-full w-full object-cover transition-transform duration-220 ease-emphasized group-hover:scale-[1.04]"
    />
  );
}

/** Statisches Vertrauens-Siegel: alle Inserate stammen von verifizierten Betrieben. */
function GewerblichBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-copper/30 bg-copper-soft px-2 py-0.5 text-[10px] font-semibold text-copper">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      {t('geraetemarkt.badge.verified')}
    </span>
  );
}

export default function GeraetemarktBrowsePage() {
  const t = useT();
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [art, setArt] = useState(''); // '' = alle, sonst 'angebot' | 'gesuch'
  const [kategorie, setKategorie] = useState('');
  const [zustand, setZustand] = useState('');
  const [region, setRegion] = useState('');
  const [umkreis, setUmkreis] = useState(''); // '' = ueberall, sonst '0'|'50'|'100'|'200'
  const [sort, setSort] = useState<BrowseSort>('neu');
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Region-Eingabe entprellen (nur 2 Ziffern; Backend verlangt genau 2-stellig).
  const [regionRaw, setRegionRaw] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setRegion(regionRaw.replace(/\D/g, '').slice(0, 2)), 350);
    return () => clearTimeout(id);
  }, [regionRaw]);

  // Filterwechsel -> zurueck auf Seite 1.
  useEffect(() => {
    setPage(1);
  }, [art, kategorie, zustand, region, umkreis, sort]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(BROWSE_LIMIT));
    if (art) p.set('art', art);
    if (kategorie) p.set('kategorie', kategorie);
    if (zustand) p.set('zustand', zustand);
    if (region.length === 2) {
      p.set('plzRegion', region);
      // umkreisKm wirkt nur mit Zentrums-Region; '' = ueberall (kein Umkreis-Param).
      if (umkreis !== '') p.set('umkreisKm', umkreis);
    }
    if (sort) p.set('sort', sort);
    return p.toString();
  }, [page, art, kategorie, zustand, region, umkreis, sort]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get<BrowseResult>(`/geraetemarkt?${query}`)
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : t('geraetemarkt.error.load')))
      .finally(() => setLoading(false));
  }, [query, t]);

  useEffect(() => {
    load();
  }, [load]);

  const inserate = result?.data ?? [];
  const hatFilter =
    !!art || !!kategorie || !!zustand || region.length === 2 || !!umkreis || sort !== 'neu';

  function filterZuruecksetzen() {
    setArt('');
    setKategorie('');
    setZustand('');
    setRegion('');
    setRegionRaw('');
    setUmkreis('');
    setSort('neu');
  }

  return (
    <div>
      <PageHeader
        title={t('geraetemarkt.title')}
        subtitle={t('geraetemarkt.subtitle')}
        action={
          istLeitung && (
            <div className="flex items-center gap-2">
              <Link href="/geraetemarkt/meine" className="btn-subtle btn-sm">
                {t('geraetemarkt.myListings')}
              </Link>
              <Link href="/geraetemarkt/bearbeiten" className="btn-primary btn-sm">
                {t('geraetemarkt.newListing')}
              </Link>
            </div>
          )
        }
      />

      {/* Sticky Filterleiste: Richtung + Kategorien (Geraete/Hilfe) + Standort/Sortierung. */}
      <div className="sticky top-14 z-20 -mx-5 mb-5 border-b border-ink-700/60 bg-ink-900/90 px-5 pb-4 pt-3 backdrop-blur-md md:-mx-7 md:px-7">
        {/* Richtung: Angebot vs. Gesuch – primaerer Filter der Nachbarschaftshilfe. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="kpi-label">{t('geraetemarkt.filter.art')}</span>
          <button
            onClick={() => setArt('')}
            className={`choice rounded-full px-3.5 py-1.5 text-xs font-semibold ${art === '' ? 'choice-active' : ''}`}
          >
            {t('geraetemarkt.filter.artAll')}
          </button>
          {INSERAT_ART.map((a) => (
            <button
              key={a}
              onClick={() => setArt(art === a ? '' : a)}
              className={`choice rounded-full px-3.5 py-1.5 text-xs font-semibold ${art === a ? 'choice-active' : ''}`}
            >
              {t(ART_KEY[a])}
            </button>
          ))}
        </div>

        {/* Kategorien: ein gemeinsames Brett, aber sichtbar in Geraete + Hilfe gruppiert. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setKategorie('')}
            className={`choice rounded-xl px-3.5 py-2 text-sm font-semibold ${kategorie === '' ? 'choice-active' : ''}`}
          >
            {t('geraetemarkt.filter.allCategories')}
          </button>
          {GERAETE_KATEGORIEN.map((k) => (
            <button
              key={k}
              onClick={() => setKategorie(kategorie === k ? '' : k)}
              className={`choice rounded-xl px-3.5 py-2 text-sm font-semibold ${kategorie === k ? 'choice-active' : ''}`}
            >
              {t(KATEGORIE_KEY[k])}
            </button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-ink-700/70 sm:block" aria-hidden="true" />
          <span className="kpi-label w-full sm:w-auto">{t('geraetemarkt.filter.hilfeGroup')}</span>
          {HILFE_KATEGORIEN.map((k) => (
            <button
              key={k}
              onClick={() => setKategorie(kategorie === k ? '' : k)}
              className={`choice rounded-xl px-3.5 py-2 text-sm font-semibold ${kategorie === k ? 'choice-active' : ''}`}
            >
              {t(KATEGORIE_KEY[k])}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Zustand */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="kpi-label">{t('geraetemarkt.filter.condition')}</span>
            <button
              onClick={() => setZustand('')}
              className={`choice rounded-full px-3 py-1 text-xs font-medium ${zustand === '' ? 'choice-active' : ''}`}
            >
              {t('geraetemarkt.filter.any')}
            </button>
            {INSERAT_ZUSTAND.map((z) => (
              <button
                key={z}
                onClick={() => setZustand(zustand === z ? '' : z)}
                className={`choice rounded-full px-3 py-1 text-xs font-medium ${zustand === z ? 'choice-active' : ''}`}
              >
                {t(ZUSTAND_KEY[z])}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {/* Region (2-stellige PLZ) */}
            <label className="flex items-center gap-2 text-sm text-chrome-400">
              <span className="whitespace-nowrap">{t('geraetemarkt.filter.region')}</span>
              <input
                className="input w-20"
                inputMode="numeric"
                maxLength={2}
                placeholder={t('geraetemarkt.filter.regionPlaceholder')}
                value={regionRaw}
                onChange={(e) => setRegionRaw(e.target.value)}
                aria-label={t('geraetemarkt.filter.regionAria')}
              />
            </label>
            {/* Umkreis (grob, Regionsebene) – nur sinnvoll mit gesetzter Region. */}
            <label className="flex items-center gap-2 text-sm text-chrome-400">
              <span className="whitespace-nowrap">{t('geraetemarkt.filter.umkreis')}</span>
              <select
                className="select"
                value={umkreis}
                disabled={region.length !== 2}
                onChange={(e) => setUmkreis(e.target.value)}
                title={t('geraetemarkt.filter.umkreisHint')}
                aria-label={t('geraetemarkt.filter.umkreis')}
              >
                <option value="">{t('geraetemarkt.umkreis.ueberall')}</option>
                {UMKREIS_STUFEN_KM.map((km) => (
                  <option key={km} value={String(km)}>
                    {t(UMKREIS_KEY[String(km)])}
                  </option>
                ))}
              </select>
            </label>
            {/* Sortierung */}
            <label className="flex items-center gap-2 text-sm text-chrome-400">
              <span className="whitespace-nowrap">{t('geraetemarkt.sort.label')}</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as BrowseSort)}>
                {BROWSE_SORT.map((s) => (
                  <option key={s} value={s}>
                    {t(`geraetemarkt.sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Ehrliche Beschriftung: der Umkreis ist ungefaehr, auf Regionsebene. */}
        {region.length === 2 && umkreis !== '' && umkreis !== '0' && (
          <p className="mt-2 text-xs text-chrome-500">{t('geraetemarkt.filter.umkreisHint')}</p>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <BrowseSkeleton />
      ) : inserate.length === 0 ? (
        <div className="card">
          <Empty
            text={hatFilter ? t('geraetemarkt.empty.filtered') : t('geraetemarkt.empty.none')}
            action={
              hatFilter && (
                <button className="btn-subtle btn-sm" onClick={filterZuruecksetzen}>
                  {t('geraetemarkt.resetFilter')}
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-chrome-500">
            {t('geraetemarkt.resultCount', { count: result?.total ?? inserate.length })}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inserate.map((inserat) => (
              <Link
                key={inserat.id}
                href={`/geraetemarkt/inserat/?id=${inserat.id}`}
                className="group card-flush flex flex-col overflow-hidden transition-transform duration-180 ease-emphasized hover:-translate-y-0.5"
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b border-ink-700/50">
                  <KartenBild inserat={inserat} />
                  <span className="absolute left-2 top-2 rounded-md bg-ink-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chrome-100 backdrop-blur-sm">
                    {t(KATEGORIE_KEY[inserat.kategorie] ?? inserat.kategorie)}
                  </span>
                  {inserat.status === 'reserviert' && (
                    <span className="absolute right-2 top-2 rounded-md bg-caution/90 px-2 py-0.5 text-[10px] font-semibold text-ink-950">
                      {t('geraetemarkt.status.reserviert')}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ART_BADGE[inserat.art ?? 'angebot'] ?? 'badge-info'}`}
                    >
                      {t(ART_KEY[inserat.art ?? 'angebot'] ?? 'geraetemarkt.art.angebot')}
                    </span>
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ZUSTAND_BADGE[inserat.zustand] ?? 'badge-neutral'}`}
                    >
                      {t(ZUSTAND_KEY[inserat.zustand] ?? inserat.zustand)}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50">{inserat.titel}</h3>
                  {regionText(inserat) && (
                    <p className="text-xs text-chrome-500">{regionText(inserat)}</p>
                  )}
                  <p className="mt-auto pt-2 text-sm font-semibold text-chrome-100">{preisText(inserat, t)}</p>
                  <div className="pt-1.5">
                    <GewerblichBadge />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {result && (
            <Pager page={result.page} total={result.total} limit={result.limit} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

/** Animiertes Lade-Skeleton, das das spaetere Karten-Raster spiegelt. */
function BrowseSkeleton() {
  return (
    <div className="animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card-flush overflow-hidden">
          <div className="skeleton aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2.5 p-4">
            <div className="skeleton h-3 w-1/4" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton mt-2 h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
