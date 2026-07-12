'use client';

// B2B-Marktplatz: kuratierte Angebote der Partner-Haendler. Zwei Wege je
// Produkt: Kauf BEIM Haendler (Affiliate-Link, Klick wird serverseitig
// gezaehlt) ODER direkte Bestellung in der App (Warenkorb -> je Haendler eine
// Bestellung). Ein Katalog-Request, Filter laufen clientseitig.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { MarketplaceOrder, MarketplaceOrderStatus, MarketplaceProduct } from '@/lib/types';
import { BEREICHE } from '@/lib/labels';
import { PageHeader, Loading, ErrorBox, Empty, Modal, Badge } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

interface KatalogHaendler {
  id: string;
  name: string;
  beschreibung?: string;
  logoUrl?: string;
  webseite?: string;
}

interface Katalog {
  produkte: MarketplaceProduct[];
  haendler: KatalogHaendler[];
  kategorien: string[];
}

/** Sortier-Reihenfolge des Katalogs. */
type Sortierung = 'relevanz' | 'preisAuf' | 'preisAb' | 'neueste';

/** Query-Param, der das Händler-Profil (Slide-over) öffnet – deep-link-fähig. */
const HAENDLER_PARAM = 'haendler';

// Enum->i18n-Key (Rohwert-Fallback via t()). Die Badge-Klassen bleiben lokal
// (kein sichtbarer Text); die Status-Labels werden im Seiten-Namespace gefuehrt.
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

// Bereichs-Labels (labels.ts unangetastet) lokal via Enum->Key mit Rohwert-
// Fallback auf b.label.
const BER_KEY: Record<string, string> = {
  folierung: 'marktplatz.bereich.folierung',
  aufbereitung: 'marktplatz.bereich.aufbereitung',
  ppf: 'marktplatz.bereich.ppf',
  sonstiges: 'marktplatz.bereich.sonstiges',
};

