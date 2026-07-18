'use client';

// Angemeldetes Haendler-Portal (Marktplatz-Ausbau PR8). Zugang ueber ein echtes
// Login-Konto mit role=haendler (dealerId + tenantId=null). Der Haendler pflegt
// hier eigene Produkte inkl. Galerie-Bildern und Sicherheitsdatenblatt (SDB) und
// wickelt Marktplatz-Bestellungen ab.
//
// BEWUSST eine Top-Level-Route (NICHT unter (app)): der (app)-Shell traegt die
// Tenant-Navigation, die fuer einen Haendler mit tenantId=null leer/falsch waere.
// Diese Seite bringt ihr eigenes, schlankes, dealer-gebrandetes Layout mit.
//
// SICHERHEIT: dealerId wird NIE vom Client mitgeschickt – das Backend nimmt sie
// aus dem JWT (@Roles(HAENDLER)). Der Guard hier ist Defense-in-Depth. Produkt-
// texte werden ausschliesslich per React-Auto-Escape gerendert (kein HTML).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, absoluteApiUrl, getToken, downloadAuthed } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT, useLanguage, LanguageSwitcher } from '@/lib/i18n';
import { eur } from '@/lib/format';
import { BEREICH_KEY } from '@/lib/labels';
import { PublicShell } from '@/components/PublicShell';
import { BrandTile } from '@/components/brand';
import { LoadingCard, ErrorBox, Empty, StatCard, ToastProvider, useToast } from '@/components/ui';
import {
  StreamBild,
  GradientFallback,
  Herkunft,
} from '@/app/(app)/marktplatz/shared';
import type {
  MarketplaceOrder,
  MarketplaceOrderStatus,
  MarketplaceProduct,
  MarketplaceProductImage,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Datentypen der Portal-Uebersicht (GET /haendler-portal/overview).
// ---------------------------------------------------------------------------

/** Produkt aus der Portal-Uebersicht (volle Entitaet + Galerie-Bild-Referenzen). */
interface PortalProduct extends MarketplaceProduct {
  bilder?: MarketplaceProductImage[];
  /** Zeitpunkt des letzten SDB-Uploads (null = kein SDB hinterlegt). */
  sdbHochgeladenAm?: string | null;
}

interface PortalDaten {
  haendler: { id: string; name: string; logoUrl?: string | null; provisionSatz: number };
  produkte: PortalProduct[];
  bestellungen: MarketplaceOrder[];
}

type Tab = 'uebersicht' | 'produkte' | 'bestellungen';

// Erlaubte Bild-/SDB-Grenzen – identisch zum Backend (marketplace-upload.service).
const MAX_BILD_BYTES = 5 * 1024 * 1024;
const MAX_SDB_BYTES = 10 * 1024 * 1024;
const MAX_BILDER = 8;
const BILD_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Upload mit echtem Fortschritt (XHR statt fetch – fetch kann keinen Upload-
// Progress liefern). Bearer aus getToken(), Ziel-URL aus absoluteApiUrl().
// ---------------------------------------------------------------------------

function uploadMitFortschritt(
  path: string,
  form: FormData,
  onProgress: (frac: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', absoluteApiUrl(path));
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null);
        } catch {
          resolve(null);
        }
        return;
      }
      let msg = `Fehler ${xhr.status}`;
      try {
        const b = JSON.parse(xhr.responseText);
        msg = Array.isArray(b.message) ? b.message.join(', ') : b.message || msg;
      } catch {
        /* keine JSON-Fehlermeldung – generische Meldung behalten */
      }
      reject(new ApiError(xhr.status, msg));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Netzwerkfehler beim Upload'));
    xhr.send(form);
  });
}

// ---------------------------------------------------------------------------
// Seite: Guard + Datenladen + gebrandetes Layout. Der eigentliche Inhalt lebt in
// <PortalInhalt> innerhalb eines lokalen ToastProviders (Erfolgs-Rueckmeldungen).
// ---------------------------------------------------------------------------

