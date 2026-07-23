'use client';

// Oeffentliche Schaufenster-Seite (Vorher/Nachher-Referenzen eines Betriebs).
// KEIN Login: der Zugang ist der Betriebs-Slug (?b=slug) fuer die Galerie bzw.
// zusaetzlich ein shareToken (&item=token) fuer eine einzelne Referenz. Statischer
// Export -> Parameter clientseitig aus window.location gelesen (keine [slug]-Route).
// Payload ist PII-frei (Whitelist im Backend); Bilder kommen ueber den token-
// scoped Public-Endpunkt (plain <img src>, keine Auth). Mobiloptimiert.

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, absoluteApiUrl } from '@/lib/api';
import { PublicShell } from '@/components/PublicShell';
import { PublicLegalFooter } from '@/components/PublicLegalFooter';
import { LoadingCard } from '@/components/ui';
import { useT } from '@/lib/i18n';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';

type Gewerk = 'folie' | 'aufbereitung' | 'ppf';

interface PublicItem {
  shareToken: string;
  titel: string;
  beschreibung: string | null;
  gewerk: Gewerk;
  bildVorher: string;
  bildNachher: string;
}
interface Betrieb {
  name: string;
  logoUrl: string | null;
}
interface GalleryResponse {
  betrieb: Betrieb;
  items: PublicItem[];
}
interface ItemResponse {
  betrieb: Betrieb;
  item: PublicItem;
}

/** Liest ?b=slug und optional &item=token aus der URL (statischer Export). */
function readParams(): { slug: string; item: string } {
  if (typeof window === 'undefined') return { slug: '', item: '' };
  const q = new URLSearchParams(window.location.search);
  return { slug: q.get('b')?.trim() ?? '', item: q.get('item')?.trim() ?? '' };
}

export default function SchaufensterPublicPage() {
  const t = useT();
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    const { slug: s, item } = readParams();
    setSlug(s);
    if (!s) {
      setLoading(false);
      setLoadError(t('schaufenster.public.missingSlug'));
      return;
    }
    const fail = (e: unknown) =>
      setLoadError(
        e instanceof ApiError && e.status === 404
          ? t('schaufenster.public.notFound')
          : t('schaufenster.public.loadError'),
      );

    if (item) {
      // Einzelne Referenz (Deep-Link).
      api
        .get<ItemResponse>(`/public/schaufenster/${encodeURIComponent(s)}/${encodeURIComponent(item)}`)
        .then((res) => {
          setBetrieb(res.betrieb);
          setItems([res.item]);
        })
        .catch(fail)
        .finally(() => setLoading(false));
    } else {
      // Ganze Galerie.
      api
        .get<GalleryResponse>(`/public/schaufenster/${encodeURIComponent(s)}`)
        .then((res) => {
          setBetrieb(res.betrieb);
          setItems(res.items);
        })
        .catch(fail)
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heading = useMemo(
    () => (betrieb?.name ? t('schaufenster.public.by', { betrieb: betrieb.name }) : t('schaufenster.public.headline')),
    [betrieb, t],
  );

  return (
    <PublicShell width="wide" raster>
      {loading ? (
        <LoadingCard />
      ) : loadError ? (
        <div role="alert" className="card mx-auto max-w-lg text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm text-chrome-300">{loadError}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 text-center">
            {betrieb?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={betrieb.logoUrl} alt={betrieb.name} className="mx-auto mb-4 h-14 w-auto object-contain" />
            )}
            <p className="text-xs font-medium uppercase tracking-wider text-copper-300">
              {t('schaufenster.public.headline')}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-chrome-50">{heading}</h1>
            <p className="mt-2 text-sm text-chrome-400">{t('schaufenster.public.subtitle')}</p>
          </header>

          {items.length === 0 ? (
            <div className="card mx-auto max-w-lg text-center">
              <p className="text-sm text-chrome-400">{t('schaufenster.public.empty')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {items.map((item) => (
                <article key={item.shareToken} className="card flex flex-col gap-4">
                  <BeforeAfterSlider
                    before={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={absoluteApiUrl(item.bildVorher)} alt={t('schaufenster.preview.before')} className="h-full w-full object-cover" loading="lazy" />
                    }
                    after={
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={absoluteApiUrl(item.bildNachher)} alt={t('schaufenster.preview.after')} className="h-full w-full object-cover" loading="lazy" />
                    }
                    beforeLabel={t('schaufenster.preview.before')}
                    afterLabel={t('schaufenster.preview.after')}
                    ariaLabel={t('schaufenster.slider.aria')}
                    handleLabel={t('schaufenster.slider.handle')}
                  />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-copper-300">
                      {t(`schaufenster.gewerk.${item.gewerk}`)}
                    </p>
                    <h2 className="mt-0.5 font-display text-lg font-semibold text-chrome-50">{item.titel}</h2>
                    {item.beschreibung && <p className="mt-1 text-sm text-chrome-300">{item.beschreibung}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}

          <PublicLegalFooter slug={slug} />
        </div>
      )}
    </PublicShell>
  );
}