/** Produktbild mit elegantem Fallback (Gradient + Initiale), lazy geladen. */
function ProduktBild({ p }: { p: MarketplaceProduct }) {
  const [kaputt, setKaputt] = useState(false);
  if (!p.bildUrl || kaputt) {
    return (
      <div className="grid h-full w-full place-items-center bg-copper-grad">
        <span className="font-display text-5xl font-bold text-ink-950/70">
          {p.name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- externe Haendler-Bilder, statischer Export
    <img
      src={p.bildUrl}
      alt={p.name}
      loading="lazy"
      onError={() => setKaputt(true)}
      className="h-full w-full object-cover transition-transform duration-220 ease-emphasized group-hover:scale-[1.04]"
    />
  );
}

/** Warenkorb: productId -> Menge. Rein clientseitig bis zum Absenden. */
type Korb = Record<string, number>;

export default function MarktplatzPage() {
  const t = useT();
  const { user } = useAuth();
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState<'katalog' | 'bestellungen'>('katalog');
  const [suche, setSuche] = useState('');
  const [bereich, setBereich] = useState('');
  const [marke, setMarke] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('relevanz');
  const [alleMarken, setAlleMarken] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Händler-Profil (Slide-over) über Query-Param – deep-link- und Back-Button-
  // fähig, ohne useSearchParams (statischer Export braucht sonst eine Suspense-
  // Boundary). Beim ersten Rendern den Param übernehmen, auf Back/Forward hören.
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
    // Eigenen pushState-Eintrag per Back schließen (Back-Button-Parität); bei
    // Deep-Link als erstem Eintrag den Param sauber entfernen.
    if (window.history.state && window.history.state[HAENDLER_PARAM]) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.pathname);
      setHaendlerId(null);
    }
  }, []);

  const [korb, setKorb] = useState<Korb>({});
  const [checkoutOffen, setCheckoutOffen] = useState(false);

  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);

  useEffect(() => {
    api
      .get<Katalog>('/marketplace/catalog')
      .then(setKatalog)
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

  // Zaehler je Bereich (fuer die Tabs); leere Bereiche werden ausgeblendet.
  const bereichCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of alleProdukte) c.set(p.bereich ?? 'sonstiges', (c.get(p.bereich ?? 'sonstiges') ?? 0) + 1);
    return c;
  }, [alleProdukte]);

  // Produkte im gewaehlten Bereich (Basis fuer Marken-Chips + Ergebnis).
  const imBereich = useMemo(
    () => (bereich ? alleProdukte.filter((p) => (p.bereich ?? 'sonstiges') === bereich) : alleProdukte),
    [alleProdukte, bereich],
  );

  // Marken-Schnellfilter: haeufigste zuerst. Volle Liste – der 12er-Deckel wird
  // erst beim Rendern per "alle anzeigen" aufgeloest.
  const marken = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of imBereich) if (p.marke) c.set(p.marke, (c.get(p.marke) ?? 0) + 1);
    return Array.from(c.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .map(([name]) => name);
  }, [imBereich]);
  const MARKEN_DECKEL = 12;
  const sichtbareMarken = alleMarken ? marken : marken.slice(0, MARKEN_DECKEL);

  const produkte = useMemo(() => {
    const term = suche.trim().toLowerCase();
    const gefiltert = imBereich.filter(
      (p) =>
        (!marke || p.marke === marke) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.marke ?? '').toLowerCase().includes(term) ||
          (p.haendlerName ?? '').toLowerCase().includes(term) ||
          (p.beschreibung ?? '').toLowerCase().includes(term)),
    );
    const preisWert = (p: MarketplaceProduct) => (p.preis == null ? null : Number(p.preis));
    const zeit = (p: MarketplaceProduct) => (p.createdAt ? new Date(p.createdAt).getTime() : 0);
    const sortiert = [...gefiltert];
    switch (sortierung) {
      case 'preisAuf': // Produkte ohne festen Preis (Preis beim Händler) ans Ende.
        sortiert.sort((a, b) => (preisWert(a) ?? Infinity) - (preisWert(b) ?? Infinity));
        break;
      case 'preisAb':
        sortiert.sort((a, b) => (preisWert(b) ?? -Infinity) - (preisWert(a) ?? -Infinity));
        break;
      case 'neueste':
        sortiert.sort((a, b) => zeit(b) - zeit(a));
        break;
      default: // 'relevanz' = meiste Klicks zuerst
        sortiert.sort((a, b) => (b.klicks ?? 0) - (a.klicks ?? 0));
    }
    return sortiert;
  }, [imBereich, marke, suche, sortierung]);

  /** Bereichswechsel setzt die Marke zurueck (Marken haengen am Bereich). */
  function waehleBereich(b: string) {
    setBereich(b);
    setMarke('');
    setAlleMarken(false);
  }

  // Offenes Händler-Profil + dessen Produkte (Slide-over).
  const offenerHaendler = useMemo(
    () => (haendlerId ? katalog?.haendler.find((h) => h.id === haendlerId) ?? null : null),
    [haendlerId, katalog],
  );
  const haendlerProdukte = useMemo(
    () => (haendlerId ? alleProdukte.filter((p) => p.dealerId === haendlerId) : []),
    [haendlerId, alleProdukte],
  );
  /** Filter zuruecksetzen (Empty-State "keine Treffer"). */
  function filterZuruecksetzen() {
    setSuche('');
    setMarke('');
    setBereich('');
    setAlleMarken(false);
  }

  const produktById = useMemo(
    () => new Map((katalog?.produkte ?? []).map((p) => [p.id, p])),
    [katalog],
  );

  const korbZeilen = useMemo(
    () =>
      Object.entries(korb)
        .map(([id, menge]) => ({ produkt: produktById.get(id), menge }))
        .filter((z): z is { produkt: MarketplaceProduct; menge: number } => !!z.produkt),
    [korb, produktById],
  );
  const korbSumme = korbZeilen.reduce((s, z) => s + Number(z.produkt.preis ?? 0) * z.menge, 0);
  const korbAnzahl = korbZeilen.reduce((s, z) => s + z.menge, 0);

  function inDenKorb(p: MarketplaceProduct, delta = 1) {
    setKorb((k) => {
      const neu = Math.max(0, (k[p.id] ?? 0) + delta);
      const kopie = { ...k };
      if (neu === 0) delete kopie[p.id];
      else kopie[p.id] = Math.min(999, neu);
      return kopie;
    });
  }

  /** Klick serverseitig zaehlen, dann den Affiliate-Link im neuen Tab oeffnen. */
  async function zumHaendler(p: MarketplaceProduct) {
    setBusyId(p.id);
    try {
      const { affiliateUrl } = await api.post<{ affiliateUrl: string }>(`/marketplace/products/${p.id}/klick`);
      window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('marktplatz.error.link'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('marktplatz.title')}
        subtitle={t('marktplatz.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              className={tab === 'katalog' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
              onClick={() => setTab('katalog')}
            >
              {t('marktplatz.tab.catalog')}
            </button>
            <button
              className={tab === 'bestellungen' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
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
          {/* Sticky Filterleiste: Bereiche + Suche/Sortierung + Marken. Bleibt
              beim Scrollen unter der Topbar (top-14) stehen. */}
          <div className="sticky top-14 z-20 -mx-5 mb-5 border-b border-ink-700/60 bg-ink-900/90 px-5 pb-4 pt-3 backdrop-blur-md md:-mx-7 md:px-7">
            {/* Bereiche – grosse segmentierte Steuerung mit Produkt-Zaehlern */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => waehleBereich('')}
                className={`choice rounded-xl px-4 py-2.5 text-sm font-semibold ${bereich === '' ? 'choice-active' : ''}`}
              >
                {t('marktplatz.bereich.all')} <span className="ml-1 text-xs font-normal opacity-70">{alleProdukte.length}</span>
              </button>
              {BEREICHE.filter((b) => (bereichCounts.get(b.key) ?? 0) > 0).map((b) => (
                <button
                  key={b.key}
                  onClick={() => waehleBereich(b.key)}
                  className={`choice rounded-xl px-4 py-2.5 text-sm font-semibold ${bereich === b.key ? 'choice-active' : ''}`}
                >
                  {BER_KEY[b.key] ? t(BER_KEY[b.key]) : t(b.labelKey)} <span className="ml-1 text-xs font-normal opacity-70">{bereichCounts.get(b.key)}</span>
                </button>
              ))}
            </div>

            {/* Suche + Sortierung */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-lg">
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
              <label className="flex items-center gap-2 text-sm text-chrome-400 sm:ml-auto">
                <span className="whitespace-nowrap">{t('marktplatz.sort.label')}</span>
                <select
                  className="select"
                  value={sortierung}
                  onChange={(e) => setSortierung(e.target.value as Sortierung)}
                >
                  <option value="relevanz">{t('marktplatz.sort.relevanz')}</option>
                  <option value="preisAuf">{t('marktplatz.sort.priceAsc')}</option>
                  <option value="preisAb">{t('marktplatz.sort.priceDesc')}</option>
                  <option value="neueste">{t('marktplatz.sort.newest')}</option>
                </select>
              </label>
            </div>

            {/* Marken – Schnellauswahl mit "alle anzeigen" statt hartem Deckel */}
            {marken.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="kpi-label">{t('marktplatz.marken')}</span>
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
                  <button
                    onClick={() => setAlleMarken((v) => !v)}
                    className="rounded-full px-3 py-1 text-xs font-semibold text-copper transition-colors hover:text-copper-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
                  >
                    {alleMarken
                      ? t('marktplatz.markenShowLess')
                      : t('marktplatz.markenShowAll', { count: marken.length })}
                  </button>
                )}
              </div>
            )}
          </div>

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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {produkte.map((p) => {
                const imKorb = korb[p.id] ?? 0;
                const bestellbar = !!p.bestellbar && p.preis != null;
                const bereichKey = p.bereich ?? 'sonstiges';
                const bereichLabel = BER_KEY[bereichKey]
                  ? t(BER_KEY[bereichKey])
                  : t(BEREICHE.find((b) => b.key === bereichKey)?.labelKey ?? bereichKey);
                return (
                  <div
                    key={p.id}
                    className="group card-flush flex flex-col overflow-hidden transition-transform duration-180 ease-emphasized hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden border-b border-ink-700/50">
                      <ProduktBild p={p} />
                      <span className="absolute left-2 top-2 rounded-md bg-ink-950/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chrome-100 backdrop-blur-sm">
                        {bereichLabel}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">
                        {p.marke || bereichLabel}
                      </span>
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50">{p.name}</h3>
                      <button
                        type="button"
                        onClick={() => oeffneHaendler(p.dealerId)}
                        className="self-start text-left text-xs text-chrome-500 transition-colors hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50 rounded"
                        aria-label={t('marktplatz.dealer.viewProfile')}
                      >
                        {p.haendlerName}
                      </button>
                      <span
                        className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          bestellbar ? 'badge-positive' : 'badge-neutral'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${bestellbar ? 'bg-positive' : 'bg-chrome-500'}`} />
                        {bestellbar ? t('marktplatz.badge.orderable') : t('marktplatz.badge.atDealer')}
                      </span>
                      <p className="mt-auto pt-2 text-sm font-semibold text-chrome-100">
                        {p.preis != null ? (
                          <>
                            {p.preisHinweis ? `${p.preisHinweis} ` : ''}
                            {eur(p.preis)}
                          </>
                        ) : (
                          <span className="font-normal text-chrome-500">{t('marktplatz.priceOnRequest')}</span>
                        )}
                      </p>
                      {bestellbar &&
                        (imKorb === 0 ? (
                          <button className="btn-primary btn-sm mt-2 w-full justify-center" onClick={() => inDenKorb(p)}>
                            {t('marktplatz.addToCart')}
                          </button>
                        ) : (
                          <div className="mt-2 flex items-center justify-between rounded-lg border border-copper/40 bg-copper-soft px-2 py-1">
                            <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.decrease')} onClick={() => inDenKorb(p, -1)}>−</button>
                            <span className="text-sm font-semibold text-copper">{t('marktplatz.inCart', { count: imKorb })}</span>
                            <button className="btn-ghost btn-sm px-2" aria-label={t('marktplatz.increase')} onClick={() => inDenKorb(p, +1)}>+</button>
                          </div>
                        ))}
                      {p.affiliateUrl && (
                        <button
                          className={`${bestellbar ? 'btn-subtle' : 'btn-primary'} btn-sm mt-2 w-full justify-center`}
                          disabled={busyId === p.id}
                          onClick={() => zumHaendler(p)}
                        >
                          {busyId === p.id ? t('marktplatz.opening') : t('marktplatz.toOffer')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                <button className="btn-primary btn-sm" onClick={() => setCheckoutOffen(true)}>
                  {t('marktplatz.cart.checkout')}
                </button>
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
              setOrders(null); // beim naechsten Tab-Wechsel frisch laden
              setTab('bestellungen');
              setOrders(neu.concat([])); // sofort anzeigen
              ladeBestellungen(); // und im Hintergrund komplett aktualisieren
            }}
          />
        </>
      )}

      {/* Händler-Profil als Slide-over (Query-Param-gesteuert) */}
      <HaendlerSlideOver
        haendler={offenerHaendler}
        produkte={haendlerProdukte}
        onClose={schliesseHaendler}
        onZumHaendler={zumHaendler}
        busyId={busyId}
      />
    </div>
  );
}

/** Animiertes Lade-Skeleton, das das spätere Katalog-Raster spiegelt. */
function KatalogSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-28" />
        ))}
      </div>
      <div className="skeleton mb-5 h-10 w-full max-w-lg" />
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

/** Einladender Empty-State, wenn der Katalog (noch) leer ist. */
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

  // Kontakt aus dem angemeldeten Nutzer vorbelegen, sobald das Modal aufgeht.
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
        // Leere optionale Felder nicht mitsenden (Whitelist-Validierung bleibt happy).
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
        {/* Zusammenfassung */}
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
            <p className="mt-2 text-xs text-chrome-500">
              {t('marktplatz.checkout.multiDealer', { count: haendlerAnzahl })}
            </p>
          )}
        </div>

        {fehler && <ErrorBox message={fehler} />}

        {/* Kontakt + Lieferung */}
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
        <p className="text-xs leading-relaxed text-chrome-500">
          {t('marktplatz.checkout.footer')}
        </p>
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

/**
 * Händler-Profil als Slide-over von rechts: Logo/Initiale, Beschreibung,
 * Webseite-Link und die Produkte des Händlers. Wird nur gerendert, wenn ein
 * Händler gewählt ist (Query-Param); Einblenden per Transition, Escape/Backdrop
 * schließt.
 */
function HaendlerSlideOver({
  haendler,
  produkte,
  onClose,
  onZumHaendler,
  busyId,
}: {
  haendler: KatalogHaendler | null;
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
      <div
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-220 ease-emphasized ${sichtbar ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-850 shadow-pop transition-transform duration-220 ease-emphasized ${sichtbar ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Kopf: Logo/Initiale + Name */}
        <div className="flex items-start gap-3 border-b border-ink-700/70 p-5">
          {haendler.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- externes Haendler-Logo, statischer Export
            <img src={haendler.logoUrl} alt={haendler.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-copper-grad font-display text-lg font-bold text-ink-950">
              {haendler.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-chrome-50">{haendler.name}</h2>
            <p className="text-xs text-chrome-500">
              {t('marktplatz.dealer.productCount', { count: produkte.length })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inhalt: Beschreibung, Webseite, Produkte */}
        <div className="flex-1 overflow-y-auto p-5">
          {haendler.beschreibung && (
            <p className="text-sm leading-relaxed text-chrome-300">{haendler.beschreibung}</p>
          )}
          {haendler.webseite && (
            <a
              href={haendler.webseite}
              target="_blank"
              rel="noopener noreferrer"
              className="link-action mt-3 inline-flex items-center gap-1 text-sm"
            >
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
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-2.5"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-ink-700/50">
                      <ProduktBild p={p} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-chrome-100">{p.name}</p>
                      <p className="text-xs text-chrome-500">
                        {p.preis != null
                          ? `${p.preisHinweis ? p.preisHinweis + ' ' : ''}${eur(p.preis)}`
                          : t('marktplatz.priceOnRequest')}
                      </p>
                    </div>
                    {p.affiliateUrl ? (
                      <button
                        className="btn-subtle btn-sm shrink-0"
                        disabled={busyId === p.id}
                        onClick={() => onZumHaendler(p)}
                      >
                        {busyId === p.id ? t('marktplatz.opening') : t('marktplatz.toOffer')}
                      </button>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          bestellbar ? 'badge-positive' : 'badge-neutral'
                        }`}
                      >
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
