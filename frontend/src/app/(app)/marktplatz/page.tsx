'use client';

// B2B-Marktplatz (Buy-Side): kuratierte Angebote der Partner-Händler. Zwei Wege
// je Produkt: Kauf BEIM Händler (Affiliate-Link, Klick serverseitig gezählt) ODER
// direkte Bestellung in der App (Warenkorb -> je Händler eine Bestellung). Ein
// Katalog-Request; Kategorie-Navigation, Filter und Sortierung laufen clientseitig
// (sofortige Reaktion). Bild-/SDB-Streams über die authentifizierten Buy-Side-Routen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type {
  MarketplaceBestandStatus,
  MarketplaceCatalog,
  MarketplaceCategoryNode,
  MarketplaceOrder,
  MarketplaceOrderStatus,
  MarketplaceProduct,
} from '@/lib/types';
import { BEREICHE } from '@/lib/labels';
import { PageHeader, Loading, ErrorBox, Empty, Modal, Badge } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT, useLanguage } from '@/lib/i18n';
import {
  BER_KEY,
  BESTAND_BADGE,
  BESTAND_KEY,
  Herkunft,
  KatalogBild,
  Sterne,
  flaggeEmoji,
  landName,
  preisWert,
  useViewNav,
} from './shared';
import { loadKorb, saveKorb, type Korb } from './cart-store';

/** Client-seitige Sortier-Reihenfolge des Katalogs. */
type Sortierung = 'empfohlen' | 'preisAuf' | 'preisAb' | 'neueste' | 'bewertung';

/** Query-Param, der das Händler-Profil (Slide-over) öffnet – deep-link-fähig. */
const HAENDLER_PARAM = 'haendler';

const ORDER_STATUS_BADGE: Record<MarketplaceOrderStatus, string> = {
  eingegangen: 'badge-info',
  bestaetigt: 'badge-caution',
  versendet: 'badge-positive',
  storniert: 'badge-danger',
};
const ORDER_STATUS_KEY: Record<MarketplaceOrderStatus, string> = {
  eingegangen: 'marktplatz.orderStatus.eingegangen',
  bestaetigt: 'marktplatz.orderStatus.bestaetigt',
  versendet: 'marktplatz.orderStatus.versendet',
  storniert: 'marktplatz.orderStatus.storniert',
};

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Bereichs-Label (marktplatz.* mit Fallback auf labels.* bzw. Rohwert). */
function bereichLabel(t: TFn, bereich?: string | null): string {
  const key = bereich ?? 'sonstiges';
  return BER_KEY[key]
    ? t(BER_KEY[key])
    : t(BEREICHE.find((b) => b.key === key)?.labelKey ?? key);
}

const zeit = (p: MarketplaceProduct) => (p.createdAt ? new Date(p.createdAt).getTime() : 0);

