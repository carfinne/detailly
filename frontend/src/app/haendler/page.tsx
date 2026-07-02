'use client';

// Oeffentliches Haendler-Portal. Kein Login: der Zugang ist der geheime
// Portal-Token in der URL (?t=...), ausgestellt vom Detailly-Team. Haendler
// pflegen hier ihre Produkte und wickeln Marktplatz-Bestellungen ab.
// Statischer Export -> Token clientseitig aus window.location (wie /track).

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import type { MarketplaceOrder, MarketplaceOrderStatus, MarketplaceProduct } from '@/lib/types';

interface PortalDaten {
  haendler: { id: string; name: string; logoUrl?: string; provisionSatz: number };
  produkte: MarketplaceProduct[];
  bestellungen: MarketplaceOrder[];
}

const STATUS_META: Record<MarketplaceOrderStatus, { label: string; badge: string }> = {
  eingegangen: { label: 'Eingegangen', badge: 'badge-info' },
  bestaetigt: { label: 'Bestätigt', badge: 'badge-caution' },
  versendet: { label: 'Versendet', badge: 'badge-positive' },
  storniert: { label: 'Storniert', badge: 'badge-danger' },
};

/** Erlaubte naechste Schritte je Status (muss zum Backend passen). */
const NAECHSTE: Record<MarketplaceOrderStatus, { status: MarketplaceOrderStatus; label: string; klasse: string }[]> = {
  eingegangen: [
    { status: 'bestaetigt', label: 'Bestätigen', klasse: 'btn-primary btn-sm' },
    { status: 'storniert', label: 'Stornieren', klasse: 'btn-danger btn-sm' },
  ],
  bestaetigt: [
    { status: 'versendet', label: 'Als versendet markieren', klasse: 'btn-primary btn-sm' },
    { status: 'storniert', label: 'Stornieren', klasse: 'btn-danger btn-sm' },
  ],
  versendet: [],
  storniert: [],
};

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
}

const LEERES_PRODUKT = {
  name: '',
  kategorie: '',
  preis: '',
  preisHinweis: '',
  bildUrl: '',
  affiliateUrl: '',
  beschreibung: '',
  bestellbar: true,
};

