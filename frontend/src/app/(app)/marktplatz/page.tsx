'use client';

// B2B-Marktplatz: kuratierte Angebote der Partner-Haendler. Aufgebaut fuer
// SCHNELLES Finden: grosse Bereichs-Tabs (Folierung / Aufbereitung / PPF) ->
// Marken-Chips -> Suche. Ein Katalog-Request, alle Filter clientseitig ->
// sofortige Reaktion. Der Kauf passiert beim Haendler (Affiliate-Link,
// serverseitig gezaehlt).

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { MarketplaceProduct } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty } from '@/components/ui';

interface Katalog {
  produkte: MarketplaceProduct[];
  haendler: { id: string; name: string }[];
}

/** Feste Bereiche = Haupt-Navigation (Reihenfolge = Anzeige). */
const BEREICHE: { key: string; label: string }[] = [
  { key: 'folierung', label: 'Folierung' },
  { key: 'aufbereitung', label: 'Aufbereitung' },
  { key: 'ppf', label: 'PPF & Lackschutz' },
  { key: 'sonstiges', label: 'Sonstiges' },
];

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

export default function MarktplatzPage() {
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [bereich, setBereich] = useState('');
  const [marke, setMarke] = useState('');
  const [suche, setSuche] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Katalog>('/marketplace/catalog')
      .then(setKatalog)
      .catch((e) => setError(e instanceof Error ? e.message : 'Marktplatz konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  const alle = katalog?.produkte ?? [];

  // Zaehler je Bereich (fuer die Tabs); leere Bereiche werden ausgeblendet.
  const bereichCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of alle) c.set(p.bereich ?? 'sonstiges', (c.get(p.bereich ?? 'sonstiges') ?? 0) + 1);
    return c;
  }, [alle]);

  // Produkte im gewaehlten Bereich (Basis fuer Marken-Chips + Ergebnis).
  const imBereich = useMemo(
    () => (bereich ? alle.filter((p) => (p.bereich ?? 'sonstiges') === bereich) : alle),
    [alle, bereich],
  );

  // Marken-Schnellfilter: haeufigste zuerst, max. 12 Chips.
  const marken = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of imBereich) if (p.marke) c.set(p.marke, (c.get(p.marke) ?? 0) + 1);
    return Array.from(c.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
      .slice(0, 12)
      .map(([name]) => name);
  }, [imBereich]);

  const produkte = useMemo(() => {
    const term = suche.trim().toLowerCase();
    return imBereich.filter(
      (p) =>
        (!marke || p.marke === marke) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.marke ?? '').toLowerCase().includes(term) ||
          (p.haendlerName ?? '').toLowerCase().includes(term) ||
          (p.beschreibung ?? '').toLowerCase().includes(term)),
    );
  }, [imBereich, marke, suche]);

  function waehleBereich(b: string) {
    setBereich(b);
    setMarke(''); // Marken haengen am Bereich
  }

  /** Klick serverseitig zaehlen, dann den Affiliate-Link im neuen Tab oeffnen. */
  async function zumHaendler(p: MarketplaceProduct) {
    setBusyId(p.id);
    try {
      const { affiliateUrl } = await api.post<{ affiliateUrl: string }>(`/marketplace/products/${p.id}/klick`);
      window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link konnte nicht geöffnet werden');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Marktplatz"
        subtitle="Folien, Aufbereitung & Lackschutz von Partner-Händlern – der Kauf läuft direkt beim Händler."
      />
      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : alle.length === 0 ? (
        <div className="card">
          <Empty text="Der Marktplatz wird gerade bestückt – schau bald wieder vorbei. ✨" />
        </div>
      ) : (
        <>
          {/* 1) Bereiche – grosse, klare Haupt-Navigation */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => waehleBereich('')}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                bereich === ''
                  ? 'border-copper/60 bg-copper-soft text-copper'
                  : 'border-ink-700 bg-ink-850 text-chrome-300 hover:border-ink-600 hover:text-chrome-50'
              }`}
            >
              Alles <span className="ml-1 text-xs font-normal opacity-70">{alle.length}</span>
            </button>
            {BEREICHE.filter((b) => (bereichCounts.get(b.key) ?? 0) > 0).map((b) => (
              <button
                key={b.key}
                onClick={() => waehleBereich(b.key)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  bereich === b.key
                    ? 'border-copper/60 bg-copper-soft text-copper'
                    : 'border-ink-700 bg-ink-850 text-chrome-300 hover:border-ink-600 hover:text-chrome-50'
                }`}
              >
                {b.label} <span className="ml-1 text-xs font-normal opacity-70">{bereichCounts.get(b.key)}</span>
              </button>
            ))}
          </div>

          {/* 2) Suche – gross und sofort */}
          <div className="mb-3">
            <div className="relative max-w-lg">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                className="input pl-10"
                placeholder="Produkt, Marke oder Händler suchen…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>
          </div>

          {/* 3) Marken – Schnellauswahl im gewaehlten Bereich */}
          {marken.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-chrome-600">Marken</span>
              <button
                onClick={() => setMarke('')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  marke === ''
                    ? 'border-copper/60 bg-copper-soft text-copper'
                    : 'border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50'
                }`}
              >
                Alle
              </button>
              {marken.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarke(marke === m ? '' : m)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    marke === m
                      ? 'border-copper/60 bg-copper-soft text-copper'
                      : 'border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {produkte.length === 0 ? (
            <div className="card">
              <Empty text="Keine Treffer – Suche oder Filter anpassen." />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {produkte.map((p) => (
                <div
                  key={p.id}
                  className="group card-flush flex flex-col overflow-hidden transition-transform duration-180 ease-emphasized hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] overflow-hidden border-b border-ink-700/50">
                    <ProduktBild p={p} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">
                      {p.marke || BEREICHE.find((b) => b.key === (p.bereich ?? 'sonstiges'))?.label || ''}
                    </span>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50">{p.name}</h3>
                    <p className="text-xs text-chrome-500">{p.haendlerName}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <p className="text-sm font-semibold text-chrome-100">
                        {p.preis != null ? (
                          <>
                            {p.preisHinweis ? `${p.preisHinweis} ` : ''}
                            {eur(p.preis)}
                          </>
                        ) : (
                          <span className="font-normal text-chrome-500">Preis beim Händler</span>
                        )}
                      </p>
                      <button
                        className="btn-primary btn-sm shrink-0"
                        disabled={busyId === p.id}
                        onClick={() => zumHaendler(p)}
                      >
                        {busyId === p.id ? '…' : 'Zum Angebot ↗'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
