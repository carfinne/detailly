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
import { PageHeader, Loading, ErrorBox, Empty, Modal, Badge } from '@/components/ui';

interface Katalog {
  produkte: MarketplaceProduct[];
  haendler: { id: string; name: string }[];
  kategorien: string[];
}

const ORDER_STATUS_META: Record<MarketplaceOrderStatus, { label: string; badge: string }> = {
  eingegangen: { label: 'Eingegangen', badge: 'badge-info' },
  bestaetigt: { label: 'Bestätigt', badge: 'badge-caution' },
  versendet: { label: 'Versendet', badge: 'badge-positive' },
  storniert: { label: 'Storniert', badge: 'badge-danger' },
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
  const { user } = useAuth();
  const [katalog, setKatalog] = useState<Katalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState<'katalog' | 'bestellungen'>('katalog');
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [korb, setKorb] = useState<Korb>({});
  const [checkoutOffen, setCheckoutOffen] = useState(false);

  const [orders, setOrders] = useState<MarketplaceOrder[] | null>(null);

  useEffect(() => {
    api
      .get<Katalog>('/marketplace/catalog')
      .then(setKatalog)
      .catch((e) => setError(e instanceof Error ? e.message : 'Marktplatz konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  const ladeBestellungen = useCallback(() => {
    api
      .get<MarketplaceOrder[]>('/marketplace/orders')
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Bestellungen konnten nicht geladen werden'));
  }, []);

  useEffect(() => {
    if (tab === 'bestellungen' && orders === null) ladeBestellungen();
  }, [tab, orders, ladeBestellungen]);

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
      setError(e instanceof Error ? e.message : 'Link konnte nicht geöffnet werden');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Marktplatz"
        subtitle="Ausgewählte Angebote unserer Partner-Händler – direkt bestellen oder beim Händler kaufen."
        action={
          <div className="flex items-center gap-2">
            <button
              className={tab === 'katalog' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
              onClick={() => setTab('katalog')}
            >
              Katalog
            </button>
            <button
              className={tab === 'bestellungen' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
              onClick={() => setTab('bestellungen')}
            >
              Meine Bestellungen
            </button>
          </div>
        }
      />
      {error && <ErrorBox message={error} />}

      {tab === 'bestellungen' ? (
        <Bestellungen orders={orders} />
      ) : loading ? (
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
              {produkte.map((p) => {
                const imKorb = korb[p.id] ?? 0;
                const bestellbar = !!p.bestellbar && p.preis != null;
                return (
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
                      {bestellbar &&
                        (imKorb === 0 ? (
                          <button className="btn-primary btn-sm mt-2 w-full justify-center" onClick={() => inDenKorb(p)}>
                            In den Warenkorb
                          </button>
                        ) : (
                          <div className="mt-2 flex items-center justify-between rounded-lg border border-copper/40 bg-copper-soft px-2 py-1">
                            <button className="btn-ghost btn-sm px-2" aria-label="Menge verringern" onClick={() => inDenKorb(p, -1)}>−</button>
                            <span className="text-sm font-semibold text-copper">{imKorb} im Korb</span>
                            <button className="btn-ghost btn-sm px-2" aria-label="Menge erhöhen" onClick={() => inDenKorb(p, +1)}>+</button>
                          </div>
                        ))}
                      {p.affiliateUrl && (
                        <button
                          className={`${bestellbar ? 'btn-subtle' : 'btn-primary'} btn-sm mt-2 w-full justify-center`}
                          disabled={busyId === p.id}
                          onClick={() => zumHaendler(p)}
                        >
                          {busyId === p.id ? 'Öffnet…' : 'Zum Angebot ↗'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Schwebende Warenkorb-Leiste */}
          {korbAnzahl > 0 && (
            <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(92%,560px)] items-center justify-between gap-3 rounded-2xl border border-copper/40 bg-ink-850/95 px-5 py-3 shadow-pop backdrop-blur">
              <span className="text-sm text-chrome-200">
                <strong className="text-chrome-50">{korbAnzahl}</strong> Artikel ·{' '}
                <strong className="text-copper">{eur(korbSumme)}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost btn-sm" onClick={() => setKorb({})}>Leeren</button>
                <button className="btn-primary btn-sm" onClick={() => setCheckoutOffen(true)}>
                  Bestellen →
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
      setFehler(e instanceof Error ? e.message : 'Bestellung fehlgeschlagen');
    } finally {
      setSende(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Bestellung abschließen" size="lg">
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
            <span className="text-chrome-50">Gesamt</span>
            <span className="text-copper">{eur(summe)}</span>
          </div>
          {haendlerAnzahl > 1 && (
            <p className="mt-2 text-xs text-chrome-500">
              Artikel von {haendlerAnzahl} Händlern – es entstehen {haendlerAnzahl} getrennte Bestellungen,
              jeder Händler liefert und rechnet direkt ab.
            </p>
          )}
        </div>

        {fehler && <ErrorBox message={fehler} />}

        {/* Kontakt + Lieferung */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">Ansprechpartner*</span>
            <input className="input" value={form.kontaktName} onChange={set('kontaktName')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">E-Mail*</span>
            <input className="input" type="email" value={form.kontaktEmail} onChange={set('kontaktEmail')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">Telefon</span>
            <input className="input" value={form.kontaktTelefon} onChange={set('kontaktTelefon')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">Firma</span>
            <input className="input" value={form.lieferFirma} onChange={set('lieferFirma')} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-chrome-400">Straße & Nr.</span>
            <input className="input" value={form.lieferStrasse} onChange={set('lieferStrasse')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">PLZ</span>
            <input className="input" value={form.lieferPlz} onChange={set('lieferPlz')} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-chrome-400">Ort</span>
            <input className="input" value={form.lieferOrt} onChange={set('lieferOrt')} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-chrome-400">Notiz an den Händler</span>
            <textarea className="input min-h-[70px]" value={form.notiz} onChange={set('notiz')} />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={sende}>Abbrechen</button>
          <button
            className="btn-primary"
            onClick={bestellen}
            disabled={sende || !form.kontaktName.trim() || !form.kontaktEmail.trim()}
          >
            {sende ? 'Wird gesendet…' : `Verbindlich bestellen (${eur(summe)})`}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-chrome-500">
          Die Bestellung geht direkt an den jeweiligen Händler; Lieferung und Rechnung kommen vom Händler.
        </p>
      </div>
    </Modal>
  );
}

function Bestellungen({ orders }: { orders: MarketplaceOrder[] | null }) {
  if (orders === null) return <Loading />;
  if (orders.length === 0) {
    return (
      <div className="card">
        <Empty text="Noch keine Marktplatz-Bestellungen." />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const meta = ORDER_STATUS_META[o.status] ?? { label: o.status, badge: 'badge-neutral' };
        return (
          <div key={o.id} className="card-flush p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-chrome-50">{o.nummer}</span>
                <Badge className={meta.badge}>{meta.label}</Badge>
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