export default function HaendlerPortalPage() {
  const [token, setToken] = useState('');
  const [daten, setDaten] = useState<PortalDaten | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'bestellungen' | 'produkte'>('bestellungen');

  const laden = useCallback((tok: string) => {
    api
      .get<PortalDaten>(`/public/haendler/${encodeURIComponent(tok)}`)
      .then(setDaten)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Dieses Portal wurde nicht gefunden. Bitte den vollständigen Link aus der E-Mail von Detailly verwenden.'
            : 'Das Portal konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tok = readToken();
    setToken(tok);
    if (!tok) {
      setLoading(false);
      setError('Kein Zugangslink angegeben. Bitte den vollständigen Portal-Link verwenden.');
      return;
    }
    laden(tok);
  }, [laden]);

  const offene = daten?.bestellungen.filter((b) => b.status === 'eingegangen').length ?? 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900 p-4 sm:p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl animate-fade-in">
        {loading ? (
          <div className="card text-center text-chrome-400">Lädt…</div>
        ) : error ? (
          <div className="card mx-auto max-w-lg text-center text-sm text-chrome-300">{error}</div>
        ) : daten ? (
          <>
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-copper-300">
                  Detailly · Händler-Portal
                </p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-chrome-50">
                  {daten.haendler.name}
                </h1>
                <p className="mt-1 text-sm text-chrome-400">
                  Provision an Detailly: {Number(daten.haendler.provisionSatz)} % je Bestellung
                </p>
              </div>
              <nav className="flex items-center gap-2">
                <button
                  className={tab === 'bestellungen' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
                  onClick={() => setTab('bestellungen')}
                >
                  Bestellungen{offene > 0 ? ` (${offene} neu)` : ''}
                </button>
                <button
                  className={tab === 'produkte' ? 'btn-primary btn-sm' : 'btn-subtle btn-sm'}
                  onClick={() => setTab('produkte')}
                >
                  Produkte ({daten.produkte.length})
                </button>
              </nav>
            </header>

            {tab === 'bestellungen' ? (
              <BestellListe token={token} bestellungen={daten.bestellungen} onChanged={() => laden(token)} />
            ) : (
              <ProduktPflege token={token} produkte={daten.produkte} onChanged={() => laden(token)} />
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function BestellListe({
  token,
  bestellungen,
  onChanged,
}: {
  token: string;
  bestellungen: MarketplaceOrder[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');

  async function setStatus(orderId: string, status: MarketplaceOrderStatus) {
    setBusyId(orderId);
    setFehler('');
    try {
      await api.patch(`/public/haendler/${encodeURIComponent(token)}/orders/${orderId}/status`, { status });
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Status konnte nicht geändert werden');
    } finally {
      setBusyId(null);
    }
  }

  if (bestellungen.length === 0) {
    return <div className="card text-center text-sm text-chrome-400">Noch keine Bestellungen eingegangen.</div>;
  }

  return (
    <div className="space-y-3">
      {fehler && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{fehler}</div>
      )}
      {bestellungen.map((o) => {
        const meta = STATUS_META[o.status] ?? { label: o.status, badge: 'badge-neutral' };
        const lieferzeile = [o.lieferStrasse, [o.lieferPlz, o.lieferOrt].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ');
        return (
          <div key={o.id} className="card-flush p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-chrome-50">{o.nummer}</span>
                <span className={meta.badge}>{meta.label}</span>
              </div>
              <span className="text-sm text-chrome-400">
                {new Date(o.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{' '}
                · <strong className="text-chrome-100">{eur(Number(o.summeBrutto))}</strong>
              </span>
            </div>

            <div className="mt-3 grid gap-3 border-t border-ink-700/60 pt-3 text-sm sm:grid-cols-2">
              <div className="space-y-0.5">
                {(o.positionen ?? []).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-chrome-300">
                    <span>{i.menge} × {i.produktName}</span>
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
                {o.notiz && <p className="mt-1 rounded-lg bg-ink-900/60 px-2 py-1 text-xs text-chrome-400">„{o.notiz}"</p>}
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
                    {busyId === o.id ? '…' : n.label}
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

function ProduktPflege({
  token,
  produkte,
  onChanged,
}: {
  token: string;
  produkte: MarketplaceProduct[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState<typeof LEERES_PRODUKT>(LEERES_PRODUKT);
  const [editId, setEditId] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);
  const [sende, setSende] = useState(false);
  const [fehler, setFehler] = useState('');

  function bearbeiten(p: MarketplaceProduct) {
    setEditId(p.id);
    setForm({
      name: p.name,
      kategorie: p.kategorie ?? '',
      preis: p.preis != null ? String(p.preis) : '',
      preisHinweis: p.preisHinweis ?? '',
      bildUrl: p.bildUrl ?? '',
      affiliateUrl: p.affiliateUrl ?? '',
      beschreibung: p.beschreibung ?? '',
      bestellbar: !!p.bestellbar,
    });
    setOffen(true);
    setFehler('');
  }

  async function speichern() {
    setSende(true);
    setFehler('');
    const body = {
      name: form.name.trim(),
      kategorie: form.kategorie.trim(),
      preis: form.preis === '' ? undefined : Number(form.preis),
      preisHinweis: form.preisHinweis.trim() || undefined,
      bildUrl: form.bildUrl.trim() || undefined,
      affiliateUrl: form.affiliateUrl.trim() || undefined,
      beschreibung: form.beschreibung.trim() || undefined,
      bestellbar: form.bestellbar,
    };
    try {
      if (editId) {
        await api.patch(`/public/haendler/${encodeURIComponent(token)}/products/${editId}`, body);
      } else {
        await api.post(`/public/haendler/${encodeURIComponent(token)}/products`, body);
      }
      setOffen(false);
      setEditId(null);
      setForm(LEERES_PRODUKT);
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setSende(false);
    }
  }

  async function aktivToggle(p: MarketplaceProduct) {
    try {
      await api.patch(`/public/haendler/${encodeURIComponent(token)}/products/${p.id}`, { aktiv: !p.aktiv });
      onChanged();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Änderung fehlgeschlagen');
    }
  }

  const set = (k: keyof typeof LEERES_PRODUKT) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      {fehler && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{fehler}</div>
      )}

      {!offen ? (
        <button
          className="btn-primary"
          onClick={() => {
            setEditId(null);
            setForm(LEERES_PRODUKT);
            setOffen(true);
          }}
        >
          + Neues Produkt einstellen
        </button>
      ) : (
        <div className="card space-y-3">
          <h2 className="font-display text-lg font-semibold text-chrome-50">
            {editId ? 'Produkt bearbeiten' : 'Neues Produkt'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-chrome-400">Name*</span>
              <input className="input" value={form.name} onChange={set('name')} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-chrome-400">Kategorie* (z. B. Folien, Chemie)</span>
              <input className="input" value={form.kategorie} onChange={set('kategorie')} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-chrome-400">Preis (EUR)</span>
              <input className="input" type="number" min="0" step="0.01" value={form.preis} onChange={set('preis')} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-chrome-400">Preis-Zusatz (z. B. „pro Rolle")</span>
              <input className="input" value={form.preisHinweis} onChange={set('preisHinweis')} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-chrome-400">Bild-URL (https)</span>
              <input className="input" value={form.bildUrl} onChange={set('bildUrl')} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-chrome-400">Externer Shop-/Affiliate-Link (optional)</span>
              <input className="input" value={form.affiliateUrl} onChange={set('affiliateUrl')} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-chrome-400">Beschreibung</span>
              <textarea className="input min-h-[70px]" value={form.beschreibung} onChange={set('beschreibung')} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-chrome-200">
            <input
              type="checkbox"
              checked={form.bestellbar}
              onChange={(e) => setForm((f) => ({ ...f, bestellbar: e.target.checked }))}
            />
            Direkt über Detailly bestellbar (fester Preis nötig)
          </label>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOffen(false)} disabled={sende}>Abbrechen</button>
            <button
              className="btn-primary"
              onClick={speichern}
              disabled={sende || !form.name.trim() || !form.kategorie.trim()}
            >
              {sende ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </div>
      )}

      {produkte.length === 0 ? (
        <div className="card text-center text-sm text-chrome-400">Noch keine Produkte eingestellt.</div>
      ) : (
        <div className="card-flush divide-y divide-ink-700/60">
          {produkte.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-chrome-50">
                  {p.name}
                  {!p.aktiv && <span className="badge-neutral ml-2">inaktiv</span>}
                  {p.bestellbar && <span className="badge-copper ml-2">bestellbar</span>}
                </p>
                <p className="text-xs text-chrome-500">
                  {p.kategorie}
                  {p.preis != null ? ` · ${p.preisHinweis ? `${p.preisHinweis} ` : ''}${eur(Number(p.preis))}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className="btn-subtle btn-sm" onClick={() => bearbeiten(p)}>Bearbeiten</button>
                <button className="btn-ghost btn-sm" onClick={() => aktivToggle(p)}>
                  {p.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-chrome-500">
        Änderungen erscheinen sofort im Detailly-Marktplatz. Diesen Portal-Link bitte vertraulich behandeln –
        bei Verdacht auf Weitergabe stellt euch das Detailly-Team einen neuen aus.
      </p>
    </div>
  );
}
