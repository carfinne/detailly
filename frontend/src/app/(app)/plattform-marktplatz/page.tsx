'use client';

// Marktplatz-Pflege (Detailly-Team): Haendler + Produkte kuratieren,
// Bestellungen ueberwachen, Grosshaendler-Bewerbungen reviewen (Welle 3)
// und die Margen-/Affiliate-Auswertung sehen. Backend ist auf Plattform-
// Rollen begrenzt (Analyst read-only – die Pflege-Endpunkte lehnen ihn ab).

import { useCallback, useEffect, useState } from 'react';
import { api, authedFileUrl } from '@/lib/api';
import { eur } from '@/lib/format';
import type { KybAmpel, MarketplaceCategoryAdminNode, MarketplaceDealer, MarketplaceOrder, MarketplaceOrderStatus, MarketplaceProduct, MarketplaceReviewAdmin } from '@/lib/types';
import { BEREICH_KEY } from '@/lib/labels';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal, ConfirmDialog, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

/** KYB-Ampel -> Badge-Stil (Label kommt aus i18n). */
const KYB_BADGE: Record<KybAmpel, string> = {
  gruen: 'badge-positive',
  gelb: 'badge-caution',
  rot: 'badge-danger',
};

type Tab = 'produkte' | 'kategorien' | 'haendler' | 'bewerbungen' | 'bestellungen' | 'moderation' | 'provisionen' | 'statistik';

/** Freitext -> Slug (a-z, 0-9, Bindestrich); deutsche Umlaute werden transliteriert. */
function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CAT_LEER = { name: '', slug: '', bereich: 'folierung', parentId: '', sortIndex: '0', sdbPflicht: false, aktiv: true };

/** Ergebnis der Betreiber-Freigabe (Portal-Link wird nur EINMAL roh geliefert). */
interface FreigabeErgebnis {
  haendler: { id: string; name: string; kontaktEmail: string | null; provisionSatz: number };
  uploadToken: string;
  portalPfad: string;
  mailKonfiguriert: boolean;
}

interface Stats {
  gesamt: number;
  letzte30Tage: number;
  topProdukte: { name: string; haendler: string; klicks: number }[];
  topHaendler: { name: string; klicks: number }[];
}

interface ProvisionReport {
  zeilen: {
    dealerId: string;
    name: string;
    aktiv: boolean;
    provisionSatz: number;
    bestellungen: number;
    umsatz: number;
    provision: number;
    klicks: number;
  }[];
  summe: { bestellungen: number; umsatz: number; provision: number; klicks: number };
}

const ORDER_STATUS: { value: MarketplaceOrderStatus; label: string; badge: string }[] = [
  { value: 'eingegangen', label: 'Eingegangen', badge: 'badge-info' },
  { value: 'bestaetigt', label: 'Bestätigt', badge: 'badge-caution' },
  { value: 'versendet', label: 'Versendet', badge: 'badge-positive' },
  { value: 'storniert', label: 'Storniert', badge: 'badge-danger' },
];

const PROD_LEER = { dealerId: '', name: '', bereich: 'folierung', marke: '', preis: '', preisHinweis: '', bildUrl: '', affiliateUrl: '', beschreibung: '', bestellbar: false, aktiv: true };
const DEALER_LEER = { name: '', beschreibung: '', logoUrl: '', webseite: '', kontaktEmail: '', provisionSatz: '10', aktiv: true };

