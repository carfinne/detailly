'use client';

// B2B-Marktplatz: kuratierte Angebote der Partner-Haendler. Der Kauf passiert
// BEIM Haendler (Affiliate-Link); Detailly zaehlt den Klick serverseitig und
// liefert die Ziel-URL. Ein Katalog-Request, Filter laufen clientseitig ->
// sofortige Reaktion ohne Nachladen.

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import type { MarketplaceProduct } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty } from '@/components/ui';

interface Katalog {
  produkte: MarketplaceProduct[];
  haendler: { id: string; name: string }[];
  kategorien: string[];
}

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

  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Katalog>('/marketplace/catalog')
      .then(setKatalog)
      .catch((e) => setError(e instanceof Error ? e.message : 'Marktplatz konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  const produkte = useMemo(() => {
    if (!katalog) return [];
    const term = suche.trim().toLowerCase();
    return katalog.produkte.filter(
      (p) =>
        (!kategorie || p.kategorie === kategorie) &&
        (!dealerId || p.dealerId === dealerId) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.haendlerName ?? '').toLowerCase().includes(term) ||
          (p.beschreibung ?? '').toLowerCase().includes(term)),
    );
  }, [katalog, suche, kategorie, dealerId]);

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
        subtitle="Ausgewählte Angebote unserer Partner-Händler – Folien, Chemie, Werkzeug & mehr. Der Kauf läuft direkt beim Händler."
      />
      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : !katalog || katalog.produkte.length === 0 ? (
        <div className="card">
          <Empty text="Der Marktplatz wird gerade bestückt – schau bald wieder vorbei. ✨" />
        </div>
      ) : (
        <>
          {/* Filter-Leiste */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              placeholder="Produkt oder Händler suchen…"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
            {katalog.haendler.length > 1 && (
              <select className="input w-auto" value={dealerId} onChange={(e) => setDealerId(e.target.value)}>
                <option value="">Alle Händler</option>
                {katalog.haendler.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
          {/* Kategorie-Chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {['', ...katalog.kategorien].map((k) => (
              <button
                key={k || 'alle'}
                onClick={() => setKategorie(k)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  kategorie === k
                    ? 'border-copper/60 bg-copper-soft text-copper'
                    : 'border-ink-700 bg-ink-850 text-chrome-300 hover:border-ink-600 hover:text-chrome-50'
                }`}
              >
                {k || 'Alle'}
              </button>
            ))}
          </div>

          {produkte.length === 0 ? (
            <div className="card">
              <Empty text="Keine Treffer – Filter anpassen." />
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
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-copper">
                      {p.kategorie}
                    </span>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-chrome-50">{p.name}</h3>
                    <p className="text-xs text-chrome-500">{p.haendlerName}</p>
                    <p className="mt-auto pt-2 text-sm font-semibold text-chrome-100">
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
                      className="btn-primary btn-sm mt-2 w-full justify-center"
                      disabled={busyId === p.id}
                      onClick={() => zumHaendler(p)}
                    >
                      {busyId === p.id ? 'Öffnet…' : 'Zum Angebot ↗'}
                    </button>
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
