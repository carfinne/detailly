'use client';

// B2B-Marktplatz: kuratierte Angebote der Partner-Haendler. Zwei Wege je
// Produkt: Kauf BEIM Haendler (Affiliate-Link, Klick wird serverseitig
// gezaehlt) ODER direkte Bestellung in der App (Warenkorb -> je Haendler eine
// Bestellung). Ein Katalog-Request, Filter laufen clientseitig.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { absoluteApiUrl, api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type {
  MarketplaceOrder,
  MarketplaceOrderStatus,
  MarketplaceProduct,
  MarketplaceReview,
  Product,
} from '@/lib/types';
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

/** Sterne-Anzeige (halbe Sterne gerundet auf ganze Optik, Schnitt als Zahl daneben). */
function Sterne({ schnitt, anzahl, onClick }: { schnitt: number; anzahl: number; onClick?: () => void }) {
  if (!anzahl) return null;
  const voll = Math.round(schnitt);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit items-center gap-1 text-xs text-chrome-400 hover:text-chrome-200"
      title={`${schnitt.toFixed(1)} von 5 Sternen (${anzahl} Bewertungen)`}
    >
      <span className="tracking-tight text-copper" aria-hidden>
        {'★'.repeat(voll)}
        <span className="text-ink-600">{'★'.repeat(5 - voll)}</span>
      </span>
      <span>{Number(schnitt).toFixed(1)} ({anzahl})</span>
    </button>
  );
}