export default function PlattformMarktplatzPage() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('produkte');
  const [produkte, setProdukte] = useState<MarketplaceProduct[]>([]);
  const [haendler, setHaendler] = useState<MarketplaceDealer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Produkt-Modal
  const [prodOpen, setProdOpen] = useState(false);
  const [prodEditId, setProdEditId] = useState<string | null>(null);
  const [prod, setProd] = useState(PROD_LEER);

  // Haendler-Modal
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dealerEditId, setDealerEditId] = useState<string | null>(null);
  const [dealer, setDealer] = useState(DEALER_LEER);

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [report, setReport] = useState<ProvisionReport | null>(null);
  const [portalLink, setPortalLink] = useState<{ name: string; url: string } | null>(null);

  // Bewerbungs-Review (Welle 3). Fehler werden IM jeweiligen Modal angezeigt.
  const [freigabeDealer, setFreigabeDealer] = useState<MarketplaceDealer | null>(null);
  const [freigabeProvision, setFreigabeProvision] = useState('10');
  const [freigabeBusy, setFreigabeBusy] = useState(false);
  const [freigabeError, setFreigabeError] = useState('');
  const [freigabeErgebnis, setFreigabeErgebnis] = useState<(FreigabeErgebnis & { url: string }) | null>(null);
  const [linkKopiert, setLinkKopiert] = useState(false);
  const [mailFrage, setMailFrage] = useState(false); // Inline-Bestaetigung (Review-before-send)
  const [mailBusy, setMailBusy] = useState(false);
  const [mailError, setMailError] = useState('');
  const [ablehnenDealer, setAblehnenDealer] = useState<MarketplaceDealer | null>(null);
  const [ablehnenBusy, setAblehnenBusy] = useState(false);
  const [ablehnenError, setAblehnenError] = useState('');

  // KYB-Dokument-Vorschau (Welle 5): guarded Download -> Blob-URL im neuen Tab.
  const [dokBusyId, setDokBusyId] = useState<string | null>(null);

  // Betreiber-Admin (PR7): Kategorien, Moderation, Highlights, Händler-Logins
  const [categories, setCategories] = useState<MarketplaceCategoryAdminNode[]>([]);
  const [reviews, setReviews] = useState<MarketplaceReviewAdmin[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [cat, setCat] = useState(CAT_LEER);
  const [catError, setCatError] = useState('');
  const [catSlugTouched, setCatSlugTouched] = useState(false);
  const [catDeactivate, setCatDeactivate] = useState<MarketplaceCategoryAdminNode | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const [modReview, setModReview] = useState<MarketplaceReviewAdmin | null>(null);
  const [modBusy, setModBusy] = useState(false);
  const [highlightBusyId, setHighlightBusyId] = useState<string | null>(null);
  const [reinviteDealer, setReinviteDealer] = useState<MarketplaceDealer | null>(null);
  const [reinviteBusy, setReinviteBusy] = useState(false);
  const [deaktDealer, setDeaktDealer] = useState<MarketplaceDealer | null>(null);
  const [deaktBusy, setDeaktBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s, o, r, c, rev] = await Promise.all([
        api.get<MarketplaceProduct[]>('/platform/marketplace/products'),
        api.get<MarketplaceDealer[]>('/platform/marketplace/dealers'),
        api.get<Stats>('/platform/marketplace/stats'),
        api.get<MarketplaceOrder[]>('/platform/marketplace/orders'),
        api.get<ProvisionReport>('/platform/marketplace/provisionen'),
        api.get<MarketplaceCategoryAdminNode[]>('/platform/marketplace/categories'),
        api.get<MarketplaceReviewAdmin[]>('/platform/marketplace/reviews'),
      ]);
      setProdukte(p);
      setHaendler(d);
      setStats(s);
      setOrders(o);
      setReport(r);
      setCategories(c);
      setReviews(rev);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Marktplatz-Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Neuen Portal-Link ausstellen (invalidiert den alten) und anzeigen. */
  async function portalLinkAusstellen(d: MarketplaceDealer) {
    setError('');
    try {
      const res = await api.post<{ portalPfad: string }>(`/platform/marketplace/dealers/${d.id}/portal-token`);
      setPortalLink({ name: d.name, url: `${window.location.origin}${res.portalPfad}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal-Link konnte nicht erstellt werden');
    }
  }

  /** Freigabe-Dialog oeffnen (Provision editierbar, vorbelegt mit Satz/Default 10 %). */
  function openFreigabe(d: MarketplaceDealer) {
    setFreigabeError('');
    setFreigabeProvision(d.provisionSatz != null ? String(d.provisionSatz) : '10');
    setFreigabeDealer(d);
  }

  /** Bewerbung freigeben: Backend setzt aktiv+status und stellt den Portal-Token aus. */
  async function freigeben(e: React.FormEvent) {
    e.preventDefault();
    if (!freigabeDealer) return;
    setFreigabeBusy(true);
    setFreigabeError('');
    try {
      const res = await api.post<FreigabeErgebnis>(
        `/platform/marketplace/dealers/${freigabeDealer.id}/freigeben`,
        freigabeProvision.trim() !== '' ? { provisionSatz: Number(freigabeProvision) } : {},
      );
      // Erst das Freigabe-Modal schliessen, DANN das Ergebnis-Modal oeffnen
      // (kein Modal-Stacking - Scroll-Lock-Konvention).
      setFreigabeDealer(null);
      setLinkKopiert(false);
      setMailFrage(false);
      setMailError('');
      setFreigabeErgebnis({ ...res, url: `${window.location.origin}${res.portalPfad}` });
      toast(t('mpBewerbung.freigegebenToast', { name: res.haendler.name }));
      await load();
    } catch (err) {
      setFreigabeError(err instanceof Error ? err.message : t('mpBewerbung.error'));
    } finally {
      setFreigabeBusy(false);
    }
  }

  /** Portal-Link per Mail - IMMER erst nach der Inline-Bestaetigung (Review-before-send). */
  async function portalMailSenden() {
    if (!freigabeErgebnis) return;
    setMailBusy(true);
    setMailError('');
    try {
      const res = await api.post<{ ok: true; to: string }>(
        `/platform/marketplace/dealers/${freigabeErgebnis.haendler.id}/portal-mail`,
      );
      setMailFrage(false);
      toast(t('mpBewerbung.mailSent', { email: res.to }));
    } catch (err) {
      setMailError(err instanceof Error ? err.message : t('mpBewerbung.error'));
    } finally {
      setMailBusy(false);
    }
  }

  /** Bewerbung ablehnen (Backend nullt nachricht/adresse - PII-Sparsamkeit). */
  async function ablehnen() {
    if (!ablehnenDealer) return;
    setAblehnenBusy(true);
    setAblehnenError('');
    try {
      await api.post(`/platform/marketplace/dealers/${ablehnenDealer.id}/ablehnen`);
      setAblehnenDealer(null);
      toast(t('mpBewerbung.abgelehntToast'));
      await load();
    } catch (err) {
      setAblehnenError(err instanceof Error ? err.message : t('mpBewerbung.error'));
    } finally {
      setAblehnenBusy(false);
    }
  }

  /** Gewerbeanmeldung guarded laden (Bearer) und im neuen Tab öffnen. */
  async function dokumentAnzeigen(d: MarketplaceDealer) {
    setError('');
    setDokBusyId(d.id);
    try {
      const url = await authedFileUrl(`/platform/marketplace/dealers/${d.id}/dokument`);
      window.open(url, '_blank', 'noopener');
      // Blob-URL nicht sofort widerrufen (sonst bricht die Anzeige im neuen Tab ab).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mpKyb.dokumentFehler'));
    } finally {
      setDokBusyId(null);
    }
  }

  async function setOrderStatus(orderId: string, status: MarketplaceOrderStatus) {
    setError('');
    try {
      await api.patch(`/platform/marketplace/orders/${orderId}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status konnte nicht geändert werden');
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const dealerName = (id: string) => haendler.find((d) => d.id === id)?.name ?? '—';

  function openProdukt(p?: MarketplaceProduct) {
    setProdEditId(p?.id ?? null);
    setProd(
      p
        ? {
            dealerId: p.dealerId, name: p.name, bereich: p.bereich ?? 'sonstiges', marke: p.marke ?? '',
            preis: p.preis != null ? String(p.preis) : '', preisHinweis: p.preisHinweis ?? '',
            bildUrl: p.bildUrl ?? '', affiliateUrl: p.affiliateUrl ?? '',
            beschreibung: p.beschreibung ?? '', bestellbar: !!p.bestellbar, aktiv: p.aktiv !== false,
          }
        : PROD_LEER,
    );
    setProdOpen(true);
  }

  async function saveProdukt(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        dealerId: prod.dealerId,
        name: prod.name.trim(),
        bereich: prod.bereich,
        bestellbar: prod.bestellbar,
        aktiv: prod.aktiv,
      };
      if (prod.marke.trim()) payload.marke = prod.marke.trim();
      if (prod.affiliateUrl.trim()) payload.affiliateUrl = prod.affiliateUrl.trim();
      if (prod.preis.trim() !== '') payload.preis = Number(prod.preis);
      if (prod.preisHinweis.trim()) payload.preisHinweis = prod.preisHinweis.trim();
      if (prod.bildUrl.trim()) payload.bildUrl = prod.bildUrl.trim();
      if (prod.beschreibung.trim()) payload.beschreibung = prod.beschreibung.trim();
      if (prodEditId) await api.patch(`/platform/marketplace/products/${prodEditId}`, payload);
      else await api.post('/platform/marketplace/products', payload);
      setProdOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  function openDealer(d?: MarketplaceDealer & { kontaktEmail?: string; provisionSatz?: number }) {
    setDealerEditId(d?.id ?? null);
    setDealer(
      d
        ? {
            name: d.name, beschreibung: d.beschreibung ?? '', logoUrl: d.logoUrl ?? '', webseite: d.webseite ?? '',
            kontaktEmail: d.kontaktEmail ?? '', provisionSatz: d.provisionSatz != null ? String(d.provisionSatz) : '10',
            aktiv: d.aktiv !== false,
          }
        : DEALER_LEER,
    );
    setDealerOpen(true);
  }

  async function saveDealer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { name: dealer.name.trim(), aktiv: dealer.aktiv };
      if (dealer.beschreibung.trim()) payload.beschreibung = dealer.beschreibung.trim();
      if (dealer.logoUrl.trim()) payload.logoUrl = dealer.logoUrl.trim();
      if (dealer.webseite.trim()) payload.webseite = dealer.webseite.trim();
      if (dealer.kontaktEmail.trim()) payload.kontaktEmail = dealer.kontaktEmail.trim();
      if (dealer.provisionSatz.trim() !== '') payload.provisionSatz = Number(dealer.provisionSatz);
      if (dealerEditId) await api.patch(`/platform/marketplace/dealers/${dealerEditId}`, payload);
      else await api.post('/platform/marketplace/dealers', payload);
      setDealerOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  // --- Betreiber-Admin (PR7) -------------------------------------------------

  const hauptkategorien = categories.filter((c) => c.parentId === null);

  function openCategory(node?: MarketplaceCategoryAdminNode, parent?: MarketplaceCategoryAdminNode) {
    setCatError('');
    setCatSlugTouched(!!node); // beim Bearbeiten keine Slug-Automatik
    setCatEditId(node?.id ?? null);
    setCat(
      node
        ? {
            name: node.name, slug: node.slug, bereich: node.bereich,
            parentId: node.parentId ?? '', sortIndex: String(node.sortIndex ?? 0),
            sdbPflicht: !!node.sdbPflicht, aktiv: node.aktiv !== false,
          }
        : { ...CAT_LEER, parentId: parent?.id ?? '', bereich: parent?.bereich ?? 'folierung' },
    );
    setCatOpen(true);
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatBusy(true);
    setCatError('');
    try {
      if (catEditId) {
        // Update: nur die veränderbaren Felder (Slug bleibt fix).
        const payload: Record<string, unknown> = {
          name: cat.name.trim(),
          sortIndex: Number(cat.sortIndex) || 0,
          sdbPflicht: cat.sdbPflicht,
          aktiv: cat.aktiv,
          parentId: cat.parentId || null,
        };
        await api.patch(`/platform/marketplace/categories/${catEditId}`, payload);
      } else {
        const payload: Record<string, unknown> = {
          name: cat.name.trim(),
          slug: cat.slug.trim(),
          sortIndex: Number(cat.sortIndex) || 0,
          sdbPflicht: cat.sdbPflicht,
          aktiv: cat.aktiv,
        };
        if (cat.parentId) payload.parentId = cat.parentId;
        else payload.bereich = cat.bereich; // Bereich nur bei Hauptkategorie
        await api.post('/platform/marketplace/categories', payload);
      }
      setCatOpen(false);
      toast(t('mpAdmin.cat.savedToast'));
      await load();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : t('mpAdmin.cat.error'));
    } finally {
      setCatBusy(false);
    }
  }

  async function deactivateCategory() {
    if (!catDeactivate) return;
    setCatBusy(true);
    setCatError('');
    try {
      await api.delete(`/platform/marketplace/categories/${catDeactivate.id}`);
      setCatDeactivate(null);
      toast(t('mpAdmin.cat.deactivatedToast'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mpAdmin.cat.error'));
    } finally {
      setCatBusy(false);
    }
  }

  async function toggleHighlight(p: MarketplaceProduct) {
    setHighlightBusyId(p.id);
    setError('');
    try {
      await api.patch(`/platform/marketplace/products/${p.id}/highlight`, { istHighlight: !p.istHighlight });
      toast(t('mpAdmin.highlightToast'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mpAdmin.highlightError'));
    } finally {
      setHighlightBusyId(null);
    }
  }

  async function moderateReview() {
    if (!modReview) return;
    setModBusy(true);
    setError('');
    try {
      await api.patch(`/platform/marketplace/reviews/${modReview.id}`, { aktiv: !modReview.aktiv });
      setModReview(null);
      toast(t('mpAdmin.mod.doneToast'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mpAdmin.mod.error'));
    } finally {
      setModBusy(false);
    }
  }

  async function reinviteHaendler() {
    if (!reinviteDealer) return;
    setReinviteBusy(true);
    setError('');
    try {
      await api.post(`/platform/marketplace/dealers/${reinviteDealer.id}/haendler-einladung`);
      setReinviteDealer(null);
      toast(t('mpAdmin.dealer.reinviteToast'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mpAdmin.dealer.error'));
    } finally {
      setReinviteBusy(false);
    }
  }

  async function deactivateHaendler() {
    if (!deaktDealer) return;
    setDeaktBusy(true);
    setError('');
    try {
      await api.post(`/platform/marketplace/dealers/${deaktDealer.id}/haendler-deaktivieren`);
      setDeaktDealer(null);
      toast(t('mpAdmin.dealer.deactivatedToast'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mpAdmin.dealer.error'));
    } finally {
      setDeaktBusy(false);
    }
  }

  const bewerbungen = haendler.filter((d) => d.status === 'beantragt');
  const abgelehnte = haendler.filter((d) => d.status === 'abgelehnt');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'produkte', label: 'Produkte' },
    { key: 'kategorien', label: t('mpAdmin.tab.kategorien') },
    { key: 'haendler', label: 'Händler' },
    { key: 'bewerbungen', label: `${t('mpBewerbung.tab')}${bewerbungen.length ? ` (${bewerbungen.length})` : ''}` },
    { key: 'bestellungen', label: `Bestellungen${orders.filter((o) => o.status === 'eingegangen').length ? ` (${orders.filter((o) => o.status === 'eingegangen').length})` : ''}` },
    { key: 'moderation', label: t('mpAdmin.tab.moderation') },
    { key: 'provisionen', label: 'Provisionen' },
    { key: 'statistik', label: 'Statistik' },
  ];

  const marken = Array.from(new Set(produkte.map((p) => p.marke).filter(Boolean))) as string[];

  return (
    <div>
      <PageHeader
        title="Marktplatz-Pflege"
        subtitle="Händler, Produkte und Bestellungen – Verdienst über Provisionen je Bestellung plus Affiliate-Klicks."
        action={
          tab === 'haendler' ? (
            <button className="btn-primary" onClick={() => openDealer()}>Neuer Händler</button>
          ) : tab === 'kategorien' ? (
            <button className="btn-primary" onClick={() => openCategory()}>{t('mpAdmin.cat.new')}</button>
          ) : tab === 'bewerbungen' || tab === 'moderation' ? undefined : (
            <button className="btn-primary" onClick={() => openProdukt()} disabled={haendler.length === 0}>
              Neues Produkt
            </button>
          )
        }
      />
      {error && <ErrorBox message={error} />}

      <div className="seg-group mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`seg ${
              tab === t.key ? 'seg-active' : ''
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : tab === 'produkte' ? (
        <div className="card">
          {produkte.length === 0 ? (
            <Empty
              text={haendler.length === 0 ? 'Lege zuerst einen Händler an.' : 'Noch keine Produkte.'}
              action={
                haendler.length === 0 ? (
                  <button className="btn-ghost btn-sm" onClick={() => { setTab('haendler'); openDealer(); }}>Händler anlegen</button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produkt</th><th>Marke</th><th>Bereich</th><th>Händler</th>
                    <th className="text-right">Preis</th><th className="text-right">Klicks</th>
                    <th className="text-center">{t('mpAdmin.highlight')}</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {produkte.map((p) => (
                    <tr key={p.id} className={p.aktiv === false ? 'opacity-60' : undefined}>
                      <td className="font-medium">{p.name}</td>
                      <td>{p.marke || '–'}</td>
                      <td>{t(BEREICH_KEY[p.bereich ?? 'sonstiges'] ?? p.bereich ?? 'sonstiges')}</td>
                      <td>{dealerName(p.dealerId)}</td>
                      <td className="text-right tabular-nums">{p.preis != null ? eur(p.preis) : '–'}</td>
                      <td className="text-right tabular-nums">{p.klicks ?? 0}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() => toggleHighlight(p)}
                          disabled={highlightBusyId === p.id}
                          className="inline-flex items-center justify-center align-middle disabled:opacity-50"
                          title={p.istHighlight ? t('mpAdmin.highlightOff') : t('mpAdmin.highlightOn')}
                          aria-label={p.istHighlight ? t('mpAdmin.highlightOff') : t('mpAdmin.highlightOn')}
                          aria-pressed={!!p.istHighlight}
                        >
                          {highlightBusyId === p.id ? (
                            <span className="spinner" />
                          ) : (
                            <svg viewBox="0 0 24 24" className={`h-4 w-4 ${p.istHighlight ? 'text-copper' : 'text-chrome-600'}`} fill={p.istHighlight ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.3l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td>
                        {p.aktiv === false ? <Badge className="badge-neutral">Inaktiv</Badge> : <Badge className="badge-positive">Aktiv</Badge>}
                      </td>
                      <td className="text-right">
                        <button className="link-action" onClick={() => openProdukt(p)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'kategorien' ? (
        <div className="space-y-4">
          {hauptkategorien.length === 0 ? (
            <div className="card"><Empty text={t('mpAdmin.cat.empty')} /></div>
          ) : (
            hauptkategorien.map((h) => (
              <div key={h.id} className={`card space-y-3 ${h.aktiv === false ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-base font-semibold text-chrome-50">{h.name}</h3>
                    <Badge className="badge-info">{t(BEREICH_KEY[h.bereich] ?? h.bereich)}</Badge>
                    <code className="text-xs text-chrome-500">{h.slug}</code>
                    {h.aktiv === false && <Badge className="badge-neutral">{t('mpAdmin.cat.inaktiv')}</Badge>}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button className="link-action" onClick={() => openCategory(undefined, h)}>+ {t('mpAdmin.cat.typeUnter')}</button>
                    <button className="link-action" onClick={() => openCategory(h)}>{t('mpAdmin.cat.edit')}</button>
                    {h.aktiv !== false && (
                      <button className="link-action text-copper-300" onClick={() => setCatDeactivate(h)}>{t('mpAdmin.cat.deactivate')}</button>
                    )}
                  </div>
                </div>
                {h.unterkategorien && h.unterkategorien.length > 0 ? (
                  <ul className="divide-y divide-ink-700/50">
                    {h.unterkategorien.map((u) => (
                      <li key={u.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 text-sm ${u.aktiv === false ? 'opacity-60' : ''}`}>
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-chrome-100">{u.name}</span>
                          <code className="text-xs text-chrome-500">{u.slug}</code>
                          {u.sdbPflicht && <Badge className="badge-caution">{t('mpAdmin.cat.sdbBadge')}</Badge>}
                          {u.aktiv === false && <Badge className="badge-neutral">{t('mpAdmin.cat.inaktiv')}</Badge>}
                        </span>
                        <span className="flex shrink-0 gap-3">
                          <button className="link-action" onClick={() => openCategory(u)}>{t('mpAdmin.cat.edit')}</button>
                          {u.aktiv !== false && (
                            <button className="link-action text-copper-300" onClick={() => setCatDeactivate(u)}>{t('mpAdmin.cat.deactivate')}</button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-chrome-500">—</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : tab === 'haendler' ? (
        <div className="card">
          {haendler.length === 0 ? (
            <Empty text="Noch keine Händler. Leg den ersten Partner an." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Händler</th><th>Webseite</th><th className="text-right">Provision</th><th>{t('mpAdmin.dealer.login')}</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {/* Bewerbungen (beantragt/abgelehnt) laufen ueber den eigenen Tab. */}
                  {haendler.filter((d) => d.status !== 'beantragt' && d.status !== 'abgelehnt').map((d) => (
                    <tr key={d.id} className={d.aktiv === false ? 'opacity-60' : undefined}>
                      <td className="font-medium">{d.name}</td>
                      <td className="text-chrome-400">{d.webseite || '–'}</td>
                      <td className="text-right tabular-nums">
                        {(d as { provisionSatz?: number }).provisionSatz != null
                          ? `${Number((d as { provisionSatz?: number }).provisionSatz)} %`
                          : '–'}
                      </td>
                      <td>
                        {d.hatLoginKonto
                          ? (d.loginAktiv
                              ? <Badge className="badge-positive">{t('mpAdmin.dealer.kontoAktiv')}</Badge>
                              : <Badge className="badge-neutral">{t('mpAdmin.dealer.kontoInaktiv')}</Badge>)
                          : <span className="text-xs text-chrome-600">{t('mpAdmin.dealer.kontoKeins')}</span>}
                      </td>
                      <td>
                        {d.aktiv === false ? <Badge className="badge-neutral">Inaktiv</Badge> : <Badge className="badge-positive">Aktiv</Badge>}
                      </td>
                      <td className="space-x-3 text-right">
                        {d.hatLoginKonto && d.loginAktiv && (
                          <button className="link-action" onClick={() => setReinviteDealer(d)}>{t('mpAdmin.dealer.reinvite')}</button>
                        )}
                        {d.hatLoginKonto && d.loginAktiv && (
                          <button className="link-action text-copper-300" onClick={() => setDeaktDealer(d)}>{t('mpAdmin.dealer.deactivate')}</button>
                        )}
                        <button className="link-action" onClick={() => portalLinkAusstellen(d)}>Portal-Link</button>
                        <button className="link-action" onClick={() => openDealer(d)}>Bearbeiten</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'bewerbungen' ? (
        <div className="space-y-4">
          {bewerbungen.length === 0 ? (
            <div className="card">
              <Empty text={t('mpBewerbung.empty')} />
            </div>
          ) : (
            bewerbungen.map((d) => (
              <div key={d.id} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-base font-semibold text-chrome-50">{d.name}</h3>
                      <Badge className="badge-caution">{t('mpBewerbung.status.beantragt')}</Badge>
                    </div>
                    {d.beantragtAm && (
                      <p className="mt-1 text-xs text-chrome-500">
                        {t('mpBewerbung.beantragtAm', { datum: new Date(d.beantragtAm).toLocaleDateString('de-DE') })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="btn-ghost btn-sm" onClick={() => { setAblehnenError(''); setAblehnenDealer(d); }}>
                      {t('mpBewerbung.ablehnen')}
                    </button>
                    <button className="btn-primary btn-sm" onClick={() => openFreigabe(d)}>
                      {t('mpBewerbung.freigeben')}
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: t('mpBewerbung.ansprechpartner'), wert: d.ansprechpartner },
                    { label: t('mpBewerbung.email'), wert: d.kontaktEmail },
                    { label: t('mpBewerbung.telefon'), wert: d.telefon },
                    { label: t('mpBewerbung.ustIdNr'), wert: d.ustIdNr },
                    { label: t('mpBewerbung.adresse'), wert: d.adresse },
                    { label: t('mpBewerbung.webseite'), wert: d.webseite },
                  ].filter((z) => z.wert).map((z) => (
                    <div key={z.label}>
                      <dt className="text-xs uppercase tracking-wider text-chrome-500">{z.label}</dt>
                      <dd className="mt-0.5 break-words text-chrome-100">{z.wert}</dd>
                    </div>
                  ))}
                  {d.sortiment && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-chrome-500">{t('mpBewerbung.sortiment')}</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {d.sortiment.split(',').map((b) => (
                          <Badge key={b} className="badge-info">{t(BEREICH_KEY[b] ?? b)}</Badge>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>

                {d.nachricht && (
                  <div className="rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-wider text-chrome-500">{t('mpBewerbung.nachricht')}</p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-chrome-200">{d.nachricht}</p>
                  </div>
                )}

                {/* KYB-Vorprüfung (Welle 5): Ampel + gelesene Felder + Hinweise + Dokument-Vorschau */}
                <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-900/40 px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-chrome-500">{t('mpKyb.titel')}</span>
                      {d.kybErgebnis ? (
                        <Badge className={KYB_BADGE[d.kybErgebnis.ampel]}>{t(`mpKyb.ampel.${d.kybErgebnis.ampel}`)}</Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-chrome-400">
                          <span className="spinner" />
                          {t('mpKyb.pending')}
                        </span>
                      )}
                    </div>
                    {d.gewerbeanmeldungDatei ? (
                      <button className="btn-ghost btn-sm" onClick={() => dokumentAnzeigen(d)} disabled={dokBusyId === d.id}>
                        {dokBusyId === d.id && <span className="spinner" />}
                        {dokBusyId === d.id ? t('mpKyb.dokumentLaden') : t('mpKyb.dokumentAnzeigen')}
                      </button>
                    ) : (
                      <span className="text-xs text-chrome-500">{t('mpKyb.dokumentFehlt')}</span>
                    )}
                  </div>

                  {d.kybErgebnis && Object.values(d.kybErgebnis.felder).some(Boolean) && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-chrome-500">{t('mpKyb.extrahiert')}</p>
                      <dl className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        {([
                          ['firmenname', d.kybErgebnis.felder.firmenname],
                          ['anschrift', d.kybErgebnis.felder.anschrift],
                          ['taetigkeit', d.kybErgebnis.felder.taetigkeit],
                          ['anmeldedatum', d.kybErgebnis.felder.anmeldedatum],
                          ['behoerde', d.kybErgebnis.felder.behoerde],
                        ] as const)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="shrink-0 text-chrome-500">{t(`mpKyb.feld.${k}`)}:</dt>
                              <dd className="min-w-0 break-words text-chrome-200">{v}</dd>
                            </div>
                          ))}
                      </dl>
                    </div>
                  )}

                  {d.kybErgebnis && d.kybErgebnis.abweichungen.length > 0 && (
                    <ul className="space-y-1">
                      {d.kybErgebnis.abweichungen.map((a, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-chrome-200">
                          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-copper-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                            <path d="M12 9v4m0 4h.01" />
                          </svg>
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}

          {abgelehnte.length > 0 && (
            <SectionCard title={t('mpBewerbung.abgelehntSection')}>
              <ul className="divide-y divide-ink-700/50">
                {abgelehnte.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm opacity-60">
                    <span className="min-w-0 truncate text-chrome-200">
                      {d.name}
                      {d.beantragtAm && (
                        <span className="ml-2 text-xs text-chrome-500">
                          {new Date(d.beantragtAm).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </span>
                    <Badge className="badge-danger">{t('mpBewerbung.status.abgelehnt')}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      ) : tab === 'bestellungen' ? (
        <div className="card">
          {orders.length === 0 ? (
            <Empty text="Noch keine Marktplatz-Bestellungen." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nummer</th><th>Datum</th><th>Händler</th><th>Besteller</th>
                    <th className="text-right">Summe</th><th className="text-right">Provision</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className={o.status === 'storniert' ? 'opacity-60' : undefined}>
                      <td className="font-mono text-xs">{o.nummer}</td>
                      <td className="whitespace-nowrap text-chrome-400">
                        {new Date(o.createdAt).toLocaleDateString('de-DE')}
                      </td>
                      <td>{o.haendlerName}</td>
                      <td className="text-chrome-400">{o.lieferFirma || o.kontaktName}</td>
                      <td className="text-right tabular-nums">{eur(Number(o.summeBrutto))}</td>
                      <td className="text-right tabular-nums text-copper">{eur(Number(o.summeProvision))}</td>
                      <td>
                        <select
                          className="input h-8 w-auto py-0 text-xs"
                          value={o.status}
                          onChange={(e) => setOrderStatus(o.id, e.target.value as MarketplaceOrderStatus)}
                          aria-label={`Status von ${o.nummer}`}
                        >
                          {ORDER_STATUS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'moderation' ? (
        <div className="card">
          {reviews.length === 0 ? (
            <Empty text={t('mpAdmin.mod.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('mpAdmin.mod.product')}</th><th>{t('mpAdmin.mod.haendler')}</th>
                    <th className="text-center">{t('mpAdmin.mod.rating')}</th><th>{t('mpAdmin.mod.text')}</th>
                    <th>{t('mpAdmin.mod.status')}</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className={!r.aktiv ? 'opacity-60' : undefined}>
                      <td className="font-medium">{r.produktName}</td>
                      <td className="text-chrome-400">{r.haendlerName}</td>
                      <td className="whitespace-nowrap text-center tabular-nums">
                        <span className="text-copper">{'★'.repeat(r.sterne)}</span>
                        <span className="text-chrome-700">{'★'.repeat(Math.max(0, 5 - r.sterne))}</span>
                      </td>
                      <td className="max-w-xs truncate text-chrome-300" title={r.text ?? ''}>{r.text || '–'}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.aktiv
                            ? <Badge className="badge-positive">{t('mpAdmin.mod.sichtbar')}</Badge>
                            : <Badge className="badge-neutral">{t('mpAdmin.mod.ausgeblendet')}</Badge>}
                          {r.verifiziert && <Badge className="badge-info">{t('mpAdmin.mod.verifiziert')}</Badge>}
                        </div>
                      </td>
                      <td className="text-right">
                        <button className="link-action" onClick={() => setModReview(r)}>
                          {r.aktiv ? t('mpAdmin.mod.ausblenden') : t('mpAdmin.mod.einblenden')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'provisionen' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Bestellungen', wert: String(report?.summe.bestellungen ?? 0) },
              { label: 'Bestellumsatz', wert: eur(report?.summe.umsatz ?? 0) },
              { label: 'Provision (Marge)', wert: eur(report?.summe.provision ?? 0), copper: true },
              { label: 'Affiliate-Klicks', wert: String(report?.summe.klicks ?? 0) },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
                <p className="kpi-label">{k.label}</p>
                <p className={`mt-1 font-display text-xl font-bold ${k.copper ? 'text-copper' : 'text-chrome-50'}`}>{k.wert}</p>
              </div>
            ))}
          </div>
          <SectionCard title="Je Händler" subtitle="Stornierte Bestellungen sind ausgenommen">
            {!report || report.zeilen.length === 0 ? (
              <Empty text="Noch keine Händler angelegt." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Händler</th><th className="text-right">Satz</th><th className="text-right">Bestellungen</th>
                      <th className="text-right">Umsatz</th><th className="text-right">Provision</th><th className="text-right">Klicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.zeilen.map((z) => (
                      <tr key={z.dealerId} className={!z.aktiv ? 'opacity-60' : undefined}>
                        <td className="font-medium">{z.name}</td>
                        <td className="text-right tabular-nums">{z.provisionSatz} %</td>
                        <td className="text-right tabular-nums">{z.bestellungen}</td>
                        <td className="text-right tabular-nums">{eur(z.umsatz)}</td>
                        <td className="text-right tabular-nums font-semibold text-copper">{eur(z.provision)}</td>
                        <td className="text-right tabular-nums">{z.klicks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:max-w-md">
            <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
              <p className="kpi-label">Klicks gesamt</p>
              <p className="mt-1 font-display text-xl font-bold text-chrome-50">{stats?.gesamt ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
              <p className="kpi-label">Letzte 30 Tage</p>
              <p className="mt-1 font-display text-xl font-bold text-copper">{stats?.letzte30Tage ?? 0}</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top-Produkte" subtitle="Nach Klicks">
              {!stats || stats.topProdukte.length === 0 ? (
                <Empty text="Noch keine Klicks." />
              ) : (
                <ul className="divide-y divide-ink-700/50">
                  {stats.topProdukte.map((p, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-chrome-100">
                        <span className="mr-2 text-chrome-500">{i + 1}.</span>{p.name}
                        <span className="ml-2 text-xs text-chrome-500">{p.haendler}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{p.klicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Top-Händler" subtitle="Nach Klicks">
              {!stats || stats.topHaendler.length === 0 ? (
                <Empty text="Noch keine Klicks." />
              ) : (
                <ul className="divide-y divide-ink-700/50">
                  {stats.topHaendler.map((d, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-chrome-100">
                        <span className="mr-2 text-chrome-500">{i + 1}.</span>{d.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-chrome-200">{d.klicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* Produkt-Modal */}
      <Modal open={prodOpen} onClose={() => setProdOpen(false)} title={prodEditId ? 'Produkt bearbeiten' : 'Neues Produkt'}>
        <form onSubmit={saveProdukt} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Händler</label>
              <select className="select" value={prod.dealerId} onChange={(e) => setProd({ ...prod, dealerId: e.target.value })} required>
                <option value="">– wählen –</option>
                {haendler.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Bereich</label>
              <select className="select" value={prod.bereich} onChange={(e) => setProd({ ...prod, bereich: e.target.value })}>
                {Object.entries(BEREICH_KEY).map(([k, l]) => (
                  <option key={k} value={k}>{t(l)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Marke <span className="text-chrome-600">(Schnellfilter im Katalog)</span></label>
            <input className="input" list="mp-marken" value={prod.marke} onChange={(e) => setProd({ ...prod, marke: e.target.value })} placeholder="z. B. 3M, Koch Chemie, Rupes" maxLength={60} />
            <datalist id="mp-marken">
              {marken.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div className="field">
            <label className="label">Produktname</label>
            <input className="input" value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} maxLength={150} required />
          </div>
          <div className="field">
            <label className="label">Affiliate-Link <span className="text-chrome-600">(optional bei bestellbaren Produkten)</span></label>
            <input type="url" className="input" value={prod.affiliateUrl} onChange={(e) => setProd({ ...prod, affiliateUrl: e.target.value })} placeholder="https://haendler.de/produkt?aff=detailly" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
            <input type="checkbox" className="h-4 w-4 accent-copper" checked={prod.bestellbar} onChange={(e) => setProd({ ...prod, bestellbar: e.target.checked })} />
            Direkt in der App bestellbar (fester Preis nötig)
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="field">
              <label className="label">Preis (€)</label>
              <input type="number" step="0.01" min="0" className="input" value={prod.preis} onChange={(e) => setProd({ ...prod, preis: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Preis-Zusatz</label>
              <input className="input" value={prod.preisHinweis} onChange={(e) => setProd({ ...prod, preisHinweis: e.target.value })} placeholder="ab / pro Rolle" />
            </div>
            <div className="field">
              <label className="label">Bild-URL</label>
              <input type="url" className="input" value={prod.bildUrl} onChange={(e) => setProd({ ...prod, bildUrl: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <div className="field">
            <label className="label">Beschreibung <span className="text-chrome-600">(optional)</span></label>
            <textarea className="input min-h-[70px] resize-y" value={prod.beschreibung} onChange={(e) => setProd({ ...prod, beschreibung: e.target.value })} maxLength={2000} />
          </div>
          {prodEditId && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
              <input type="checkbox" className="h-4 w-4 accent-copper" checked={prod.aktiv} onChange={(e) => setProd({ ...prod, aktiv: e.target.checked })} />
              Im Marktplatz sichtbar
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setProdOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>

      {/* Haendler-Modal */}
      <Modal open={dealerOpen} onClose={() => setDealerOpen(false)} title={dealerEditId ? 'Händler bearbeiten' : 'Neuer Händler'}>
        <form onSubmit={saveDealer} className="space-y-4">
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={dealer.name} onChange={(e) => setDealer({ ...dealer, name: e.target.value })} maxLength={120} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">Webseite</label>
              <input type="url" className="input" value={dealer.webseite} onChange={(e) => setDealer({ ...dealer, webseite: e.target.value })} placeholder="https://…" />
            </div>
            <div className="field">
              <label className="label">Logo-URL</label>
              <input type="url" className="input" value={dealer.logoUrl} onChange={(e) => setDealer({ ...dealer, logoUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div className="field">
              <label className="label">Kontakt-E-Mail <span className="text-chrome-600">(Bestell-Info)</span></label>
              <input type="email" className="input" value={dealer.kontaktEmail} onChange={(e) => setDealer({ ...dealer, kontaktEmail: e.target.value })} placeholder="bestellung@haendler.de" />
            </div>
            <div className="field">
              <label className="label">Provision an Detailly (%)</label>
              <input type="number" step="0.5" min="0" max="100" className="input" value={dealer.provisionSatz} onChange={(e) => setDealer({ ...dealer, provisionSatz: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="label">Beschreibung <span className="text-chrome-600">(optional)</span></label>
            <textarea className="input min-h-[70px] resize-y" value={dealer.beschreibung} onChange={(e) => setDealer({ ...dealer, beschreibung: e.target.value })} maxLength={2000} />
          </div>
          {dealerEditId && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
              <input type="checkbox" className="h-4 w-4 accent-copper" checked={dealer.aktiv} onChange={(e) => setDealer({ ...dealer, aktiv: e.target.checked })} />
              Aktiv (Produkte sichtbar)
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setDealerOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </Modal>

      {/* Portal-Link-Anzeige (einmalig nach dem Ausstellen) */}
      <Modal open={portalLink !== null} onClose={() => setPortalLink(null)} title="Händler-Portal-Link">
        {portalLink && (
          <div className="space-y-4">
            <p className="text-sm text-chrome-300">
              Neuer Zugangslink für <strong className="text-chrome-50">{portalLink.name}</strong>. Ein evtl.
              vorheriger Link ist ab sofort ungültig. Bitte sicher an den Händler übermitteln:
            </p>
            <div className="flex items-center gap-2">
              <input className="input flex-1 font-mono text-xs" readOnly value={portalLink.url} onFocus={(e) => e.target.select()} />
              <button
                className="btn-primary btn-sm shrink-0"
                onClick={() => navigator.clipboard?.writeText(portalLink.url).catch(() => undefined)}
              >
                Kopieren
              </button>
            </div>
            <p className="text-xs text-chrome-500">
              Über diesen Link pflegt der Händler seine Produkte und wickelt Bestellungen ab – ohne eigenes Login.
            </p>
          </div>
        )}
      </Modal>

      {/* Bewerbung freigeben: Provision im Review anpassbar (Default 10 %) */}
      <Modal
        open={freigabeDealer !== null}
        onClose={() => (freigabeBusy ? undefined : setFreigabeDealer(null))}
        title={t('mpBewerbung.freigabeTitle')}
        size="sm"
      >
        {freigabeDealer && (
          <form onSubmit={freigeben} className="space-y-4">
            <p className="text-sm text-chrome-300">
              {t('mpBewerbung.freigabeText', { name: freigabeDealer.name })}
            </p>
            <div className="field">
              <label className="label" htmlFor="freigabe-provision">{t('mpBewerbung.provisionLabel')}</label>
              <input
                id="freigabe-provision"
                type="number"
                step="0.5"
                min="0"
                max="100"
                className="input"
                value={freigabeProvision}
                onChange={(e) => setFreigabeProvision(e.target.value)}
                required
              />
            </div>
            {freigabeError && <ErrorBox message={freigabeError} />}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setFreigabeDealer(null)} disabled={freigabeBusy}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary" disabled={freigabeBusy}>
                {freigabeBusy && <span className="spinner" />}
                {freigabeBusy ? t('mpBewerbung.freigabeBusy') : t('mpBewerbung.freigebenConfirm')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Freigabe-Ergebnis: Portal-Link (einmalig) + optional bestaetigter Mail-Versand */}
      <Modal
        open={freigabeErgebnis !== null}
        onClose={() => (mailBusy ? undefined : setFreigabeErgebnis(null))}
        title={t('mpBewerbung.linkTitle')}
      >
        {freigabeErgebnis && (
          <div className="space-y-4">
            <p className="text-sm text-chrome-300">
              {t('mpBewerbung.linkText', { name: freigabeErgebnis.haendler.name })}
            </p>
            <div className="flex items-center gap-2">
              <input
                className="input flex-1 font-mono text-xs"
                readOnly
                value={freigabeErgebnis.url}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="btn-primary btn-sm shrink-0"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(freigabeErgebnis.url)
                    .then(() => {
                      setLinkKopiert(true);
                      toast(t('mpBewerbung.copied'));
                    })
                    .catch(() => undefined);
                }}
              >
                {linkKopiert ? `${t('mpBewerbung.copy')} ✓` : t('mpBewerbung.copy')}
              </button>
            </div>

            {/* Review-before-send: Versand NUR nach expliziter zweiter Bestaetigung. */}
            {freigabeErgebnis.mailKonfiguriert && freigabeErgebnis.haendler.kontaktEmail ? (
              <div className="rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
                {mailFrage ? (
                  <div className="space-y-3">
                    <p className="text-sm text-chrome-200">
                      {t('mpBewerbung.mailSendTo', { email: freigabeErgebnis.haendler.kontaktEmail })}
                    </p>
                    {mailError && <ErrorBox message={mailError} />}
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost btn-sm" onClick={() => { setMailFrage(false); setMailError(''); }} disabled={mailBusy}>
                        Abbrechen
                      </button>
                      <button className="btn-primary btn-sm" onClick={portalMailSenden} disabled={mailBusy}>
                        {mailBusy && <span className="spinner" />}
                        {mailBusy ? t('mpBewerbung.mailSending') : t('mpBewerbung.mailConfirm')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn-ghost btn-sm" onClick={() => setMailFrage(true)}>
                    {t('mpBewerbung.mailSend')}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-chrome-500">{t('mpBewerbung.mailUnavailable')}</p>
            )}

            <p className="text-xs text-chrome-500">{t('mpBewerbung.linkHint')}</p>
          </div>
        )}
      </Modal>

      {/* Bewerbung ablehnen: bestaetigte, PII-sparsame Aktion */}
      <ConfirmDialog
        open={ablehnenDealer !== null}
        title={t('mpBewerbung.ablehnenTitle')}
        message={
          <div className="space-y-3">
            <p>{t('mpBewerbung.ablehnenText', { name: ablehnenDealer?.name ?? '' })}</p>
            {ablehnenError && <ErrorBox message={ablehnenError} />}
          </div>
        }
        confirmLabel={t('mpBewerbung.ablehnen')}
        busy={ablehnenBusy}
        onConfirm={ablehnen}
        onCancel={() => setAblehnenDealer(null)}
      />

      {/* Kategorie anlegen/bearbeiten (Betreiber-Admin PR7) */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title={catEditId ? t('mpAdmin.cat.editTitle') : t('mpAdmin.cat.newTitle')}>
        <form onSubmit={saveCategory} className="space-y-4">
          <div className="field">
            <label className="label">{t('mpAdmin.cat.parent')}</label>
            <select className="select" value={cat.parentId} onChange={(e) => setCat({ ...cat, parentId: e.target.value })}>
              <option value="">— {t('mpAdmin.cat.typeHaupt')}</option>
              {hauptkategorien.filter((h) => h.id !== catEditId).map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">{t('mpAdmin.cat.name')}</label>
            <input
              className="input"
              value={cat.name}
              maxLength={80}
              required
              onChange={(e) =>
                setCat((c) => ({
                  ...c,
                  name: e.target.value,
                  slug: !catEditId && !catSlugTouched ? slugify(e.target.value) : c.slug,
                }))
              }
            />
          </div>
          <div className="field">
            <label className="label">{t('mpAdmin.cat.slug')}</label>
            {catEditId ? (
              <input className="input font-mono text-sm opacity-60" value={cat.slug} readOnly />
            ) : (
              <>
                <input
                  className="input font-mono text-sm"
                  value={cat.slug}
                  maxLength={80}
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(e) => { setCatSlugTouched(true); setCat({ ...cat, slug: e.target.value }); }}
                />
                <p className="mt-1 text-xs text-chrome-500">{t('mpAdmin.cat.slugHint')}</p>
              </>
            )}
          </div>
          {!cat.parentId && (
            <div className="field">
              <label className="label">{t('mpAdmin.cat.bereich')}</label>
              <select className="select" value={cat.bereich} onChange={(e) => setCat({ ...cat, bereich: e.target.value })}>
                {Object.entries(BEREICH_KEY).map(([k, l]) => (
                  <option key={k} value={k}>{t(l)}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label className="label">{t('mpAdmin.cat.sortIndex')}</label>
            <input type="number" min="0" className="input" value={cat.sortIndex} onChange={(e) => setCat({ ...cat, sortIndex: e.target.value })} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
            <input type="checkbox" className="h-4 w-4 accent-copper" checked={cat.sdbPflicht} onChange={(e) => setCat({ ...cat, sdbPflicht: e.target.checked })} />
            {t('mpAdmin.cat.sdbPflicht')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-chrome-200">
            <input type="checkbox" className="h-4 w-4 accent-copper" checked={cat.aktiv} onChange={(e) => setCat({ ...cat, aktiv: e.target.checked })} />
            {t('mpAdmin.cat.aktiv')}
          </label>
          {catError && <ErrorBox message={catError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setCatOpen(false)}>{t('mpAdmin.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={catBusy}>
              {catBusy && <span className="spinner" />}
              {catBusy ? t('mpAdmin.saving') : t('mpAdmin.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Kategorie deaktivieren */}
      <ConfirmDialog
        open={catDeactivate !== null}
        title={t('mpAdmin.cat.deactivateTitle')}
        message={t('mpAdmin.cat.deactivateText', { name: catDeactivate?.name ?? '' })}
        confirmLabel={t('mpAdmin.cat.deactivate')}
        busy={catBusy}
        onConfirm={deactivateCategory}
        onCancel={() => setCatDeactivate(null)}
      />

      {/* Bewertung moderieren (aus-/einblenden) */}
      <ConfirmDialog
        open={modReview !== null}
        variant={modReview?.aktiv ? 'danger' : 'neutral'}
        title={modReview?.aktiv ? t('mpAdmin.mod.hideTitle') : t('mpAdmin.mod.showTitle')}
        message={modReview?.aktiv ? t('mpAdmin.mod.hideText') : t('mpAdmin.mod.showText')}
        confirmLabel={modReview?.aktiv ? t('mpAdmin.mod.ausblenden') : t('mpAdmin.mod.einblenden')}
        busy={modBusy}
        onConfirm={moderateReview}
        onCancel={() => setModReview(null)}
      />

      {/* Händler-Login: Einladung erneut senden (Review-before-send) */}
      <ConfirmDialog
        open={reinviteDealer !== null}
        variant="neutral"
        title={t('mpAdmin.dealer.reinviteTitle')}
        message={t('mpAdmin.dealer.reinviteText', { name: reinviteDealer?.name ?? '' })}
        confirmLabel={t('mpAdmin.dealer.reinvite')}
        busy={reinviteBusy}
        onConfirm={reinviteHaendler}
        onCancel={() => setReinviteDealer(null)}
      />

      {/* Händler-Login deaktivieren (Sessions werden ungültig) */}
      <ConfirmDialog
        open={deaktDealer !== null}
        title={t('mpAdmin.dealer.deactivateTitle')}
        message={t('mpAdmin.dealer.deactivateText', { name: deaktDealer?.name ?? '' })}
        confirmLabel={t('mpAdmin.dealer.deactivate')}
        busy={deaktBusy}
        onConfirm={deactivateHaendler}
        onCancel={() => setDeaktDealer(null)}
      />
    </div>
  );
}
