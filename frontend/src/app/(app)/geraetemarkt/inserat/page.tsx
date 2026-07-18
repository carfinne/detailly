'use client';

// Geraete-Gebrauchtmarkt · Detailseite (?id=). Zeigt ein sichtbares Inserat
// kontaktfrei; der Verkaeufer-Kontakt wird erst nach Klick ueber den auditierten
// Reveal-Endpunkt (GET /geraetemarkt/inserate/:id/kontakt) offengelegt. Der Deal
// laeuft off-app – Detailly wickelt KEINE Zahlung ab.

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { PageHeader, ErrorBox, Loading, SectionCard, Modal, useToast } from '@/components/ui';
import AuthedImage from '@/components/AuthedImage';
import { Icon, ICON_PATHS } from '@/lib/icons';
import {
  GERAETE_MELDE_GRUENDE,
  KATEGORIE_KEY,
  MELDE_GRUND_KEY,
  PREIS_MODUS_KEY,
  ZUSTAND_BADGE,
  ZUSTAND_KEY,
  bildStreamPath,
  regionText,
  type InseratFull,
  type InseratBildRef,
  type KontaktReveal,
  type MeldeGrund,
} from '@/lib/geraetemarkt';

/** Bildergalerie mit grosser Hauptansicht + Thumbnails; sonst Gradient-Fallback. */
function Galerie({ inseratId, bilder, titel }: { inseratId: string; bilder: InseratBildRef[]; titel: string }) {
  const [aktiv, setAktiv] = useState(0);
  if (bilder.length === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-ink-700/50 bg-copper-grad">
        <Icon className="h-16 w-16 text-ink-950/50">{ICON_PATHS.box}</Icon>
      </div>
    );
  }
  const sortiert = [...bilder].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  const gewaehlt = sortiert[Math.min(aktiv, sortiert.length - 1)];
  return (
    <div>
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink-700/50 bg-ink-900">
        <AuthedImage
          path={bildStreamPath(inseratId, gewaehlt.id)}
          alt={titel}
          className="h-full w-full object-cover"
        />
      </div>
      {sortiert.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {sortiert.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setAktiv(i)}
              className={`aspect-square overflow-hidden rounded-lg border transition-colors ${
                i === aktiv ? 'border-copper' : 'border-ink-700/50 hover:border-ink-600'
              }`}
              aria-label={`${titel} – ${i + 1}`}
            >
              <AuthedImage path={bildStreamPath(inseratId, b.id)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kontakt-Reveal-Block: Button -> Endpunkt -> Kontaktdaten + Off-App-Hinweis. */
function KontaktBlock({ inseratId }: { inseratId: string }) {
  const t = useT();
  const [kontakt, setKontakt] = useState<KontaktReveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');

  async function anzeigen() {
    setBusy(true);
    setFehler('');
    try {
      const k = await api.get<KontaktReveal>(`/geraetemarkt/inserate/${inseratId}/kontakt`);
      setKontakt(k);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('geraetemarkt.detail.contactError'));
    } finally {
      setBusy(false);
    }
  }

  if (kontakt) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
          <p className="font-display text-base font-semibold text-chrome-50">{kontakt.betriebsname}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {kontakt.email && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-chrome-500">{t('geraetemarkt.detail.email')}</dt>
                <dd>
                  <a className="link-action" href={`mailto:${kontakt.email}`}>
                    {kontakt.email}
                  </a>
                </dd>
              </div>
            )}
            {kontakt.telefon && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-chrome-500">{t('geraetemarkt.detail.phone')}</dt>
                <dd>
                  <a className="link-action" href={`tel:${kontakt.telefon}`}>
                    {kontakt.telefon}
                  </a>
                </dd>
              </div>
            )}
            {kontakt.anschrift && (
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-chrome-500">{t('geraetemarkt.detail.address')}</dt>
                <dd className="text-right font-medium text-chrome-100">{kontakt.anschrift}</dd>
              </div>
            )}
            {!kontakt.email && !kontakt.telefon && !kontakt.anschrift && (
              <p className="text-chrome-400">{t('geraetemarkt.detail.noContactData')}</p>
            )}
          </dl>
        </div>
        <p className="text-xs leading-relaxed text-chrome-500">{t('geraetemarkt.detail.offAppHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fehler && <ErrorBox message={fehler} />}
      <button className="btn-primary w-full justify-center" onClick={anzeigen} disabled={busy}>
        {busy && <span className="spinner" />}
        {busy ? t('geraetemarkt.detail.contactLoading') : t('geraetemarkt.detail.showContact')}
      </button>
      <p className="text-xs leading-relaxed text-chrome-500">{t('geraetemarkt.detail.revealHint')}</p>
    </div>
  );
}

/**
 * Melden-Block: dezenter „Melden"-Button oeffnet ein Modal mit Grund-Auswahl
 * (inkl. „Chemie/Verbrauchsstoff") + optionalem Kommentar. POST an den
 * serverseitig gedrosselten Melde-Endpunkt; 409 = bereits gemeldet.
 */
function MeldenBlock({ inseratId }: { inseratId: string }) {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [grund, setGrund] = useState<MeldeGrund>('chemie_verboten');
  const [kommentar, setKommentar] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  const [gemeldet, setGemeldet] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler('');
    try {
      await api.post(`/geraetemarkt/inserate/${inseratId}/melden`, {
        grund,
        ...(kommentar.trim() ? { kommentar: kommentar.trim() } : {}),
      });
      setOpen(false);
      setGemeldet(true);
      setKommentar('');
      toast(t('geraetemarkt.melden.success'), { variant: 'copper' });
    } catch (err) {
      // 409 = dieses Inserat wurde vom eigenen Betrieb bereits gemeldet.
      if (err instanceof ApiError && err.status === 409) {
        setGemeldet(true);
        setFehler(t('geraetemarkt.melden.already'));
      } else {
        setFehler(err instanceof Error ? err.message : t('geraetemarkt.melden.error'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFehler('');
          setOpen(true);
        }}
        disabled={gemeldet}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-chrome-500 transition-colors hover:text-caution disabled:cursor-default disabled:opacity-60 disabled:hover:text-chrome-500"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15V3m0 12 5-2 6 2 5-2V3l-5 2-6-2-5 2m0 18v-6" />
        </svg>
        {gemeldet ? t('geraetemarkt.melden.done') : t('geraetemarkt.melden.report')}
      </button>

      <Modal open={open} onClose={() => (busy ? undefined : setOpen(false))} title={t('geraetemarkt.melden.title')} size="sm">
        <form onSubmit={absenden} className="space-y-4">
          <p className="text-sm text-chrome-400">{t('geraetemarkt.melden.intro')}</p>

          <fieldset className="space-y-2">
            <legend className="label mb-1">{t('geraetemarkt.melden.reasonLabel')}</legend>
            {GERAETE_MELDE_GRUENDE.map((g) => (
              <label
                key={g}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                  grund === g ? 'border-copper bg-copper-soft text-chrome-50' : 'border-ink-700 text-chrome-200 hover:border-ink-600'
                }`}
              >
                <input
                  type="radio"
                  name="melde-grund"
                  className="h-4 w-4 accent-copper"
                  checked={grund === g}
                  onChange={() => setGrund(g)}
                />
                {t(MELDE_GRUND_KEY[g])}
              </label>
            ))}
          </fieldset>

          <div className="field">
            <label className="label" htmlFor="melde-kommentar">{t('geraetemarkt.melden.commentLabel')}</label>
            <textarea
              id="melde-kommentar"
              className="input min-h-[80px] resize-y"
              value={kommentar}
              maxLength={1000}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder={t('geraetemarkt.melden.commentPlaceholder')}
            />
          </div>

          {fehler && <ErrorBox message={fehler} />}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <span className="spinner" />}
              {busy ? t('geraetemarkt.melden.sending') : t('geraetemarkt.melden.submit')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function InseratDetail() {
  const t = useT();
  const id = useSearchParams().get('id') ?? '';
  const [inserat, setInserat] = useState<InseratFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    setError('');
    api
      .get<InseratFull>(`/geraetemarkt/${id}`)
      .then(setInserat)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : t('geraetemarkt.error.load'));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;

  if (notFound || !inserat) {
    return (
      <div>
        <PageHeader title={t('geraetemarkt.detail.notFoundTitle')} />
        <SectionCard>
          <p className="text-sm text-chrome-400">{t('geraetemarkt.detail.notFound')}</p>
          <Link href="/geraetemarkt" className="btn-subtle btn-sm mt-4 inline-flex">
            {t('geraetemarkt.detail.backToBrowse')}
          </Link>
        </SectionCard>
      </div>
    );
  }

  // Fremde Projektion enthaelt kein tenantId -> present nur beim eigenen Inserat.
  const istEigenes = inserat.tenantId != null;

  const preisAnzeige =
    inserat.preisModus === 'anfrage' || inserat.preis == null ? (
      <span className="text-chrome-300">{t('geraetemarkt.preisModus.anfrage')}</span>
    ) : (
      <>
        {eur(inserat.preis)}
        {inserat.preisModus === 'vb' && (
          <span className="ml-1.5 text-sm font-normal text-chrome-400">{t('geraetemarkt.preisModus.vbShort')}</span>
        )}
      </>
    );

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/geraetemarkt"
          className="inline-flex items-center gap-1.5 text-sm text-chrome-400 transition-colors hover:text-copper"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('geraetemarkt.detail.backToBrowse')}
        </Link>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Galerie */}
        <div className="animate-fade-in">
          <Galerie inseratId={inserat.id} bilder={inserat.bilder ?? []} titel={inserat.titel} />
        </div>

        {/* Eckdaten + Kontakt */}
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-ink-850 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-chrome-300">
                {t(KATEGORIE_KEY[inserat.kategorie] ?? inserat.kategorie)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ZUSTAND_BADGE[inserat.zustand] ?? 'badge-neutral'}`}
              >
                {t(ZUSTAND_KEY[inserat.zustand] ?? inserat.zustand)}
              </span>
              {inserat.status === 'reserviert' && (
                <span className="inline-flex items-center rounded-full badge-caution px-2 py-0.5 text-[10px] font-medium">
                  {t('geraetemarkt.status.reserviert')}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-chrome-50">{inserat.titel}</h1>
            <p className="mt-2 font-display text-2xl font-bold text-copper">{preisAnzeige}</p>
            {inserat.preisModus !== 'anfrage' && (
              <p className="mt-0.5 text-xs text-chrome-500">
                {t(PREIS_MODUS_KEY[inserat.preisModus] ?? inserat.preisModus)}
              </p>
            )}
          </div>

          <dl className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-4 text-sm">
            {regionText(inserat) && (
              <div className="flex items-center justify-between gap-3 border-b border-ink-700/50 py-2 first:pt-0">
                <dt className="text-chrome-500">{t('geraetemarkt.detail.region')}</dt>
                <dd className="font-medium text-chrome-100">{regionText(inserat)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-2 last:pb-0">
              <dt className="text-chrome-500">{t('geraetemarkt.detail.listedOn')}</dt>
              <dd className="font-medium text-chrome-100">{datum(inserat.createdAt)}</dd>
            </div>
          </dl>

          <SectionCard title={t('geraetemarkt.detail.contactTitle')}>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-copper/20 bg-copper-soft px-3 py-2 text-xs text-copper">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              {t('geraetemarkt.badge.verifiedLong')}
            </div>
            <KontaktBlock inseratId={inserat.id} />
          </SectionCard>
        </div>
      </div>

      {/* Beschreibung (nutzer-gepflegt -> React-Auto-Escape, kein HTML) */}
      <SectionCard title={t('geraetemarkt.detail.descriptionTitle')} className="mt-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-chrome-200">{inserat.beschreibung}</p>
      </SectionCard>

      {/* Fusszeile: Regeln/Rechtshinweise + Melden (nur bei fremden Inseraten) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700/50 pt-4">
        <Link
          href="/geraetemarkt/regeln"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-chrome-500 transition-colors hover:text-copper"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
            <path d="M14 2v6h6M9 13h6M9 17h4" />
          </svg>
          {t('geraetemarkt.rules.link')}
        </Link>
        {!istEigenes && <MeldenBlock inseratId={inserat.id} />}
      </div>
    </div>
  );
}

export default function GeraetemarktDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <InseratDetail />
    </Suspense>
  );
}
