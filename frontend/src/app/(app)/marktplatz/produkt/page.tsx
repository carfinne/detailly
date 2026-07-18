'use client';

// Produktdetailseite des B2B-Marktplatzes (statischer Export, Query-Param ?id=).
// NUR Anzeige: Galerie, Beschreibung, Anwendung/Technik, Hersteller+Flagge,
// Inhalt/Versand/Bestand, SDB-Download, Bewertungen (Schreiben folgt PR6) und
// verwandte Produkte. Produkt-Texte sind händler-gepflegt -> React-Auto-Escape
// (kein dangerouslySetInnerHTML); Bild-/SDB-Streams über die authentifizierten
// Buy-Side-Routen.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, downloadAuthed, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { useT, useLanguage } from '@/lib/i18n';
import { BEREICHE } from '@/lib/labels';
import { Loading, ErrorBox, ConfirmDialog, useToast } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import type {
  MarketplaceCatalog,
  MarketplaceCategoryNode,
  MarketplaceProduct,
  MarketplaceProductDetail,
} from '@/lib/types';
import {
  BER_KEY,
  BESTAND_BADGE,
  BESTAND_KEY,
  GradientFallback,
  Herkunft,
  KatalogBild,
  Sterne,
  StreamBild,
  bildPfad,
  preisWert,
  useViewNav,
} from '../shared';
import { addToKorb } from '../cart-store';

function bereichLabelKey(bereich?: string | null): string {
  const key = bereich ?? 'sonstiges';
  return BER_KEY[key] ?? BEREICHE.find((b) => b.key === key)?.labelKey ?? key;
}