export default function HaendlerPortalPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const t = useT();
  const router = useRouter();

  const [daten, setDaten] = useState<PortalDaten | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const istHaendler = !!user && user.role === 'haendler';

  // Guard (Defense-in-Depth): nicht eingeloggt -> Login, falsche Rolle -> Dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'haendler') {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const laden = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get<PortalDaten>('/haendler-portal/overview')
      .then(setDaten)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? t('haendlerportal.error.noAccess')
            : t('haendlerportal.error.load'),
        ),
      )
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (istHaendler) laden();
  }, [istHaendler, laden]);

  return (
    <PublicShell width="wide">
      <ToastProvider>
        {/* Gebrandeter Kopf: Firmenname + Provision, rechts Sprache + Abmelden. */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandTile size="md" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">
                {t('haendlerportal.eyebrow')}
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-chrome-50 sm:text-3xl">
                {daten?.haendler.name ?? 'Detailly'}
              </h1>
              {daten && (
                <p className="mt-0.5 text-sm text-chrome-400">
                  {t('haendlerportal.provision', { satz: Number(daten.haendler.provisionSatz) })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button className="btn-subtle btn-sm" onClick={logout}>
              {t('haendlerportal.logout')}
            </button>
          </div>
        </header>

        {authLoading || !istHaendler ? (
          <LoadingCard label={t('haendlerportal.guard.checking')} />
        ) : loading ? (
          <LoadingCard label={t('haendlerportal.loading')} />
        ) : error ? (
          <ErrorBox message={error} />
        ) : daten ? (
          <PortalInhalt daten={daten} onChanged={laden} />
        ) : null}
      </ToastProvider>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// Tabs + Inhalt.
// ---------------------------------------------------------------------------

function PortalInhalt({ daten, onChanged }: { daten: PortalDaten; onChanged: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('uebersicht');

  const offene = daten.bestellungen.filter((b) => b.status === 'eingegangen').length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'uebersicht', label: t('haendlerportal.tab.overview') },
    { key: 'produkte', label: t('haendlerportal.tab.products', { n: daten.produkte.length }) },
    {
      key: 'bestellungen',
      label:
        offene > 0
          ? t('haendlerportal.tab.ordersNew', { n: offene })
          : t('haendlerportal.tab.orders'),
    },
  ];

  return (
    <>
      <nav className="mb-5 flex flex-wrap items-center gap-2" aria-label={t('haendlerportal.tab.overview')}>
        {tabs.map((x) => (
          <button
            key={x.key}
            className={tab === x.key ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
            onClick={() => setTab(x.key)}
            aria-current={tab === x.key ? 'page' : undefined}
          >
            {x.label}
          </button>
        ))}
      </nav>

      <div className="animate-fade-in">
        {tab === 'uebersicht' && <UebersichtTab daten={daten} onGoto={setTab} />}
        {tab === 'produkte' && <ProduktTab produkte={daten.produkte} onChanged={onChanged} />}
        {tab === 'bestellungen' && (
          <BestellTab bestellungen={daten.bestellungen} onChanged={onChanged} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Uebersicht: Kennzahlen + Kurzlisten.
// ---------------------------------------------------------------------------

function UebersichtTab({ daten, onGoto }: { daten: PortalDaten; onGoto: (tab: Tab) => void }) {
  const t = useT();
  const aktive = daten.produkte.filter((p) => p.aktiv).length;
  const offene = daten.bestellungen.filter((b) => b.status === 'eingegangen').length;
  const letzte = daten.bestellungen.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t('haendlerportal.kpi.products')} value={daten.produkte.length} hint={t('haendlerportal.kpi.productsActive', { n: aktive })} />
        <StatCard label={t('haendlerportal.kpi.ordersOpen')} value={offene} accent={offene > 0} />
        <StatCard label={t('haendlerportal.kpi.ordersTotal')} value={daten.bestellungen.length} />
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-chrome-50">
            {t('haendlerportal.overview.recentOrders')}
          </h2>
          <button className="btn-ghost btn-sm" onClick={() => onGoto('bestellungen')}>
            {t('haendlerportal.overview.allOrders')}
          </button>
        </div>
        {letzte.length === 0 ? (
          <Empty text={t('haendlerportal.orders.empty')} />
        ) : (
          <ul className="divide-y divide-ink-700/60">
            {letzte.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-chrome-100">{o.nummer}</span>
                  <StatusBadge status={o.status} />
                </span>
                <span className="text-chrome-400">{eur(Number(o.summeBrutto))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bestellungen: Liste + erlaubte Statusuebergaenge.
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<MarketplaceOrderStatus, string> = {
  eingegangen: 'badge-info',
  bestaetigt: 'badge-caution',
  versendet: 'badge-positive',
  storniert: 'badge-danger',
};

function StatusBadge({ status }: { status: MarketplaceOrderStatus }) {
  const t = useT();
  return <span className={STATUS_BADGE[status] ?? 'badge-neutral'}>{t(`haendlerportal.status.${status}`)}</span>;
}

/** Erlaubte naechste Schritte je Status (muss zum Backend passen). */
const NAECHSTE: Record<MarketplaceOrderStatus, { status: MarketplaceOrderStatus; labelKey: string; klasse: string }[]> = {
  eingegangen: [
    { status: 'bestaetigt', labelKey: 'haendlerportal.orders.confirm', klasse: 'btn-primary btn-sm' },
    { status: 'storniert', labelKey: 'haendlerportal.orders.cancel', klasse: 'btn-danger btn-sm' },
  ],
  bestaetigt: [
    { status: 'versendet', labelKey: 'haendlerportal.orders.ship', klasse: 'btn-primary btn-sm' },
    { status: 'storniert', labelKey: 'haendlerportal.orders.cancel', klasse: 'btn-danger btn-sm' },
  ],
  versendet: [],
  storniert: [],
};

function BestellTab({
  bestellungen,
  onChanged,
}: {
  bestellungen: MarketplaceOrder[];
  onChanged: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');

  async function setStatus(orderId: string, status: MarketplaceOrderStatus) {
    setBusyId(orderId);
    setFehler('');
    try {
      await api.patch(`/haendler-portal/orders/${orderId}/status`, { status });
      toast(t('haendlerportal.orders.statusSaved'));
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.orders.statusError'));
    } finally {
      setBusyId(null);
    }
  }

  if (bestellungen.length === 0) {
    return (
      <div className="card">
        <Empty text={t('haendlerportal.orders.empty')} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fehler && <ErrorBox message={fehler} />}
      {bestellungen.map((o) => {
        const lieferzeile = [o.lieferStrasse, [o.lieferPlz, o.lieferOrt].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');
        return (
          <div key={o.id} className="card-flush p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-chrome-50">{o.nummer}</span>
                <StatusBadge status={o.status} />
              </div>
              <span className="text-sm text-chrome-400">
                {new Date(o.createdAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · <strong className="text-chrome-100">{eur(Number(o.summeBrutto))}</strong>
              </span>
            </div>

            <div className="mt-3 grid gap-3 border-t border-ink-700/60 pt-3 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                {(o.positionen ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-chrome-300">
                    <span>
                      {i.menge} × {i.produktName}
                    </span>
                    <span className="text-chrome-400">{eur(Number(i.zeilenSumme))}</span>
                  </div>
                ))}
              </div>
              <div className="text-chrome-300">
                <p className="font-medium text-chrome-100">{o.lieferFirma || o.kontaktName}</p>
                {lieferzeile && <p>{lieferzeile}</p>}
                <p className="text-chrome-400">
                  {o.kontaktName} · {o.kontaktEmail}
                  {o.kontaktTelefon ? ` · ${o.kontaktTelefon}` : ''}
                </p>
                {o.notiz && (
                  <p className="mt-1 rounded-lg bg-ink-900/60 px-2 py-1 text-xs text-chrome-400">„{o.notiz}“</p>
                )}
              </div>
            </div>

            {NAECHSTE[o.status].length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
                {NAECHSTE[o.status].map((n) => (
                  <button
                    key={n.status}
                    className={n.klasse}
                    disabled={busyId === o.id}
                    onClick={() => setStatus(o.id, n.status)}
                  >
                    {busyId === o.id ? <span className="spinner" /> : t(n.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Produkte: Liste + Formular (inkl. Bild- und SDB-Upload).
// ---------------------------------------------------------------------------

const LEERES_PRODUKT = {
  name: '',
  bereich: 'folierung',
  marke: '',
  kategorie: '',
  preis: '',
  preisHinweis: '',
  bildUrl: '',
  affiliateUrl: '',
  beschreibung: '',
  bestellbar: true,
};
type ProduktForm = typeof LEERES_PRODUKT;

function ProduktTab({ produkte, onChanged }: { produkte: PortalProduct[]; onChanged: () => void }) {
  const t = useT();
  const toast = useToast();
  const { lang } = useLanguage();

  const [form, setForm] = useState<ProduktForm>(LEERES_PRODUKT);
  const [editProdukt, setEditProdukt] = useState<PortalProduct | null>(null);
  const [offen, setOffen] = useState(false);
  const [sende, setSende] = useState(false);
  const [fehler, setFehler] = useState('');
  const [loeschAktiv, setLoeschAktiv] = useState<string | null>(null);

  function neu() {
    setEditProdukt(null);
    setForm(LEERES_PRODUKT);
    setFehler('');
    setOffen(true);
  }

  function bearbeiten(p: PortalProduct) {
    setEditProdukt(p);
    setForm({
      name: p.name,
      bereich: p.bereich ?? 'sonstiges',
      marke: p.marke ?? '',
      kategorie: p.kategorie ?? '',
      preis: p.preis != null ? String(p.preis) : '',
      preisHinweis: p.preisHinweis ?? '',
      bildUrl: p.bildUrl ?? '',
      affiliateUrl: p.affiliateUrl ?? '',
      beschreibung: p.beschreibung ?? '',
      bestellbar: !!p.bestellbar,
    });
    setFehler('');
    setOffen(true);
  }

  function schliessen() {
    setOffen(false);
    setEditProdukt(null);
    setForm(LEERES_PRODUKT);
  }

  async function speichern() {
    setSende(true);
    setFehler('');
    // Nur DTO-Felder senden (Backend: whitelist + forbidNonWhitelisted).
    const body = {
      name: form.name.trim(),
      bereich: form.bereich,
      marke: form.marke.trim() || undefined,
      kategorie: form.kategorie.trim() || undefined,
      preis: form.preis === '' ? undefined : Number(form.preis),
      preisHinweis: form.preisHinweis.trim() || undefined,
      bildUrl: form.bildUrl.trim() || undefined,
      affiliateUrl: form.affiliateUrl.trim() || undefined,
      beschreibung: form.beschreibung.trim() || undefined,
      bestellbar: form.bestellbar,
    };
    try {
      if (editProdukt) {
        await api.patch(`/haendler-portal/products/${editProdukt.id}`, body);
      } else {
        await api.post(`/haendler-portal/products`, body);
      }
      toast(t('haendlerportal.products.saved'));
      schliessen();
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.products.saveError'));
    } finally {
      setSende(false);
    }
  }

  async function aktivToggle(p: PortalProduct) {
    setLoeschAktiv(p.id);
    try {
      await api.patch(`/haendler-portal/products/${p.id}`, { aktiv: !p.aktiv });
      toast(p.aktiv ? t('haendlerportal.products.deactivated') : t('haendlerportal.products.activated'));
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.products.saveError'));
    } finally {
      setLoeschAktiv(null);
    }
  }

  return (
    <div className="space-y-4">
      {fehler && !offen && <ErrorBox message={fehler} />}

      {!offen ? (
        <button className="btn-primary" onClick={neu}>
          {t('haendlerportal.products.new')}
        </button>
      ) : (
        <ProduktFormular
          form={form}
          setForm={setForm}
          editProdukt={editProdukt}
          sende={sende}
          fehler={fehler}
          onSpeichern={speichern}
          onAbbrechen={schliessen}
          onUploadsChanged={onChanged}
        />
      )}

      {produkte.length === 0 ? (
        <div className="card">
          <Empty text={t('haendlerportal.products.empty')} />
        </div>
      ) : (
        <div className="space-y-2">
          {produkte.map((p) => {
            const bildId = p.bilder && p.bilder.length > 0 ? p.bilder[0].id : null;
            return (
              <div key={p.id} className="card-flush flex flex-wrap items-center gap-3 p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
                  {bildId ? (
                    <StreamBild
                      path={`/haendler-portal/products/${p.id}/bild/${bildId}`}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      fallback={<GradientFallback text={p.name} />}
                    />
                  ) : (
                    <GradientFallback text={p.name} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 truncate text-sm font-semibold text-chrome-50">
                    {p.name}
                    {!p.aktiv && <span className="badge-neutral">{t('haendlerportal.products.inactive')}</span>}
                    {p.bestellbar && <span className="badge-copper">{t('haendlerportal.products.orderable')}</span>}
                    {p.sdbHochgeladenAm && <span className="badge-positive">{t('haendlerportal.sdb.badge')}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-chrome-500">
                    <span>
                      {[p.marke, t(BEREICH_KEY[p.bereich ?? 'sonstiges'] ?? 'labels.bereich.sonstiges')]
                        .filter(Boolean)
                        .join(' · ')}
                      {p.preis != null
                        ? ` · ${p.preisHinweis ? `${p.preisHinweis} ` : ''}${eur(Number(p.preis))}`
                        : ''}
                    </span>
                    {p.herkunftsland && (
                      <Herkunft iso={p.herkunftsland} lang={lang} className="text-chrome-400" />
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button className="btn-subtle btn-sm" onClick={() => bearbeiten(p)}>
                    {t('haendlerportal.products.edit')}
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={loeschAktiv === p.id}
                    onClick={() => aktivToggle(p)}
                  >
                    {loeschAktiv === p.id ? (
                      <span className="spinner" />
                    ) : p.aktiv ? (
                      t('haendlerportal.products.deactivate')
                    ) : (
                      t('haendlerportal.products.activate')
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-chrome-500">{t('haendlerportal.products.footerHint')}</p>
    </div>
  );
}

function ProduktFormular({
  form,
  setForm,
  editProdukt,
  sende,
  fehler,
  onSpeichern,
  onAbbrechen,
  onUploadsChanged,
}: {
  form: ProduktForm;
  setForm: React.Dispatch<React.SetStateAction<ProduktForm>>;
  editProdukt: PortalProduct | null;
  sende: boolean;
  fehler: string;
  onSpeichern: () => void;
  onAbbrechen: () => void;
  onUploadsChanged: () => void;
}) {
  const t = useT();
  const set =
    (k: keyof ProduktForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  // SDB-Rechtshinweis prominent im Chemie-/Pflege-Bereich (REACH/CLP).
  const chemie = form.bereich === 'aufbereitung';

  return (
    <div className="card space-y-4">
      <h2 className="font-display text-lg font-semibold text-chrome-50">
        {editProdukt ? t('haendlerportal.products.editTitle') : t('haendlerportal.products.newTitle')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">
            {t('haendlerportal.field.name')} <span className="text-copper">*</span>
          </span>
          <input className="input" value={form.name} onChange={set('name')} maxLength={150} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">
            {t('haendlerportal.field.bereich')} <span className="text-copper">*</span>
          </span>
          <select className="select" value={form.bereich} onChange={set('bereich')}>
            {Object.entries(BEREICH_KEY).map(([k, l]) => (
              <option key={k} value={k}>
                {t(l)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.marke')}</span>
          <input className="input" value={form.marke} onChange={set('marke')} maxLength={60} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.kategorie')}</span>
          <input className="input" value={form.kategorie} onChange={set('kategorie')} maxLength={60} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.preis')}</span>
          <input className="input" type="number" min="0" step="0.01" value={form.preis} onChange={set('preis')} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.preisHinweis')}</span>
          <input className="input" value={form.preisHinweis} onChange={set('preisHinweis')} maxLength={40} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.bildUrl')}</span>
          <input className="input" value={form.bildUrl} onChange={set('bildUrl')} inputMode="url" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.affiliateUrl')}</span>
          <input className="input" value={form.affiliateUrl} onChange={set('affiliateUrl')} inputMode="url" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-chrome-400">{t('haendlerportal.field.beschreibung')}</span>
          <textarea
            className="input min-h-[72px]"
            value={form.beschreibung}
            onChange={set('beschreibung')}
            maxLength={2000}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-chrome-200">
        <input
          type="checkbox"
          checked={form.bestellbar}
          onChange={(e) => setForm((f) => ({ ...f, bestellbar: e.target.checked }))}
        />
        {t('haendlerportal.field.bestellbar')}
      </label>

      {/* Bilder + SDB: erst nach dem ersten Speichern moeglich (brauchen productId). */}
      {editProdukt ? (
        <div className="space-y-4 border-t border-ink-700/60 pt-4">
          <BilderUpload produkt={editProdukt} onChanged={onUploadsChanged} />
          <SdbUpload produkt={editProdukt} chemie={chemie} onChanged={onUploadsChanged} />
        </div>
      ) : (
        <div className="rounded-xl border border-ink-700 bg-ink-900/50 px-4 py-3 text-xs text-chrome-400">
          {t('haendlerportal.uploads.saveFirst')}
        </div>
      )}

      {fehler && <ErrorBox message={fehler} />}

      <div className="flex items-center justify-end gap-2">
        <button className="btn-ghost" onClick={onAbbrechen} disabled={sende}>
          {t('common.cancel')}
        </button>
        <button className="btn-primary" onClick={onSpeichern} disabled={sende || !form.name.trim()}>
          {sende && <span className="spinner" />}
          {sende ? t('haendlerportal.products.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bild-Upload: Drag&Drop, Mehrfach, Vorschau (auth. Stream), Loeschen.
// ---------------------------------------------------------------------------

function BilderUpload({ produkt, onChanged }: { produkt: PortalProduct; onChanged: () => void }) {
  const t = useT();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [bilder, setBilder] = useState<MarketplaceProductImage[]>(
    [...(produkt.bilder ?? [])].sort((a, b) => a.sortIndex - b.sortIndex),
  );
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fehler, setFehler] = useState('');
  const [loeschId, setLoeschId] = useState<string | null>(null);

  async function dateienHinzufuegen(files: FileList | null) {
    setFehler('');
    if (!files || files.length === 0) return;
    const liste = Array.from(files);
    if (bilder.length + liste.length > MAX_BILDER) {
      setFehler(t('haendlerportal.images.max', { n: MAX_BILDER }));
      return;
    }
    for (const f of liste) {
      if (!BILD_MIMES.includes(f.type)) {
        setFehler(t('haendlerportal.images.errorType'));
        return;
      }
      if (f.size > MAX_BILD_BYTES) {
        setFehler(t('haendlerportal.images.errorSize'));
        return;
      }
    }
    const fd = new FormData();
    liste.forEach((f) => fd.append('bilder', f));
    setBusy(true);
    setProgress(0);
    try {
      const neu = (await uploadMitFortschritt(
        `/haendler-portal/products/${produkt.id}/bilder`,
        fd,
        setProgress,
      )) as MarketplaceProductImage[] | null;
      if (Array.isArray(neu)) {
        setBilder((b) => [...b, ...neu].sort((a, c) => a.sortIndex - c.sortIndex));
      }
      toast(t('haendlerportal.images.uploaded'));
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.upload.error'));
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function loeschen(imageId: string) {
    setLoeschId(imageId);
    setFehler('');
    try {
      await api.delete(`/haendler-portal/products/${produkt.id}/bilder/${imageId}`);
      setBilder((b) => b.filter((x) => x.id !== imageId));
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.upload.error'));
    } finally {
      setLoeschId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-chrome-100">{t('haendlerportal.images.title')}</h3>
        <p className="text-xs text-chrome-500">{t('haendlerportal.images.hint', { n: MAX_BILDER })}</p>
      </div>

      {bilder.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {bilder.map((b) => (
            <li
              key={b.id}
              className="group relative h-20 w-20 overflow-hidden rounded-lg border border-ink-700 bg-ink-850"
            >
              <StreamBild
                path={`/haendler-portal/products/${produkt.id}/bild/${b.id}`}
                alt={produkt.name}
                className="h-full w-full object-cover"
                fallback={<GradientFallback text={produkt.name} />}
              />
              <button
                type="button"
                onClick={() => loeschen(b.id)}
                disabled={loeschId === b.id}
                aria-label={t('haendlerportal.images.delete')}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-ink-950/80 text-chrome-200 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              >
                {loeschId === b.id ? (
                  <span className="spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {bilder.length < MAX_BILDER && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            dateienHinzufuegen(e.dataTransfer.files);
          }}
          className={`rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
            drag ? 'border-copper bg-copper-soft' : 'border-ink-700 bg-ink-900/40'
          }`}
        >
          {busy ? (
            <div className="mx-auto max-w-xs space-y-2">
              <p className="text-sm text-chrome-300">{t('haendlerportal.images.uploading')}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full bg-copper transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-chrome-300">{t('haendlerportal.images.drop')}</p>
              <button
                type="button"
                className="btn-subtle btn-sm mt-2"
                onClick={() => inputRef.current?.click()}
              >
                {t('haendlerportal.images.choose')}
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => dateienHinzufuegen(e.target.files)}
          />
        </div>
      )}

      {fehler && <ErrorBox message={fehler} withGame={false} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SDB-Upload: PDF, prominent, mit REACH/CLP-Rechtshinweis.
// ---------------------------------------------------------------------------

function SdbUpload({
  produkt,
  chemie,
  onChanged,
}: {
  produkt: PortalProduct;
  chemie: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hatSdb, setHatSdb] = useState(!!produkt.sdbHochgeladenAm);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fehler, setFehler] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);

  async function hochladen(file: File | null) {
    setFehler('');
    if (!file) return;
    const istPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!istPdf) {
      setFehler(t('haendlerportal.sdb.errorType'));
      return;
    }
    if (file.size > MAX_SDB_BYTES) {
      setFehler(t('haendlerportal.sdb.errorSize'));
      return;
    }
    const fd = new FormData();
    fd.append('sdb', file);
    setBusy(true);
    setProgress(0);
    try {
      await uploadMitFortschritt(`/haendler-portal/products/${produkt.id}/sdb`, fd, setProgress);
      setHatSdb(true);
      toast(t('haendlerportal.sdb.uploaded'));
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.upload.error'));
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function ansehen() {
    setDownloadBusy(true);
    setFehler('');
    try {
      await downloadAuthed(`/haendler-portal/products/${produkt.id}/sdb`, 'sicherheitsdatenblatt.pdf');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('haendlerportal.upload.error'));
    } finally {
      setDownloadBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-chrome-100">{t('haendlerportal.sdb.title')}</h3>
        {hatSdb ? (
          <span className="badge-positive">{t('haendlerportal.sdb.present')}</span>
        ) : (
          <span className="badge-neutral">{t('haendlerportal.sdb.none')}</span>
        )}
      </div>

      {/* Rechtshinweis: im Chemie-/Pflegebereich prominent, sonst dezent. */}
      <div
        className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
          chemie ? 'border-caution/30 bg-caution-soft text-caution' : 'border-ink-700 bg-ink-900/60 text-chrome-400'
        }`}
      >
        <p>{t('haendlerportal.sdb.legal')}</p>
        <p className="mt-1">{t('haendlerportal.sdb.softRequire')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-subtle btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <span className="spinner" /> : null}
          {hatSdb ? t('haendlerportal.sdb.replace') : t('haendlerportal.sdb.upload')}
        </button>
        {hatSdb && (
          <button type="button" className="btn-ghost btn-sm" onClick={ansehen} disabled={downloadBusy}>
            {downloadBusy ? <span className="spinner" /> : null}
            {t('haendlerportal.sdb.download')}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => hochladen(e.target.files?.[0] ?? null)}
        />
      </div>

      {busy && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-copper transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {fehler && <ErrorBox message={fehler} withGame={false} />}
    </div>
  );
}
