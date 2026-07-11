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
import { useT } from '@/lib/i18n';

interface Katalog {
  produkte: MarketplaceProduct[];
  haendler: { id: string; name: string }[];
  kategorien: string[];
}

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
  const [busyId, setBusyId] = useState<string | null>(null);

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

  /** Bereichswechsel setzt die Marke zurueck (Marken haengen am Bereich). */
  function waehleBereich(b: string) {
    setBereich(b);
    setMarke('');
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
        <Loading />
      ) : !katalog || katalog.produkte.length === 0 ? (
        <div className="card">
          <Empty text={t('marktplatz.empty.catalog')} />
        </div>
      ) : (
        <>
          {/* 1) Bereiche – grosse, klare Haupt-Navigation */}
          <div className="mb-4 flex flex-wrap gap-2">
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
                {BER_KEY[b.key] ? t(BER_KEY[b.key]) : b.label} <span className="ml-1 text-xs font-normal opacity-70">{bereichCounts.get(b.key)}</span>
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
                placeholder={t('marktplatz.searchPlaceholder')}
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>
          </div>

          {/* 3) Marken – Schnellauswahl im gewaehlten Bereich */}
          {marken.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-chrome-600">{t('marktplatz.marken')}</span>
              <button
                onClick={() => setMarke('')}
                className={`choice rounded-full px-3 py-1 text-xs font-medium ${marke === '' ? 'choice-active' : ''}`}
              >
                {t('marktplatz.markenAll')}
              </button>
              {marken.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarke(marke === m ? '' : m)}
                  className={`choice rounded-full px-3 py-1 text-xs font-medium ${marke === m ? 'choice-active' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {produkte.length === 0 ? (
            <div className="card">
              <Empty text={t('marktplatz.noResults')} />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {produkte.map((p) => {
                const imKorb = korb[p.id] ?? 0;
                const bestellbar = !!p.bestellbar && p.preis != null;
                const bereichKey = p.bereich ?? 'sonstiges';
                const bereichLabel = BER_KEY[bereichKey]
                  ? t(BER_KEY[bereichKey])
                  : BEREICHE.find((b) => b.key === bereichKey)?.label ?? '';
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
                        {p.marke || bereichLabel}
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