export default function MarktplatzPage() {
  const t = useT();
  const { lang } = useLanguage();
  const nav = useViewNav();
  const { user } = useAuth();

  const [katalog, setKatalog] = useState<MarketplaceCatalog | null>(null);
  const [kategorien, setKategorien] = useState<MarketplaceCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState<'katalog' | 'bestellungen'>('katalog');

  // --- Kategorie-Navigation + Filter (clientseitig) ---
  const [suche, setSuche] = useState('');
  const [bereich, setBereich] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [marke, setMarke] = useState('');
  const [preisMin, setPreisMin] = useState('');
  const [preisMax, setPreisMax] = useState('');
  const [bestand, setBestand] = useState<'' | MarketplaceBestandStatus>('');
  const [herkunft, setHerkunft] = useState('');
  const [nurBestellbar, setNurBestellbar] = useState(false);
  const [nurSdb, setNurSdb] = useState(false);
  const [sortierung, setSortierung] = useState<Sortierung>('empfohlen');
  const [ansicht, setAnsicht] = useState<'grid' | 'liste'>('grid');
  const [filterOffen, setFilterOffen] = useState(false);
  const [alleMarken, setAlleMarken] = useState(false);

  const [quickId, setQuickId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Warenkorb (persistiert in localStorage, geteilt mit Detail-/Schnellansicht).
  const [korb, setKorb] = useState<Korb>({});
  const [korbGeladen, setKorbGeladen] = useState(false);
  const [checkoutOffen, setCheckoutOffen] = useState(false);
  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);

  // Händler-Profil (Slide-over) über Query-Param – deep-link- und Back-Button-fähig.
  const [haendlerId, setHaendlerId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () =>
      setHaendlerId(new URLSearchParams(window.location.search).get(HAENDLER_PARAM));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const oeffneHaendler = useCallback((id: string) => {
    const url = `${window.location.pathname}?${HAENDLER_PARAM}=${encodeURIComponent(id)}`;
    window.history.pushState({ [HAENDLER_PARAM]: id }, '', url);
    setHaendlerId(id);
  }, []);
  const schliesseHaendler = useCallback(() => {
    if (window.history.state && window.history.state[HAENDLER_PARAM]) window.history.back();
    else {
      window.history.replaceState(null, '', window.location.pathname);
      setHaendlerId(null);
    }
  }, []);

  // Korb beim Mount aus dem Speicher lesen, danach jede Änderung zurückschreiben.
  useEffect(() => {
    setKorb(loadKorb());
    setKorbGeladen(true);
  }, []);
  useEffect(() => {
    if (korbGeladen) saveKorb(korb);
  }, [korb, korbGeladen]);

  useEffect(() => {
    Promise.all([
      api.get<MarketplaceCatalog>('/marketplace/catalog'),
      api.get<MarketplaceCategoryNode[]>('/marketplace/categories').catch(() => []),
    ])
      .then(([k, c]) => {
        setKatalog(k);
        setKategorien(c ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('marktplatz.error.catalog')))
      .finally(() => setLoading(false));
  }, [t]);

  const ladeBestellungen = useCallback(() => {
    api
      .get<MarketplaceOrder[]>('/marketplace/orders')
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : t('marktplatz.error.orders')));
  }, [t]);
  useEffect(() => {
    if (tab === 'bestellungen' && orders === null) ladeBestellungen();
  }, [tab, orders, ladeBestellungen]);

  const alleProdukte = useMemo(() => katalog?.produkte ?? [], [katalog]);
  const produktById = useMemo(() => new Map(alleProdukte.map((p) => [p.id, p])), [alleProdukte]);

  // Flache Kategorie-Liste (Haupt- + Unterkategorien).
  const flatCats = useMemo(() => {
    const out: MarketplaceCategoryNode[] = [];
    for (const h of kategorien) {
      out.push(h);
      for (const u of h.unterkategorien ?? []) out.push(u);
    }
    return out;
  }, [kategorien]);

  // Zähler je Bereich (leere Bereiche werden ausgeblendet).
  const bereichCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of alleProdukte) {
      const b = p.bereich ?? 'sonstiges';
      c.set(b, (c.get(b) ?? 0) + 1);
    }
    return c;
  }, [alleProdukte]);

  const imBereich = useMemo(
    () =>
      bereich ? alleProdukte.filter((p) => (p.bereich ?? 'sonstiges') === bereich) : alleProdukte,
    [alleProdukte, bereich],
  );

  // Unterkategorie-Chips: Kategorien des Bereichs mit >=1 Produkt.
  const unterkategorien = useMemo(() => {
    if (!bereich) return [];
    const count = new Map<string, number>();
    for (const p of imBereich) if (p.categoryId) count.set(p.categoryId, (count.get(p.categoryId) ?? 0) + 1);
    return flatCats
      .filter((c) => c.bereich === bereich && count.has(c.id))
      .map((c) => ({ ...c, count: count.get(c.id) ?? 0 }));
  }, [bereich, imBereich, flatCats]);

  // Produkte nach Bereich + Unterkategorie (Basis für Marken-/Herkunft-Chips).
  const imKontext = useMemo(
    () => (categoryId ? imBereich.filter((p) => p.categoryId === categoryId) : imBereich),
    [imBereich, categoryId],
  );

  const marken = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of imKontext) if (p.marke) c.set(p.marke, (c.get(p.marke) ?? 0) + 1);
    return Array.from(c.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .map(([name]) => name);
  }, [imKontext]);
  const MARKEN_DECKEL = 14;
  const sichtbareMarken = alleMarken ? marken : marken.slice(0, MARKEN_DECKEL);

  const herkunftLaender = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of imKontext) {
      const iso = (p.herkunftsland ?? '').trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(iso)) c.set(iso, (c.get(iso) ?? 0) + 1);
    }
    return Array.from(c.keys()).sort((a, b) => landName(a, lang).localeCompare(landName(b, lang), lang));
  }, [imKontext, lang]);

  const preisMinN = useMemo(() => (preisMin.trim() ? Number(preisMin.replace(',', '.')) : null), [preisMin]);
  const preisMaxN = useMemo(() => (preisMax.trim() ? Number(preisMax.replace(',', '.')) : null), [preisMax]);

  const aktiveFilter =
    (categoryId ? 1 : 0) +
    (marke ? 1 : 0) +
    (herkunft ? 1 : 0) +
    (bestand ? 1 : 0) +
    (nurBestellbar ? 1 : 0) +
    (nurSdb ? 1 : 0) +
    (preisMinN != null || preisMaxN != null ? 1 : 0) +
    (suche.trim() ? 1 : 0);

  const produkte = useMemo(() => {
    const term = suche.trim().toLowerCase();
    const preisAktiv = preisMinN != null || preisMaxN != null;
    const gefiltert = imBereich.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (marke && p.marke !== marke) return false;
      if (herkunft && (p.herkunftsland ?? '').toUpperCase() !== herkunft) return false;
      if (nurBestellbar && !(p.bestellbar && p.preis != null)) return false;
      if (nurSdb && !p.hatSdb) return false;
      if (bestand && p.bestandStatus !== bestand) return false;
      if (preisAktiv) {
        const w = preisWert(p);
        if (w == null) return false;
        if (preisMinN != null && w < preisMinN) return false;
        if (preisMaxN != null && w > preisMaxN) return false;
      }
      if (term) {
        const hay = `${p.name} ${p.marke ?? ''} ${p.haendlerName ?? ''} ${p.beschreibung ?? ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    const arr = [...gefiltert];
    switch (sortierung) {
      case 'preisAuf':
        arr.sort((a, b) => (preisWert(a) ?? Infinity) - (preisWert(b) ?? Infinity));
        break;
      case 'preisAb':
        arr.sort((a, b) => (preisWert(b) ?? -Infinity) - (preisWert(a) ?? -Infinity));
        break;
      case 'neueste':
        arr.sort((a, b) => zeit(b) - zeit(a));
        break;
      case 'bewertung':
        arr.sort(
          (a, b) =>
            (b.bewertungSchnitt ?? 0) - (a.bewertungSchnitt ?? 0) ||
            (b.bewertungAnzahl ?? 0) - (a.bewertungAnzahl ?? 0),
        );
        break;
      default: // 'empfohlen'
        arr.sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0) || zeit(b) - zeit(a));
    }
    return arr;
  }, [imBereich, categoryId, marke, herkunft, nurBestellbar, nurSdb, bestand, preisMinN, preisMaxN, suche, sortierung]);

  const highlightProdukte = useMemo(() => {
    if (!katalog) return [];
    return katalog.highlights
      .map((id) => produktById.get(id))
      .filter((p): p is MarketplaceProduct => !!p)
      .slice(0, 6);
  }, [katalog, produktById]);

  function waehleBereich(b: string) {
    setBereich(b);
    setCategoryId('');
    setMarke('');
    setHerkunft('');
    setAlleMarken(false);
  }
  function filterZuruecksetzen() {
    setSuche('');
    setBereich('');
    setCategoryId('');
    setMarke('');
    setPreisMin('');
    setPreisMax('');
    setBestand('');
    setHerkunft('');
    setNurBestellbar(false);
    setNurSdb(false);
    setAlleMarken(false);
  }

  // --- Warenkorb ---
  const korbZeilen = useMemo(
    () =>
      Object.entries(korb)
        .map(([id, menge]) => ({ produkt: produktById.get(id), menge }))
        .filter((z): z is { produkt: MarketplaceProduct; menge: number } => !!z.produkt),
    [korb, produktById],
  );
  const korbSumme = korbZeilen.reduce((s, z) => s + Number(z.produkt.preis ?? 0) * z.menge, 0);
  const korbAnzahl = korbZeilen.reduce((s, z) => s + z.menge, 0);

  const inDenKorb = useCallback((p: MarketplaceProduct, delta = 1) => {
    setKorb((k) => {
      const neu = Math.max(0, (k[p.id] ?? 0) + delta);
      const kopie = { ...k };
      if (neu === 0) delete kopie[p.id];
      else kopie[p.id] = Math.min(999, neu);
      return kopie;
    });
  }, []);

  const zumHaendler = useCallback(
    async (p: MarketplaceProduct) => {
      setBusyId(p.id);
      try {
        const { affiliateUrl } = await api.post<{ affiliateUrl: string }>(
          `/marketplace/products/${p.id}/klick`,
        );
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        setError(e instanceof Error ? e.message : t('marktplatz.error.link'));
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  const oeffnerHaendler = useMemo(
    () => (haendlerId ? katalog?.haendler.find((h) => h.id === haendlerId) ?? null : null),
    [haendlerId, katalog],
  );
  const haendlerProdukte = useMemo(
    () => (haendlerId ? alleProdukte.filter((p) => p.dealerId === haendlerId) : []),
    [haendlerId, alleProdukte],
  );
  const quickProdukt = quickId ? produktById.get(quickId) ?? null : null;

  return (
    <div>
      <PageHeader
        title={t('marktplatz.title')}
        subtitle={t('marktplatz.subtitle')}
        action={
          <div className="seg-group">
            <button
              className={`seg ${tab === 'katalog' ? 'seg-active' : ''}`}
              onClick={() => setTab('katalog')}
            >
              {t('marktplatz.tab.catalog')}
            </button>
            <button
              className={`seg ${tab === 'bestellungen' ? 'seg-active' : ''}`}
              onClick={() => setTab('bestellungen')}
            >
              {t('marktplatz.tab.orders')}
            </button>
          </div>
        }
      />
      {error && <ErrorBox message={error} />}

      {tab === 'bestellungen' ? (
        <Bestellungen orders={orders} />
      ) : loading ? (
        <KatalogSkeleton />
      ) : !katalog || katalog.produkte.length === 0 ? (
        <KatalogEmpty title={t('marktplatz.empty.catalog')} hint={t('marktplatz.empty.hint')} />
      ) : (
        <>
          {/* Sticky Steuerleiste: Bereiche + Suche/Sortierung/Ansicht/Filter */}
          <div className="sticky top-14 z-20 -mx-5 mb-5 border-b border-ink-700/60 bg-ink-900/90 px-5 pb-4 pt-3 backdrop-blur-md md:-mx-7 md:px-7">
            {/* Ebene 1: Bereiche als segmentierte Steuerung */}
            <div className="seg-group w-full overflow-x-auto">
              <button
                onClick={() => waehleBereich('')}
                className={`seg whitespace-nowrap ${bereich === '' ? 'seg-active' : ''}`}
              >
                {t('marktplatz.bereich.all')}
                <span className="ml-1.5 text-xs opacity-70">{alleProdukte.length}</span>
              </button>
              {BEREICHE.filter((b) => (bereichCounts.get(b.key) ?? 0) > 0).map((b) => (
                <button
                  key={b.key}
                  onClick={() => waehleBereich(b.key)}
                  className={`seg whitespace-nowrap ${bereich === b.key ? 'seg-active' : ''}`}
                >
                  {bereichLabel(t, b.key)}
                  <span className="ml-1.5 text-xs opacity-70">{bereichCounts.get(b.key)}</span>
                </button>
              ))}
            </div>

            {/* Suche + Sortierung + Ansicht + Filter-Umschalter */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  className="input pl-10"
                  placeholder={t('marktplatz.searchPlaceholder')}
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <label className="flex items-center gap-2 text-sm text-chrome-400">
                  <span className="hidden whitespace-nowrap sm:inline">{t('marktplatz.sort.label')}</span>
                  <select className="select" value={sortierung} onChange={(e) => setSortierung(e.target.value as Sortierung)}>
                    <option value="empfohlen">{t('marktplatz.sort.recommended')}</option>
                    <option value="preisAuf">{t('marktplatz.sort.priceAsc')}</option>
                    <option value="preisAb">{t('marktplatz.sort.priceDesc')}</option>
                    <option value="neueste">{t('marktplatz.sort.newest')}</option>
                    <option value="bewertung">{t('marktplatz.sort.rating')}</option>
                  </select>
                </label>
                <div className="seg-group shrink-0">
                  <button
                    onClick={() => setAnsicht('grid')}
                    className={`seg px-2 ${ansicht === 'grid' ? 'seg-active' : ''}`}
                    aria-label={t('marktplatz.view.grid')}
                    aria-pressed={ansicht === 'grid'}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                  </button>
                  <button
                    onClick={() => setAnsicht('liste')}
                    className={`seg px-2 ${ansicht === 'liste' ? 'seg-active' : ''}`}
                    aria-label={t('marktplatz.view.list')}
                    aria-pressed={ansicht === 'liste'}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                  </button>
                </div>
                <button
                  onClick={() => setFilterOffen((v) => !v)}
                  className={`btn-subtle btn-sm gap-1.5 ${filterOffen || aktiveFilter > 0 ? 'text-copper' : ''}`}
                  aria-expanded={filterOffen}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                  {t('marktplatz.filter.label')}
                  {aktiveFilter > 0 && (
                    <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-bold text-ink-950">
                      {aktiveFilter}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Ebene 2: Unterkategorien als Chips */}
            {unterkategorien.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCategoryId('')}
                  className={`choice rounded-full px-3 py-1 text-xs font-medium ${categoryId === '' ? 'choice-active' : ''}`}
                >
                  {t('marktplatz.category.all')}
                </button>
                {unterkategorien.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(categoryId === c.id ? '' : c.id)}
                    className={`choice rounded-full px-3 py-1 text-xs font-medium ${categoryId === c.id ? 'choice-active' : ''}`}
                  >
                    {c.name}
                    <span className="ml-1 opacity-60">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter-Panel (einklappbar) */}
          {filterOffen && (
            <div className="card mb-5 animate-fade-in space-y-4">
              {/* Hersteller */}
              {marken.length > 0 && (
                <div>
                  <p className="kpi-label mb-2">{t('marktplatz.filter.brand')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setMarke('')}
                      className={`choice rounded-full px-3 py-1 text-xs font-medium ${marke === '' ? 'choice-active' : ''}`}
                    >
                      {t('marktplatz.markenAll')}
                    </button>
                    {sichtbareMarken.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMarke(marke === m ? '' : m)}
                        className={`choice rounded-full px-3 py-1 text-xs font-medium ${marke === m ? 'choice-active' : ''}`}
                      >
                        {m}
                      </button>
                    ))}
                    {marken.length > MARKEN_DECKEL && (
                      <button onClick={() => setAlleMarken((v) => !v)} className="link-action px-2 py-1 text-xs">
                        {alleMarken ? t('marktplatz.markenShowLess') : t('marktplatz.markenShowAll', { count: marken.length })}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Preis-Range */}
                <div>
                  <p className="kpi-label mb-2">{t('marktplatz.filter.price')}</p>
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder={t('marktplatz.filter.priceMin')}
                      value={preisMin}
                      onChange={(e) => setPreisMin(e.target.value)}
                      aria-label={t('marktplatz.filter.priceMin')}
                    />
                    <span className="text-chrome-600">–</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      placeholder={t('marktplatz.filter.priceMax')}
                      value={preisMax}
                      onChange={(e) => setPreisMax(e.target.value)}
                      aria-label={t('marktplatz.filter.priceMax')}
                    />
                  </div>
                </div>

                {/* Verfügbarkeit */}
                <div>
                  <p className="kpi-label mb-2">{t('marktplatz.filter.availability')}</p>
                  <div className="seg-group">
                    <button className={`seg ${bestand === '' ? 'seg-active' : ''}`} onClick={() => setBestand('')}>
                      {t('marktplatz.filter.availAll')}
                    </button>
                    {(['verfuegbar', 'wenig', 'ausverkauft'] as MarketplaceBestandStatus[]).map((s) => (
                      <button key={s} className={`seg ${bestand === s ? 'seg-active' : ''}`} onClick={() => setBestand(bestand === s ? '' : s)}>
                        {t(BESTAND_KEY[s])}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Umschalter */}
                <div>
                  <p className="kpi-label mb-2">{t('marktplatz.filter.more')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setNurBestellbar((v) => !v)}
                      className={`choice rounded-full px-3 py-1.5 text-xs font-medium ${nurBestellbar ? 'choice-active' : ''}`}
                      aria-pressed={nurBestellbar}
                    >
                      {t('marktplatz.filter.orderableOnly')}
                    </button>
                    <button
                      onClick={() => setNurSdb((v) => !v)}
                      className={`choice rounded-full px-3 py-1.5 text-xs font-medium ${nurSdb ? 'choice-active' : ''}`}
                      aria-pressed={nurSdb}
                    >
                      {t('marktplatz.filter.withSdb')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Herkunftsland (Flaggen-Chips) */}
              {herkunftLaender.length > 0 && (
                <div>
                  <p className="kpi-label mb-2">{t('marktplatz.filter.origin')}</p>
                  <div className="flex flex-wrap gap-2">
                    {herkunftLaender.map((iso) => (
                      <button
                        key={iso}
                        onClick={() => setHerkunft(herkunft === iso ? '' : iso)}
                        className={`choice inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${herkunft === iso ? 'choice-active' : ''}`}
                      >
                        <span aria-hidden="true">{flaggeEmoji(iso)}</span>
                        {landName(iso, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aktiveFilter > 0 && (
                <div className="flex justify-end border-t border-ink-700/50 pt-3">
                  <button className="btn-ghost btn-sm" onClick={filterZuruecksetzen}>
                    {t('marktplatz.resetFilter')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Highlights nur auf der „Landing"-Ansicht (kein Filter aktiv) */}
          {aktiveFilter === 0 && bereich === '' && highlightProdukte.length > 0 && (
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-copper">{ICON_PATHS.trophy}</Icon>
                <h2 className="font-display text-base font-semibold text-chrome-50">{t('marktplatz.highlightsTitle')}</h2>
              </div>
              <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2">
                {highlightProdukte.map((p) => (
                  <div key={p.id} className="w-60 shrink-0 snap-start">
                    <ProduktKarte
                      p={p}
                      imKorb={korb[p.id] ?? 0}
                      busy={busyId === p.id}
                      lang={lang}
                      t={t}
                      onKorb={(d) => inDenKorb(p, d)}
                      onHaendler={() => zumHaendler(p)}
                      onDealer={() => oeffneHaendler(p.dealerId)}
                      onQuick={() => setQuickId(p.id)}
                      nav={nav}
                      vt={false}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ergebnis */}
          {produkte.length === 0 ? (
            <div className="card">
              <Empty
                text={t('marktplatz.noResults')}
                action={
                  <button className="btn-subtle btn-sm" onClick={filterZuruecksetzen}>
                    {t('marktplatz.resetFilter')}
                  </button>
                }
              />
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-chrome-500">{t('marktplatz.resultCount', { count: produkte.length })}</p>
              {ansicht === 'grid' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {produkte.map((p) => (
                    <ProduktKarte
                      key={p.id}
                      p={p}
                      imKorb={korb[p.id] ?? 0}
                      busy={busyId === p.id}
                      lang={lang}
                      t={t}
                      onKorb={(d) => inDenKorb(p, d)}
                      onHaendler={() => zumHaendler(p)}
                      onDealer={() => oeffneHaendler(p.dealerId)}
                      onQuick={() => setQuickId(p.id)}
                      nav={nav}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {produkte.map((p) => (
                    <ProduktZeile
                      key={p.id}
                      p={p}
                      imKorb={korb[p.id] ?? 0}
                      busy={busyId === p.id}
                      lang={lang}
                      t={t}
                      onKorb={(d) => inDenKorb(p, d)}
                      onHaendler={() => zumHaendler(p)}
                      onDealer={() => oeffneHaendler(p.dealerId)}
                      onQuick={() => setQuickId(p.id)}
                      nav={nav}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Schwebende Warenkorb-Leiste */}
          {korbAnzahl > 0 && (
            <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(92%,560px)] items-center justify-between gap-3 rounded-2xl border border-copper/40 bg-ink-850/95 px-5 py-3 shadow-pop backdrop-blur">
              <span className="text-sm text-chrome-200">
                <strong className="text-chrome-50">{korbAnzahl}</strong> {t('marktplatz.cart.items')} ·{' '}
                <strong className="text-copper">{eur(korbSumme)}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost btn-sm" onClick={() => setKorb({})}>{t('marktplatz.cart.clear')}</button>
                <button className="btn-primary btn-sm" onClick={() => setCheckoutOffen(true)}>{t('marktplatz.cart.checkout')}</button>
              </div>
            </div>
          )}

          <CheckoutModal
            open={checkoutOffen}
            onClose={() => setCheckoutOffen(false)}
            zeilen={korbZeilen}
            summe={korbSumme}
            vorbelegung={{
              kontaktName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
              kontaktEmail: user?.email ?? '',
            }}
            onBestellt={(neu) => {
              setKorb({});
              setCheckoutOffen(false);
              setOrders(null);
              setTab('bestellungen');
              setOrders(neu.concat([]));
              ladeBestellungen();
            }}
          />
        </>
      )}

      {/* Schnellansicht (Slide-over) */}
      <QuickView
        produkt={quickProdukt}
        imKorb={quickProdukt ? korb[quickProdukt.id] ?? 0 : 0}
        busy={quickProdukt ? busyId === quickProdukt.id : false}
        lang={lang}
        t={t}
        onClose={() => setQuickId(null)}
        onKorb={(d) => quickProdukt && inDenKorb(quickProdukt, d)}
        onHaendler={() => quickProdukt && zumHaendler(quickProdukt)}
        onDetail={() => {
          if (quickProdukt) {
            const id = quickProdukt.id;
            setQuickId(null);
            nav(`/marktplatz/produkt?id=${encodeURIComponent(id)}`);
          }
        }}
      />

      {/* Händler-Profil (Slide-over) */}
      <HaendlerSlideOver
        haendler={oeffnerHaendler}
        produkte={haendlerProdukte}
        onClose={schliesseHaendler}
        onZumHaendler={zumHaendler}
        busyId={busyId}
      />
    </div>
  );
}

// ===========================================================================
// Produktkarte (Grid)
// ===========================================================================

interface KarteProps {
  p: MarketplaceProduct;
  imKorb: number;
  busy: boolean;
  lang: string;
  t: TFn;
  onKorb: (delta: number) => void;
  onHaendler: () => void;
  onDealer: () => void;
  onQuick: () => void;
  nav: (href: string) => void;
  /**
   * view-transition-name für das Bild setzen (Liste->Detail-Morph). Nur EIN
   * Element pro Produkt darf den Namen tragen; die Highlights-Reihe (die dasselbe
   * Produkt zusätzlich zeigt) setzt ihn daher NICHT (sonst doppelter Name).
   */
  vt?: boolean;
}

/** Detail-Href + view-transition-freundlicher Klick (Modifier -> normaler Link). */
function useDetail(p: MarketplaceProduct, nav: (href: string) => void) {
  const href = `/marktplatz/produkt?id=${encodeURIComponent(p.id)}`;
  const onClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || (e as React.MouseEvent).button !== 0) return;
    e.preventDefault();
    nav(href);
  };
  return { href, onClick };
}

function Badges({ p, t }: { p: MarketplaceProduct; t: TFn }) {
  const bestellbar = !!p.bestellbar && p.preis != null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${bestellbar ? 'badge-positive' : 'badge-neutral'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${bestellbar ? 'bg-positive' : 'bg-chrome-500'}`} />
        {bestellbar ? t('marktplatz.badge.orderable') : t('marktplatz.badge.atDealer')}
      </span>
      {p.hatSdb && (
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium badge-info">{t('marktplatz.badge.sdb')}</span>
      )}
      {p.bestandStatus && p.bestandStatus !== 'verfuegbar' && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BESTAND_BADGE[p.bestandStatus]}`}>
          {t(BESTAND_KEY[p.bestandStatus])}
        </span>
      )}
    </div>
  );
}

function KorbAktion({ p, imKorb, busy, t, onKorb, onHaendler }: Pick<KarteProps, 'p' | 'imKorb' | 'busy' | 't' | 'onKorb' | 'onHaendler'>) {
  const bestellbar = !!p.bestellbar && p.preis != null;
  const ausverkauft = p.bestandStatus === 'ausverkauft';
  return (
    <>
      {bestellbar &&
        (imKorb === 0 ? (
          <button className="btn-primary btn-sm mt-2 w-full justify-center" disabled={ausverkauft} onClick={() => onKorb(1)}>
            {ausverkauft ? t('marktplatz.bestand.ausverkauft') : t('marktplatz.addToCart')}
          </button>
        ) : (
          <div className="mt-2 flex items-center justify-between rounded-lg border border-copper/40 bg-copper-soft px-2 py-1">
            <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.decrease')} onClick={() => onKorb(-1)}>−</button>
            <span className="text-sm font-semibold text-copper">{t('marktplatz.inCart', { count: imKorb })}</span>
            <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.increase')} onClick={() => onKorb(1)}>+</button>
          </div>
        ))}
      {p.affiliateUrl && (
        <button className={`${bestellbar ? 'btn-subtle' : 'btn-primary'} btn-sm mt-2 w-full justify-center`} disabled={busy} onClick={onHaendler}>
          {busy ? t('marktplatz.opening') : t('marktplatz.toOffer')}
        </button>
      )}
    </>
  );
}

function ProduktKarte({ p, imKorb, busy, lang, t, onKorb, onHaendler, onDealer, onQuick, nav, vt = true }: KarteProps) {
  const detail = useDetail(p, nav);
  const preis = preisWert(p);
  return (
    <div className="group card-flush flex flex-col overflow-hidden transition-transform duration-180 ease-emphasized hover:-translate-y-0.5">
      <a href={detail.href} onClick={detail.onClick} className="relative block aspect-[4/3] overflow-hidden border-b border-ink-700/50" style={vt ? { viewTransitionName: `mp-${p.id}` } : undefined}>
        <KatalogBild p={p} />
        {p.istHighlight && (
          <span className="absolute right-0 top-3 rounded-l-full bg-copper-grad px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-950 shadow">
            {t('marktplatz.highlight')}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-ink-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chrome-100 backdrop-blur-sm">
          {bereichLabel(t, p.bereich)}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onQuick(); }}
          className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-ink-950/70 text-chrome-100 opacity-0 backdrop-blur-sm transition-opacity duration-150 hover:text-copper focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={t('marktplatz.quickView')}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /></svg>
        </button>
      </a>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">{p.marke || bereichLabel(t, p.bereich)}</span>
          {p.herkunftsland && flaggeEmoji(p.herkunftsland) && (
            <span aria-label={landName(p.herkunftsland, lang)} title={landName(p.herkunftsland, lang)}>{flaggeEmoji(p.herkunftsland)}</span>
          )}
        </div>
        <a href={detail.href} onClick={detail.onClick} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50 transition-colors group-hover:text-copper">{p.name}</h3>
        </a>
        <button
          type="button"
          onClick={onDealer}
          className="self-start rounded text-left text-xs text-chrome-500 transition-colors hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
          aria-label={t('marktplatz.dealer.viewProfile')}
        >
          {p.haendlerName}
        </button>
        {(p.bewertungAnzahl ?? 0) > 0 && (
          <Sterne
            schnitt={p.bewertungSchnitt ?? 0}
            anzahl={p.bewertungAnzahl ?? 0}
            label={t('marktplatz.rating.aria', { schnitt: (p.bewertungSchnitt ?? 0).toFixed(1), anzahl: p.bewertungAnzahl ?? 0 })}
          />
        )}
        <div className="mt-0.5"><Badges p={p} t={t} /></div>
        <p className="mt-auto pt-2 text-sm font-semibold text-chrome-100">
          {preis != null ? (
            <>{p.preisHinweis ? `${p.preisHinweis} ` : ''}{eur(preis)}</>
          ) : (
            <span className="font-normal text-chrome-500">{t('marktplatz.priceOnRequest')}</span>
          )}
        </p>
        <KorbAktion p={p} imKorb={imKorb} busy={busy} t={t} onKorb={onKorb} onHaendler={onHaendler} />
      </div>
    </div>
  );
}

// ===========================================================================
// Produktzeile (Liste)
// ===========================================================================

function ProduktZeile({ p, imKorb, busy, lang, t, onKorb, onHaendler, onDealer, onQuick, nav }: KarteProps) {
  const detail = useDetail(p, nav);
  const preis = preisWert(p);
  return (
    <div className="group card-flush flex gap-4 overflow-hidden p-3 transition-colors hover:border-ink-600">
      <a href={detail.href} onClick={detail.onClick} className="relative block h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-ink-700/50 sm:h-32 sm:w-32" style={{ viewTransitionName: `mp-${p.id}` }}>
        <KatalogBild p={p} />
        {p.istHighlight && (
          <span className="absolute left-0 top-2 rounded-r-full bg-copper-grad px-2 py-0.5 text-[9px] font-bold uppercase text-ink-950">{t('marktplatz.highlight')}</span>
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">{p.marke || bereichLabel(t, p.bereich)}</span>
          {p.herkunftsland && flaggeEmoji(p.herkunftsland) && (
            <span aria-label={landName(p.herkunftsland, lang)} title={landName(p.herkunftsland, lang)}>{flaggeEmoji(p.herkunftsland)}</span>
          )}
        </div>
        <a href={detail.href} onClick={detail.onClick} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50">
          <h3 className="line-clamp-1 text-sm font-semibold text-chrome-50 transition-colors group-hover:text-copper">{p.name}</h3>
        </a>
        <button type="button" onClick={onDealer} className="self-start rounded text-left text-xs text-chrome-500 transition-colors hover:text-copper" aria-label={t('marktplatz.dealer.viewProfile')}>
          {p.haendlerName}
        </button>
        {p.beschreibung && <p className="mt-1 line-clamp-2 text-xs text-chrome-400">{p.beschreibung}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {(p.bewertungAnzahl ?? 0) > 0 && (
            <Sterne schnitt={p.bewertungSchnitt ?? 0} anzahl={p.bewertungAnzahl ?? 0} compact label={t('marktplatz.rating.aria', { schnitt: (p.bewertungSchnitt ?? 0).toFixed(1), anzahl: p.bewertungAnzahl ?? 0 })} />
          )}
          <Badges p={p} t={t} />
        </div>
      </div>
      <div className="flex w-40 shrink-0 flex-col justify-between text-right">
        <p className="text-sm font-semibold text-chrome-100">
          {preis != null ? (
            <>{p.preisHinweis && <span className="block text-[10px] font-normal text-chrome-500">{p.preisHinweis}</span>}{eur(preis)}</>
          ) : (
            <span className="font-normal text-chrome-500">{t('marktplatz.priceOnRequest')}</span>
          )}
        </p>
        <div className="text-left"><KorbAktion p={p} imKorb={imKorb} busy={busy} t={t} onKorb={onKorb} onHaendler={onHaendler} /></div>
        <button onClick={onQuick} className="mt-1 text-xs text-chrome-500 transition-colors hover:text-copper">{t('marktplatz.quickView')}</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Schnellansicht (Slide-over)
// ===========================================================================

function QuickView({
  produkt,
  imKorb,
  busy,
  lang,
  t,
  onClose,
  onKorb,
  onHaendler,
  onDetail,
}: {
  produkt: MarketplaceProduct | null;
  imKorb: number;
  busy: boolean;
  lang: string;
  t: TFn;
  onClose: () => void;
  onKorb: (delta: number) => void;
  onHaendler: () => void;
  onDetail: () => void;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  useEffect(() => {
    if (!produkt) return;
    const raf = requestAnimationFrame(() => setSichtbar(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      setSichtbar(false);
    };
  }, [produkt, onClose]);

  if (!produkt) return null;
  const preis = preisWert(produkt);
  const bestellbar = !!produkt.bestellbar && produkt.preis != null;
  const ausverkauft = produkt.bestandStatus === 'ausverkauft';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={produkt.name}>
      <div className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-220 ease-emphasized ${sichtbar ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-850 shadow-pop transition-transform duration-220 ease-emphasized ${sichtbar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-ink-700/70 p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">{produkt.marke || bereichLabel(t, produkt.bereich)}</span>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50" aria-label={t('common.close')}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="aspect-[4/3] w-full overflow-hidden border-b border-ink-700/50">
            <KatalogBild p={produkt} eager className="h-full w-full object-cover" />
          </div>
          <div className="space-y-3 p-5">
            <h2 className="font-display text-lg font-semibold text-chrome-50">{produkt.name}</h2>
            <div className="flex flex-wrap items-center gap-3">
              {(produkt.bewertungAnzahl ?? 0) > 0 && (
                <Sterne schnitt={produkt.bewertungSchnitt ?? 0} anzahl={produkt.bewertungAnzahl ?? 0} label={t('marktplatz.rating.aria', { schnitt: (produkt.bewertungSchnitt ?? 0).toFixed(1), anzahl: produkt.bewertungAnzahl ?? 0 })} />
              )}
              {produkt.herkunftsland && <Herkunft iso={produkt.herkunftsland} lang={lang} className="text-sm text-chrome-400" />}
            </div>
            <Badges p={produkt} t={t} />
            {produkt.inhaltMenge && <p className="text-xs text-chrome-500">{produkt.inhaltMenge}</p>}
            {produkt.beschreibung && <p className="line-clamp-4 text-sm leading-relaxed text-chrome-300">{produkt.beschreibung}</p>}
            <p className="text-lg font-semibold text-chrome-50">
              {preis != null ? (
                <>{produkt.preisHinweis ? <span className="mr-1 text-xs font-normal text-chrome-500">{produkt.preisHinweis}</span> : null}{eur(preis)}</>
              ) : (
                <span className="text-base font-normal text-chrome-400">{t('marktplatz.priceOnRequest')}</span>
              )}
            </p>
          </div>
        </div>
        <div className="space-y-2 border-t border-ink-700/70 p-4">
          {bestellbar &&
            (imKorb === 0 ? (
              <button className="btn-primary w-full justify-center" disabled={ausverkauft} onClick={() => onKorb(1)}>
                {ausverkauft ? t('marktplatz.bestand.ausverkauft') : t('marktplatz.addToCart')}
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-copper/40 bg-copper-soft px-2 py-1.5">
                <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.decrease')} onClick={() => onKorb(-1)}>−</button>
                <span className="text-sm font-semibold text-copper">{t('marktplatz.inCart', { count: imKorb })}</span>
                <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.increase')} onClick={() => onKorb(1)}>+</button>
              </div>
            ))}
          {produkt.affiliateUrl && (
            <button className={`${bestellbar ? 'btn-subtle' : 'btn-primary'} w-full justify-center`} disabled={busy} onClick={onHaendler}>
              {busy ? t('marktplatz.opening') : t('marktplatz.toOffer')}
            </button>
          )}
          <button className="btn-ghost w-full justify-center" onClick={onDetail}>{t('marktplatz.quickView.details')}</button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Lade-/Leer-Zustände
// ===========================================================================

function KatalogSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-28" />
        ))}
      </div>
      <div className="skeleton mb-5 h-10 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card-flush overflow-hidden">
            <div className="skeleton aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2.5 p-4">
              <div className="skeleton h-2.5 w-1/3" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton mt-3 h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KatalogEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center animate-fade-in">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-copper-soft text-copper">
        <Icon className="h-7 w-7">{ICON_PATHS.marketplace}</Icon>
      </span>
      <h3 className="font-display text-lg font-semibold text-chrome-50">{title}</h3>
      <p className="max-w-sm text-sm text-chrome-500">{hint}</p>
    </div>
  );
}

// ===========================================================================
// Checkout (unverändert übernommen: Warenkorb -> je Händler eine Bestellung)
// ===========================================================================

function CheckoutModal({
  open,
  onClose,
  zeilen,
  summe,
  vorbelegung,
  onBestellt,
}: {
  open: boolean;
  onClose: () => void;
  zeilen: { produkt: MarketplaceProduct; menge: number }[];
  summe: number;
  vorbelegung: { kontaktName: string; kontaktEmail: string };
  onBestellt: (orders: MarketplaceOrder[]) => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    kontaktName: '',
    kontaktEmail: '',
    kontaktTelefon: '',
    lieferFirma: '',
    lieferStrasse: '',
    lieferPlz: '',
    lieferOrt: '',
    notiz: '',
  });
  const [sende, setSende] = useState(false);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        kontaktName: f.kontaktName || vorbelegung.kontaktName,
        kontaktEmail: f.kontaktEmail || vorbelegung.kontaktEmail,
      }));
      setFehler('');
    }
  }, [open, vorbelegung.kontaktName, vorbelegung.kontaktEmail]);

  const haendlerAnzahl = new Set(zeilen.map((z) => z.produkt.dealerId)).size;

  async function bestellen() {
    setSende(true);
    setFehler('');
    try {
      const orders = await api.post<MarketplaceOrder[]>('/marketplace/orders', {
        ...form,
        kontaktTelefon: form.kontaktTelefon || undefined,
        lieferFirma: form.lieferFirma || undefined,
        lieferStrasse: form.lieferStrasse || undefined,
        lieferPlz: form.lieferPlz || undefined,
        lieferOrt: form.lieferOrt || undefined,
        notiz: form.notiz || undefined,
        positionen: zeilen.map((z) => ({ productId: z.produkt.id, menge: z.menge })),
      });
      onBestellt(orders);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('marktplatz.checkout.error'));
    } finally {
      setSende(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={t('marktplatz.checkout.title')} size="lg">
      <div className="space-y-5">
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
          {zeilen.map((z) => (
            <div key={z.produkt.id} className="flex items-center justify-between py-1 text-sm">
              <span className="text-chrome-200">
                {z.menge} × {z.produkt.name}
                <span className="ml-2 text-xs text-chrome-500">{z.produkt.haendlerName}</span>
              </span>
              <span className="font-medium text-chrome-100">{eur(Number(z.produkt.preis ?? 0) * z.menge)}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-ink-700 pt-2 text-sm font-semibold">
            <span className="text-chrome-50">{t('marktplatz.checkout.total')}</span>
            <span className="text-copper">{eur(summe)}</span>
          </div>
          {haendlerAnzahl > 1 && (
            <p className="mt-2 text-xs text-chrome-500">{t('marktplatz.checkout.multiDealer', { count: haendlerAnzahl })}</p>
          )}
        </div>

        {fehler && <ErrorBox message={fehler} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.contact')}</span>
            <input className="input" value={form.kontaktName} onChange={set('kontaktName')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.email')}</span>
            <input className="input" type="email" value={form.kontaktEmail} onChange={set('kontaktEmail')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.phone')}</span>
            <input className="input" value={form.kontaktTelefon} onChange={set('kontaktTelefon')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.company')}</span>
            <input className="input" value={form.lieferFirma} onChange={set('lieferFirma')} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.street')}</span>
            <input className="input" value={form.lieferStrasse} onChange={set('lieferStrasse')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.zip')}</span>
            <input className="input" value={form.lieferPlz} onChange={set('lieferPlz')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.city')}</span>
            <input className="input" value={form.lieferOrt} onChange={set('lieferOrt')} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-chrome-400">{t('marktplatz.checkout.note')}</span>
            <textarea className="input min-h-[70px]" value={form.notiz} onChange={set('notiz')} />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={sende}>{t('common.cancel')}</button>
          <button
            className="btn-primary"
            onClick={bestellen}
            disabled={sende || !form.kontaktName.trim() || !form.kontaktEmail.trim()}
          >
            {sende ? t('marktplatz.checkout.sending') : t('marktplatz.checkout.submit', { sum: eur(summe) })}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-chrome-500">{t('marktplatz.checkout.footer')}</p>
      </div>
    </Modal>
  );
}

function Bestellungen({ orders }: { orders: MarketplaceOrder[] | null }) {
  const t = useT();
  if (orders === null) return <Loading />;
  if (orders.length === 0) {
    return (
      <div className="card">
        <Empty text={t('marktplatz.orders.empty')} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const badge = ORDER_STATUS_BADGE[o.status] ?? 'badge-neutral';
        const label = ORDER_STATUS_KEY[o.status] ? t(ORDER_STATUS_KEY[o.status]) : o.status;
        return (
          <div key={o.id} className="card-flush p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-chrome-50">{o.nummer}</span>
                <Badge className={badge}>{label}</Badge>
              </div>
              <div className="text-sm text-chrome-400">
                {o.haendlerName} · {new Date(o.createdAt).toLocaleDateString('de-DE')} ·{' '}
                <strong className="text-chrome-100">{eur(Number(o.summeBrutto))}</strong>
              </div>
            </div>
            {(o.positionen ?? []).length > 0 && (
              <div className="mt-3 border-t border-ink-700/60 pt-2 text-sm text-chrome-300">
                {(o.positionen ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-0.5">
                    <span>{i.menge} × {i.produktName}</span>
                    <span className="text-chrome-400">{eur(Number(i.zeilenSumme))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Händler-Profil (Slide-over)
// ===========================================================================

function HaendlerSlideOver({
  haendler,
  produkte,
  onClose,
  onZumHaendler,
  busyId,
}: {
  haendler: { id: string; name: string; beschreibung?: string; logoUrl?: string; webseite?: string } | null;
  produkte: MarketplaceProduct[];
  onClose: () => void;
  onZumHaendler: (p: MarketplaceProduct) => void;
  busyId: string | null;
}) {
  const t = useT();
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    if (!haendler) return;
    const raf = requestAnimationFrame(() => setSichtbar(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      setSichtbar(false);
    };
  }, [haendler, onClose]);

  if (!haendler) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={haendler.name}>
      <div className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-220 ease-emphasized ${sichtbar ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-850 shadow-pop transition-transform duration-220 ease-emphasized ${sichtbar ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-start gap-3 border-b border-ink-700/70 p-5">
          {haendler.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- externes Händler-Logo, statischer Export
            <img src={haendler.logoUrl} alt={haendler.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-copper-grad font-display text-lg font-bold text-ink-950">
              {haendler.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-chrome-50">{haendler.name}</h2>
            <p className="text-xs text-chrome-500">{t('marktplatz.dealer.productCount', { count: produkte.length })}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50" aria-label={t('common.close')}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {haendler.beschreibung && <p className="text-sm leading-relaxed text-chrome-300">{haendler.beschreibung}</p>}
          {haendler.webseite && (
            <a href={haendler.webseite} target="_blank" rel="noopener noreferrer" className="link-action mt-3 inline-flex items-center gap-1 text-sm">
              {t('marktplatz.dealer.website')} ↗
            </a>
          )}

          <p className="kpi-label mb-3 mt-6">{t('marktplatz.dealer.products')}</p>
          {produkte.length === 0 ? (
            <p className="text-sm text-chrome-500">{t('marktplatz.dealer.noProducts')}</p>
          ) : (
            <div className="space-y-2">
              {produkte.map((p) => {
                const bestellbar = !!p.bestellbar && p.preis != null;
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-2.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink-700/50">
                      <KatalogBild p={p} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-chrome-100">{p.name}</p>
                      <p className="text-xs text-chrome-500">
                        {p.preis != null ? `${p.preisHinweis ? p.preisHinweis + ' ' : ''}${eur(p.preis)}` : t('marktplatz.priceOnRequest')}
                      </p>
                    </div>
                    {p.affiliateUrl ? (
                      <button className="btn-subtle btn-sm shrink-0" disabled={busyId === p.id} onClick={() => onZumHaendler(p)}>
                        {busyId === p.id ? t('marktplatz.opening') : t('marktplatz.toOffer')}
                      </button>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${bestellbar ? 'badge-positive' : 'badge-neutral'}`}>
                        {bestellbar ? t('marktplatz.badge.orderable') : t('marktplatz.badge.atDealer')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