function Produktdetail() {
  const t = useT();
  const { lang } = useLanguage();
  const toast = useToast();
  const nav = useViewNav();
  const id = useSearchParams().get('id') ?? '';

  const [detail, setDetail] = useState<MarketplaceProductDetail | null>(null);
  const [katalog, setKatalog] = useState<MarketplaceCatalog | null>(null);
  const [kategorien, setKategorien] = useState<MarketplaceCategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aktionsFehler, setAktionsFehler] = useState('');
  const [aktivBild, setAktivBild] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(t('marktplatz.detail.missingId'));
      return;
    }
    let aktiv = true;
    setLoading(true);
    setAktivBild(0);
    Promise.all([
      api.get<MarketplaceProductDetail>(`/marketplace/products/${id}`),
      api.get<MarketplaceCatalog>('/marketplace/catalog').catch(() => null),
      api.get<MarketplaceCategoryNode[]>('/marketplace/categories').catch(() => []),
    ])
      .then(([d, k, c]) => {
        if (!aktiv) return;
        setDetail(d);
        setKatalog(k);
        setKategorien(c ?? []);
        setError('');
      })
      .catch((e) => {
        if (!aktiv) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? t('marktplatz.detail.notFound')
            : e instanceof Error
              ? e.message
              : t('marktplatz.detail.error'),
        );
      })
      .finally(() => aktiv && setLoading(false));
    return () => {
      aktiv = false;
    };
  }, [id, t]);

  // Nach einer Bewertungs-Aktion nur das Detail neu laden (Liste + Aggregat +
  // kannBewerten/eigeneBewertung kommen frisch vom Server).
  const reloadDetail = useCallback(async () => {
    if (!id) return;
    const d = await api.get<MarketplaceProductDetail>(`/marketplace/products/${id}`);
    setDetail(d);
  }, [id]);

  // Kategorie (Name + SDB-Pflicht) aus der flachen Taxonomie auflösen.
  const kategorie = useMemo(() => {
    if (!detail?.categoryId) return null;
    for (const h of kategorien) {
      if (h.id === detail.categoryId) return h;
      for (const u of h.unterkategorien ?? []) if (u.id === detail.categoryId) return u;
    }
    return null;
  }, [detail, kategorien]);

  // Verwandte Produkte: gleiche Kategorie, sonst gleicher Bereich (ohne sich selbst).
  const verwandte = useMemo(() => {
    if (!katalog || !detail) return [];
    const andere = katalog.produkte.filter((p) => p.id !== detail.id);
    const gleicheKat = detail.categoryId
      ? andere.filter((p) => p.categoryId === detail.categoryId)
      : [];
    let rel = gleicheKat;
    if (rel.length < 4) {
      const ids = new Set(rel.map((p) => p.id));
      rel = [...rel, ...andere.filter((p) => p.bereich === detail.bereich && !ids.has(p.id))];
    }
    return rel.slice(0, 8);
  }, [katalog, detail]);

  if (loading) return <Loading />;
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <ZurueckLink t={t} />
        <ErrorBox message={error || t('marktplatz.detail.error')} />
      </div>
    );
  }

  const bilder = detail.bilder ?? [];
  const hatGalerie = bilder.length > 0;
  const bestellbar = !!detail.bestellbar && detail.preis != null;
  const preis = preisWert(detail);
  const bestand = detail.bestandStatus;
  const flagName = bereichLabelKey(detail.bereich);
  const versand = detail.versandKosten == null ? null : Number(detail.versandKosten);

  async function ladeSdb() {
    setAktionsFehler('');
    try {
      await downloadAuthed(
        `/marketplace/products/${detail!.id}/sdb`,
        `sicherheitsdatenblatt-${detail!.name}.pdf`,
      );
    } catch (e) {
      setAktionsFehler(e instanceof Error ? e.message : t('marktplatz.detail.sdbError'));
    }
  }

  function inDenKorb() {
    addToKorb(detail!.id, 1);
    toast(t('marktplatz.detail.addedToCart'), { variant: 'copper' });
  }

  async function zumHaendler() {
    setBusy(true);
    setAktionsFehler('');
    try {
      const { affiliateUrl } = await api.post<{ affiliateUrl: string }>(
        `/marketplace/products/${detail!.id}/klick`,
      );
      window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setAktionsFehler(e instanceof Error ? e.message : t('marktplatz.error.link'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ZurueckLink t={t} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Galerie */}
        <div>
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-ink-700/60 bg-ink-900/40"
            style={{ viewTransitionName: `mp-${detail.id}` }}
          >
            {detail.istHighlight && (
              <span className="absolute left-0 top-4 z-10 rounded-r-full bg-copper-grad px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-950 shadow-pop">
                {t('marktplatz.highlight')}
              </span>
            )}
            {hatGalerie ? (
              <StreamBild
                key={bilder[aktivBild]?.id}
                path={bildPfad(detail.id, bilder[aktivBild].id)}
                alt={detail.name}
                eager
                className="h-full w-full object-cover"
                fallback={<GradientFallback text={detail.name} />}
              />
            ) : detail.bildUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- externes Händler-Bild, statischer Export
              <img src={detail.bildUrl} alt={detail.name} className="h-full w-full object-cover" />
            ) : (
              <GradientFallback text={detail.name} />
            )}
          </div>
          {hatGalerie && bilder.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {bilder.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setAktivBild(i)}
                  className={`relative h-16 w-16 overflow-hidden rounded-lg border transition-colors ${
                    i === aktivBild
                      ? 'border-copper ring-2 ring-copper/40'
                      : 'border-ink-700/60 hover:border-ink-600'
                  }`}
                  aria-label={t('marktplatz.detail.showImage', { n: i + 1 })}
                  aria-pressed={i === aktivBild}
                >
                  <StreamBild
                    path={bildPfad(detail.id, b.id)}
                    alt={t('marktplatz.detail.showImage', { n: i + 1 })}
                    className="h-full w-full object-cover"
                    fallback={<GradientFallback text={detail.name} />}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Kopf + Kaufbox */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ink-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-chrome-300">
              {t(flagName)}
            </span>
            {kategorie && (
              <span className="text-xs text-chrome-500">{kategorie.name}</span>
            )}
          </div>

          {detail.marke && (
            <span className="text-xs font-semibold uppercase tracking-wide text-copper">
              {detail.marke}
            </span>
          )}
          <h1 className="font-display text-2xl font-bold leading-tight text-chrome-50">{detail.name}</h1>

          <div className="flex flex-wrap items-center gap-3">
            <Sterne
              schnitt={detail.bewertungSchnitt ?? 0}
              anzahl={detail.bewertungAnzahl ?? 0}
              label={t('marktplatz.rating.aria', {
                schnitt: (detail.bewertungSchnitt ?? 0).toFixed(1),
                anzahl: detail.bewertungAnzahl ?? 0,
              })}
            />
            {detail.herkunftsland && (
              <Herkunft iso={detail.herkunftsland} lang={lang} className="text-sm text-chrome-400" />
            )}
          </div>

          {/* Händler */}
          <Link
            href={`/marktplatz?haendler=${encodeURIComponent(detail.dealerId)}`}
            className="inline-flex w-fit items-center gap-2 text-sm text-chrome-400 transition-colors hover:text-copper"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-copper-soft font-display text-xs font-bold text-copper">
              {(detail.haendler?.name ?? detail.haendlerName ?? '?').charAt(0).toUpperCase()}
            </span>
            {detail.haendler?.name ?? detail.haendlerName}
          </Link>

          {/* Preis + Bestand */}
          <div className="rounded-2xl border border-ink-700/60 bg-ink-900/40 p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                {preis != null ? (
                  <>
                    {detail.preisHinweis && (
                      <span className="mr-1 text-xs text-chrome-500">{detail.preisHinweis}</span>
                    )}
                    <span className="font-display text-2xl font-bold text-chrome-50">{eur(preis)}</span>
                  </>
                ) : (
                  <span className="text-lg font-semibold text-chrome-400">
                    {t('marktplatz.priceOnRequest')}
                  </span>
                )}
                {detail.inhaltMenge && (
                  <p className="mt-1 text-xs text-chrome-500">{detail.inhaltMenge}</p>
                )}
              </div>
              {bestand && (
                <span className={`badge ${BESTAND_BADGE[bestand]} shrink-0`}>
                  {t(BESTAND_KEY[bestand])}
                </span>
              )}
            </div>

            {aktionsFehler && <ErrorBox message={aktionsFehler} className="mt-4" withGame={false} />}

            <div className="mt-4 flex flex-col gap-2">
              {bestellbar && (
                <button
                  className="btn-primary w-full justify-center"
                  onClick={inDenKorb}
                  disabled={bestand === 'ausverkauft'}
                >
                  {bestand === 'ausverkauft'
                    ? t('marktplatz.bestand.ausverkauft')
                    : t('marktplatz.addToCart')}
                </button>
              )}
              {detail.affiliateUrl && (
                <button
                  className={`${bestellbar ? 'btn-subtle' : 'btn-primary'} w-full justify-center`}
                  onClick={zumHaendler}
                  disabled={busy}
                >
                  {busy ? t('marktplatz.opening') : t('marktplatz.toOffer')}
                </button>
              )}
            </div>

            {/* SDB */}
            {detail.hatSdb ? (
              <button
                className="btn-ghost mt-3 w-full justify-center gap-2 border border-ink-700/60"
                onClick={ladeSdb}
              >
                <Icon className="h-4 w-4">{ICON_PATHS.invoices}</Icon>
                {t('marktplatz.detail.sdbDownload')}
              </button>
            ) : kategorie?.sdbPflicht ? (
              <p className="mt-3 text-xs text-chrome-500">{t('marktplatz.detail.sdbPending')}</p>
            ) : null}
          </div>

          {/* Versand-/Lieferfakten */}
          {(versand != null || detail.lieferzeitTage != null || detail.versandHinweis) && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {versand != null && (
                <Fakt label={t('marktplatz.detail.shipping')} value={versand === 0 ? t('marktplatz.detail.freeShipping') : eur(versand)} />
              )}
              {detail.lieferzeitTage != null && (
                <Fakt label={t('marktplatz.detail.deliveryTime')} value={t('marktplatz.detail.days', { n: detail.lieferzeitTage })} />
              )}
              {detail.versandHinweis && (
                <div className="col-span-2 text-xs text-chrome-500">{detail.versandHinweis}</div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Beschreibung / Anwendung / Technik */}
      <div className="grid gap-4 md:grid-cols-2">
        {detail.beschreibung && (
          <InfoKarte title={t('marktplatz.detail.description')} text={detail.beschreibung} />
        )}
        {detail.anwendungshinweise && (
          <InfoKarte title={t('marktplatz.detail.usage')} text={detail.anwendungshinweise} />
        )}
        {detail.technischeDaten && Object.keys(detail.technischeDaten).length > 0 && (
          <TechnischeKarte title={t('marktplatz.detail.techData')} daten={detail.technischeDaten} />
        )}
      </div>

      {/* Bewertungen (nur Anzeige) */}
      <section className="card-flush">
        <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-chrome-50">
            {t('marktplatz.detail.reviews')}
          </h2>
          {(detail.bewertungAnzahl ?? 0) > 0 && (
            <Sterne
              schnitt={detail.bewertungSchnitt ?? 0}
              anzahl={detail.bewertungAnzahl ?? 0}
              label={t('marktplatz.rating.aria', {
                schnitt: (detail.bewertungSchnitt ?? 0).toFixed(1),
                anzahl: detail.bewertungAnzahl ?? 0,
              })}
            />
          )}
        </header>
        <div className="space-y-5 p-5">
          {/* Schreiben/Bearbeiten (nur verifizierte Käufer) bzw. dezenter Hinweis. */}
          <BewertungForm
            key={detail.eigeneBewertung ? 'eigen' : 'neu'}
            detail={detail}
            onChanged={reloadDetail}
            t={t}
          />
          {(detail.bewertungen ?? []).length === 0 ? (
            <p className="text-sm text-chrome-500">{t('marktplatz.detail.noReviews')}</p>
          ) : (
            <ul className="space-y-4">
              {(detail.bewertungen ?? []).map((r, i) => (
                <li key={i} className="border-b border-ink-700/40 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sterne
                      schnitt={r.sterne}
                      anzahl={1}
                      compact
                      label={t('marktplatz.rating.stars', { n: r.sterne })}
                    />
                    {r.verifiziert && (
                      <span className="badge badge-positive gap-1">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {t('marktplatz.detail.verifiedPurchase')}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-chrome-500">{datum(r.createdAt)}</span>
                  </div>
                  {r.text && <p className="mt-2 text-sm leading-relaxed text-chrome-300">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Verwandte Produkte */}
      {verwandte.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-base font-semibold text-chrome-50">
            {t('marktplatz.detail.related')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {verwandte.map((p) => (
              <VerwandtCard key={p.id} p={p} nav={nav} t={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bewertung schreiben/bearbeiten – nur verifizierte Käufer (server-durchgesetzt).
// Text wird von React auto-escaped (kein dangerouslySetInnerHTML).
// ---------------------------------------------------------------------------

function StarSelect({
  value,
  onChange,
  t,
}: {
  value: number;
  onChange: (n: number) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={t('marktplatz.bewertung.stars')} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t('marktplatz.bewertung.starLabel', { n })}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-7 w-7 ${n <= shown ? 'text-copper' : 'text-ink-600'}`}
            fill="currentColor"
          >
            <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function BewertungForm({
  detail,
  onChanged,
  t,
}: {
  detail: MarketplaceProductDetail;
  onChanged: () => Promise<void> | void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const toast = useToast();
  const eigene = detail.eigeneBewertung ?? null;
  const [editing, setEditing] = useState(false);
  const [sterne, setSterne] = useState(eigene?.sterne ?? 0);
  const [text, setText] = useState(eigene?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  // Nicht-Käufer ohne eigene Bewertung: dezenter Hinweis, KEIN Formular.
  if (!eigene && !detail.kannBewerten) {
    return <p className="text-sm text-chrome-500">{t('marktplatz.bewertung.hint.notBuyer')}</p>;
  }

  async function submit() {
    if (sterne < 1) {
      setFehler(t('marktplatz.bewertung.chooseStars'));
      return;
    }
    setBusy(true);
    setFehler('');
    try {
      const body = { sterne, text: text.trim() || undefined };
      if (eigene) await api.put(`/marketplace/products/${detail.id}/reviews`, body);
      else await api.post(`/marketplace/products/${detail.id}/reviews`, body);
      setEditing(false);
      toast(t('marktplatz.bewertung.saved'), { variant: 'positive' });
      await onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('marktplatz.bewertung.error'));
    } finally {
      setBusy(false);
    }
  }

  async function loeschen() {
    setDelBusy(true);
    setFehler('');
    try {
      await api.delete(`/marketplace/products/${detail.id}/reviews`);
      setConfirmOpen(false);
      toast(t('marktplatz.bewertung.deleted'), { variant: 'copper' });
      await onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('marktplatz.bewertung.error'));
      setConfirmOpen(false);
    } finally {
      setDelBusy(false);
    }
  }

  // Eigene Bewertung vorhanden und NICHT im Bearbeiten-Modus: Anzeige + Aktionen.
  if (eigene && !editing) {
    return (
      <div className="rounded-2xl border border-copper/30 bg-copper-soft/30 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-copper">
            {t('marktplatz.bewertung.yourReview')}
          </span>
          <Sterne
            schnitt={eigene.sterne}
            anzahl={1}
            compact
            label={t('marktplatz.rating.stars', { n: eigene.sterne })}
          />
          {eigene.verifiziert && (
            <span className="badge badge-positive gap-1">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {t('marktplatz.detail.verifiedPurchase')}
            </span>
          )}
        </div>
        {eigene.text && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-chrome-300">{eigene.text}</p>
        )}
        {fehler && <ErrorBox message={fehler} className="mt-3" withGame={false} />}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-subtle"
            onClick={() => {
              setSterne(eigene.sterne);
              setText(eigene.text ?? '');
              setFehler('');
              setEditing(true);
            }}
          >
            {t('marktplatz.bewertung.edit')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirmOpen(true)}>
            {t('marktplatz.bewertung.delete')}
          </button>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title={t('marktplatz.bewertung.delete')}
          message={t('marktplatz.bewertung.deleteConfirm')}
          confirmLabel={t('marktplatz.bewertung.delete')}
          busy={delBusy}
          onConfirm={loeschen}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  // Formular (neue Bewertung ODER Bearbeiten der eigenen).
  return (
    <div className="rounded-2xl border border-ink-700/60 bg-ink-900/40 p-4">
      <p className="mb-3 text-sm font-semibold text-chrome-100">
        {eigene ? t('marktplatz.bewertung.editTitle') : t('marktplatz.bewertung.title')}
      </p>
      <StarSelect value={sterne} onChange={setSterne} t={t} />
      <label className="mt-3 block text-xs text-chrome-500" htmlFor="bewertung-text">
        {t('marktplatz.bewertung.text')}
      </label>
      <textarea
        id="bewertung-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t('marktplatz.bewertung.placeholder')}
        className="mt-1 w-full rounded-xl border border-ink-700/60 bg-ink-950/40 px-3 py-2 text-sm text-chrome-100 placeholder:text-chrome-600 focus:border-copper focus:outline-none"
      />
      {fehler && <ErrorBox message={fehler} className="mt-3" withGame={false} />}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
          {busy && <span className="spinner" />}
          {busy
            ? t('marktplatz.bewertung.submitting')
            : eigene
              ? t('marktplatz.bewertung.save')
              : t('marktplatz.bewertung.submit')}
        </button>
        {eigene && (
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
            {t('marktplatz.bewertung.cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

function ZurueckLink({ t }: { t: (k: string) => string }) {
  return (
    <Link
      href="/marktplatz"
      className="inline-flex items-center gap-1.5 text-sm text-chrome-400 transition-colors hover:text-copper"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {t('marktplatz.detail.back')}
    </Link>
  );
}

function Fakt({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700/50 bg-ink-900/30 px-3 py-2">
      <dt className="text-xs text-chrome-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-chrome-100">{value}</dd>
    </div>
  );
}

function InfoKarte({ title, text }: { title: string; text: string }) {
  return (
    <section className="card-flush p-5">
      <h2 className="mb-2 font-display text-base font-semibold text-chrome-50">{title}</h2>
      {/* whitespace-pre-line bewahrt Zeilenumbrüche; Text wird von React escaped. */}
      <p className="whitespace-pre-line text-sm leading-relaxed text-chrome-300">{text}</p>
    </section>
  );
}

/**
 * Technische Daten als Merkmal->Wert-Liste (flaches Objekt aus der Entity/simple-json).
 * Keys und Werte werden von React auto-escaped (kein HTML/XSS).
 */
function TechnischeKarte({
  title,
  daten,
}: {
  title: string;
  daten: Record<string, string | number | boolean>;
}) {
  return (
    <section className="card-flush p-5">
      <h2 className="mb-2 font-display text-base font-semibold text-chrome-50">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-4 text-sm sm:grid-cols-2">
        {Object.entries(daten).map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-3 border-b border-ink-700/40 py-1.5 last:border-0"
          >
            <dt className="text-chrome-500">{k}</dt>
            <dd className="text-right font-medium text-chrome-200">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function VerwandtCard({
  p,
  nav,
  t,
}: {
  p: MarketplaceProduct;
  nav: (href: string) => void;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  const href = `/marktplatz/produkt?id=${encodeURIComponent(p.id)}`;
  const preis = preisWert(p);
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        nav(href);
      }}
      className="group card-flush flex flex-col overflow-hidden transition-transform duration-180 ease-emphasized hover:-translate-y-0.5"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden border-b border-ink-700/50"
        style={{ viewTransitionName: `mp-${p.id}` }}
      >
        <KatalogBild p={p} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {p.marke && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-copper">{p.marke}</span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50">{p.name}</h3>
        <p className="mt-auto pt-1 text-sm font-semibold text-chrome-100">
          {preis != null ? eur(preis) : <span className="font-normal text-chrome-500">{t('marktplatz.priceOnRequest')}</span>}
        </p>
      </div>
    </Link>
  );
}

export default function ProduktDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Produktdetail />
    </Suspense>
  );
}