/** Produktbild mit elegantem Fallback (Gradient + Initiale), lazy geladen. */
function ProduktBild({ p }: { p: MarketplaceProduct }) {
  const [kaputt, setKaputt] = useState(false);
  // Hochgeladenes Bild (API-Pfad inkl. /api/v1) hat Vorrang vor der externen URL.
  const src = p.bildPfad ? absoluteApiUrl(p.bildPfad) : p.bildUrl;
  if (!src || kaputt) {
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
      src={src}
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
  const [nurBestellbar, setNurBestellbar] = useState(false);
  const [sortierung, setSortierung] = useState<'beliebt' | 'preis-auf' | 'preis-ab' | 'bewertung'>('beliebt');
  const [reviewsProdukt, setReviewsProdukt] = useState<MarketplaceProduct | null>(null);
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
    const gefiltert = katalog.produkte.filter(
      (p) =>
        (!kategorie || p.kategorie === kategorie) &&
        (!dealerId || p.dealerId === dealerId) &&
        (!nurBestellbar || (p.bestellbar && p.preis != null)) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          (p.haendlerName ?? '').toLowerCase().includes(term) ||
          (p.beschreibung ?? '').toLowerCase().includes(term)),
    );
    // 'beliebt' = Server-Reihenfolge (Klicks absteigend); Rest clientseitig.
    if (sortierung === 'preis-auf' || sortierung === 'preis-ab') {
      const dir = sortierung === 'preis-auf' ? 1 : -1;
      // Produkte ohne Preis ("Preis beim Haendler") immer ans Ende.
      return [...gefiltert].sort((a, b) => {
        if (a.preis == null && b.preis == null) return 0;
        if (a.preis == null) return 1;
        if (b.preis == null) return -1;
        return (Number(a.preis) - Number(b.preis)) * dir;
      });
    }
    if (sortierung === 'bewertung') {
      return [...gefiltert].sort(
        (a, b) =>
          Number(b.bewertungSchnitt ?? 0) - Number(a.bewertungSchnitt ?? 0) ||
          Number(b.bewertungAnzahl ?? 0) - Number(a.bewertungAnzahl ?? 0),
      );
    }
    return gefiltert;
  }, [katalog, suche, kategorie, dealerId, nurBestellbar, sortierung]);

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
        <Bestellungen orders={orders} onChanged={ladeBestellungen} />
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
            <select
              className="input w-auto"
              value={sortierung}
              onChange={(e) => setSortierung(e.target.value as typeof sortierung)}
              aria-label="Sortierung"
            >
              <option value="beliebt">Beliebteste zuerst</option>
              <option value="bewertung">Beste Bewertung</option>
              <option value="preis-auf">Preis aufsteigend</option>
              <option value="preis-ab">Preis absteigend</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-chrome-300">
              <input
                type="checkbox"
                checked={nurBestellbar}
                onChange={(e) => setNurBestellbar(e.target.checked)}
              />
              Nur direkt bestellbar
            </label>
          </div>
          {/* Kategorie-Chips */}
          <div className="mb-5 flex flex-wrap gap-2">
            {['', ...katalog.kategorien].map((k) => (
              <button
                key={k || 'alle'}
                onClick={() => setKategorie(k)}
                className={`choice rounded-full px-3.5 py-1.5 text-sm font-medium ${kategorie === k ? 'choice-active' : ''}`}
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
                      <Sterne
                        schnitt={Number(p.bewertungSchnitt ?? 0)}
                        anzahl={Number(p.bewertungAnzahl ?? 0)}
                        onClick={() => setReviewsProdukt(p)}
                      />
                      {p.lieferzeitTage != null && (
                        <p className="text-xs text-chrome-500">
                          Lieferzeit ca. {p.lieferzeitTage} {p.lieferzeitTage === 1 ? 'Werktag' : 'Werktage'}
                        </p>
                      )}
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

          {reviewsProdukt && (
            <ReviewsModal produkt={reviewsProdukt} onClose={() => setReviewsProdukt(null)} />
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

/** Status-Verlauf als kompakte Punkte-Zeile (bestellt -> bestätigt -> versendet). */
function StatusVerlauf({ o }: { o: MarketplaceOrder }) {
  const datum = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : null;
  if (o.status === 'storniert') {
    return (
      <p className="text-xs text-chrome-500">
        Storniert{datum(o.storniertAm) ? ` am ${datum(o.storniertAm)}` : ''}
      </p>
    );
  }
  const schritte = [
    { label: 'Bestellt', am: datum(o.createdAt), erledigt: true },
    { label: 'Bestätigt', am: datum(o.bestaetigtAm), erledigt: !!o.bestaetigtAm || o.status === 'versendet' },
    { label: 'Versendet', am: datum(o.versendetAm), erledigt: o.status === 'versendet' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {schritte.map((s, i) => (
        <span key={s.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-chrome-600">→</span>}
          <span className={s.erledigt ? 'text-copper-300' : 'text-chrome-600'}>
            {s.erledigt ? '●' : '○'} {s.label}
            {s.erledigt && s.am ? ` ${s.am}` : ''}
          </span>
        </span>
      ))}
    </div>
  );
}

function Bestellungen({ orders, onChanged }: { orders: MarketplaceOrder[] | null; onChanged: () => void }) {
  const [einlagernOrder, setEinlagernOrder] = useState<MarketplaceOrder | null>(null);
  const [bewerten, setBewerten] = useState<{ produktId: string; produktName: string } | null>(null);
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
                {o.eingelagertAm && <Badge className="badge-copper">eingelagert</Badge>}
              </div>
              <div className="text-sm text-chrome-400">
                {o.haendlerName} · {new Date(o.createdAt).toLocaleDateString('de-DE')} ·{' '}
                <strong className="text-chrome-100">{eur(Number(o.summeBrutto))}</strong>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <StatusVerlauf o={o} />
              <span className="flex items-center gap-3">
                {o.status === 'versendet' && (o.trackingNummer || o.trackingUrl) && (
                  <span className="text-xs text-chrome-400">
                    {o.trackingNummer && <>Sendung {o.trackingNummer} </>}
                    {o.trackingUrl && (
                      <a className="text-copper-300 underline" href={o.trackingUrl} target="_blank" rel="noreferrer">
                        Sendungsverfolgung
                      </a>
                    )}
                  </span>
                )}
                {o.status === 'versendet' && !o.eingelagertAm && (
                  <button className="btn-subtle btn-sm" onClick={() => setEinlagernOrder(o)}>
                    Ins Lager buchen
                  </button>
                )}
              </span>
            </div>
            {(o.positionen ?? []).length > 0 && (
              <div className="mt-3 border-t border-ink-700/60 pt-2 text-sm text-chrome-300">
                {(o.positionen ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span>{i.menge} × {i.produktName}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {o.status !== 'storniert' && (
                        <button
                          className="btn-ghost btn-sm px-2 py-0 text-xs"
                          onClick={() => setBewerten({ produktId: i.productId, produktName: i.produktName })}
                        >
                          ★ Bewerten
                        </button>
                      )}
                      <span className="text-chrome-400">{eur(Number(i.zeilenSumme))}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {einlagernOrder && (
        <EinlagernModal
          order={einlagernOrder}
          onClose={() => setEinlagernOrder(null)}
          onDone={() => {
            setEinlagernOrder(null);
            onChanged();
          }}
        />
      )}
      {bewerten && (
        <BewertenModal
          produktId={bewerten.produktId}
          produktName={bewerten.produktName}
          onClose={() => setBewerten(null)}
          onDone={() => setBewerten(null)}
        />
      )}
    </div>
  );
}

/** Anonymisierte Bewertungen eines Produkts anzeigen. */
function ReviewsModal({ produkt, onClose }: { produkt: MarketplaceProduct; onClose: () => void }) {
  const [reviews, setReviews] = useState<MarketplaceReview[] | null>(null);
  useEffect(() => {
    api
      .get<MarketplaceReview[]>(`/marketplace/products/${produkt.id}/bewertungen`)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [produkt.id]);
  return (
    <Modal open title={`Bewertungen · ${produkt.name}`} onClose={onClose}>
      {reviews === null ? (
        <Loading />
      ) : reviews.length === 0 ? (
        <Empty text="Noch keine Bewertungen." />
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-ink-700/60 px-3 py-2">
              <div className="flex items-center justify-between text-xs text-chrome-500">
                <span className="text-copper" aria-label={`${r.sterne} von 5 Sternen`}>
                  {'★'.repeat(r.sterne)}
                  <span className="text-ink-600">{'★'.repeat(5 - r.sterne)}</span>
                </span>
                <span>{new Date(r.createdAt).toLocaleDateString('de-DE')}</span>
              </div>
              {r.kommentar && <p className="mt-1 text-sm text-chrome-200">{r.kommentar}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Bewertung (1-5 Sterne + Kommentar) fuer ein gekauftes Produkt abgeben. */
function BewertenModal({
  produktId,
  produktName,
  onClose,
  onDone,
}: {
  produktId: string;
  produktName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [sterne, setSterne] = useState(5);
  const [kommentar, setKommentar] = useState('');
  const [sende, setSende] = useState(false);
  const [fehler, setFehler] = useState('');

  async function absenden() {
    setSende(true);
    setFehler('');
    try {
      await api.post(`/marketplace/products/${produktId}/bewertung`, {
        sterne,
        kommentar: kommentar.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Bewertung fehlgeschlagen');
    } finally {
      setSende(false);
    }
  }

  return (
    <Modal open title={`Bewerten · ${produktName}`} onClose={onClose}>
      <div className="space-y-3">
        {fehler && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{fehler}</div>
        )}
        <div className="flex items-center gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSterne(s)}
              aria-label={`${s} Sterne`}
              className={s <= sterne ? 'text-copper' : 'text-ink-600 hover:text-chrome-400'}
            >
              ★
            </button>
          ))}
          <span className="ml-2 text-sm text-chrome-400">{sterne} von 5</span>
        </div>
        <textarea
          className="input min-h-[80px] w-full"
          placeholder="Optionaler Kommentar (z. B. Qualität, Lieferung)…"
          value={kommentar}
          onChange={(e) => setKommentar(e.target.value)}
          maxLength={2000}
        />
        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={sende}>Abbrechen</button>
          <button className="btn-primary" onClick={absenden} disabled={sende}>
            {sende ? 'Sendet…' : 'Bewertung abgeben'}
          </button>
        </div>
        <p className="text-xs text-chrome-500">
          Bewertungen erscheinen anonym im Katalog. Erneutes Bewerten überschreibt eure bisherige Bewertung.
        </p>
      </div>
    </Modal>
  );
}

/**
 * Positionen einer versendeten Bestellung ins eigene Lager buchen: je Position
 * wahlweise ein vorhandenes Shop-Produkt oder Neuanlage aus der Position.
 */
function EinlagernModal({
  order,
  onClose,
  onDone,
}: {
  order: MarketplaceOrder;
  onClose: () => void;
  onDone: () => void;
}) {
  const [produkte, setProdukte] = useState<Product[] | null>(null);
  // itemId -> Ziel-Produkt-Id ('' = neues Produkt anlegen)
  const [ziel, setZiel] = useState<Record<string, string>>({});
  const [sende, setSende] = useState(false);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    api
      .get<Product[]>('/shop/products')
      .then(setProdukte)
      .catch(() => setProdukte([]));
  }, []);

  async function buchen() {
    setSende(true);
    setFehler('');
    try {
      await api.post(`/marketplace/orders/${order.id}/einlagern`, {
        positionen: (order.positionen ?? []).map((i) => ({
          itemId: i.id,
          productId: ziel[i.id] || undefined,
        })),
      });
      onDone();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Einlagern fehlgeschlagen');
    } finally {
      setSende(false);
    }
  }

  return (
    <Modal open title={`${order.nummer} ins Lager buchen`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-chrome-400">
          Jede Position wird als Zugang auf ein Lager-Produkt gebucht – wahlweise auf ein vorhandenes
          oder als neues Produkt (Einkaufspreis = Bestellpreis).
        </p>
        {fehler && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{fehler}</div>
        )}
        {produkte === null ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {(order.positionen ?? []).map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700/60 px-3 py-2">
                <span className="text-sm text-chrome-100">{i.menge} × {i.produktName}</span>
                <select
                  className="input h-9 w-auto py-0 text-sm"
                  value={ziel[i.id] ?? ''}
                  onChange={(e) => setZiel((z) => ({ ...z, [i.id]: e.target.value }))}
                  aria-label={`Ziel-Produkt für ${i.produktName}`}
                >
                  <option value="">+ Neues Produkt anlegen</option>
                  {produkte.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={sende}>Abbrechen</button>
          <button className="btn-primary" onClick={buchen} disabled={sende || produkte === null}>
            {sende ? 'Bucht…' : 'Zugang buchen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
