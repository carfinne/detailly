'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, authedFileUrl, appPath } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_LABEL, INVOICE_KIND_LABEL, INVOICE_STATUS_COLOR } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';
import { Pager } from '@/components/Pager';

const SEITENGROESSE = 50;

/** Paginierte Beleg-Antwort inkl. Status-Zaehlern fuer die Filter-Reiter. */
type BelegListe = Paginated<Invoice> & { counts: { alle: number; offen: number; bezahlt: number } };

const NEXT: Record<string, string[]> = {
  entwurf: ['offen', 'storniert'],
  // 'bezahlt' bewusst NICHT hier: Zahlung laeuft ueber den 'Als bezahlt'-Button
  // (POST /:id/bezahlt), damit immer das Zahldatum gesetzt wird.
  offen: ['storniert'],
  bezahlt: ['storniert'], // Storno einer bezahlten Rechnung (Gutschrift/Refund)
  storniert: [],
};

// Anzeige je Mahnstufe (1=Erinnerung, 2=1. Mahnung, 3=2. Mahnung).
const MAHN_LABEL: Record<number, string> = {
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
};

// Ganze Tage bis zur effektiven Faelligkeit (negativ = ueberfaellig). Effektive
// Faelligkeit = gespeichertes faelligkeitsdatum, sonst aus datum + zahlungsziel
// (Default 14) abgeleitet – analog zur Backend-Mahnliste, damit auch Rechnungen
// ohne explizites Faelligkeitsdatum korrekt als ueberfaellig erkannt werden.
function tageBis(inv: Invoice): number | null {
  const tag = 24 * 60 * 60 * 1000;
  let faelligMs: number | null = null;
  if (inv.faelligkeitsdatum) {
    const d = new Date(inv.faelligkeitsdatum);
    if (!Number.isNaN(d.getTime())) faelligMs = d.getTime();
  } else if (inv.datum) {
    const d = new Date(inv.datum);
    if (!Number.isNaN(d.getTime())) faelligMs = d.getTime() + (inv.zahlungsziel ?? 14) * tag;
  }
  if (faelligMs == null) return null;
  return Math.ceil((faelligMs - Date.now()) / tag);
}

// PDF tenant-sicher per Bearer-Token laden (<a download> sendet keinen
// Authorization-Header) und programmatisch herunterladen.
async function downloadPdf(id: string, nummer: string) {
  const url = await authedFileUrl(`/invoices/${id}/pdf`);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nummer}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Object-URL NICHT synchron freigeben: der Browser startet den Download async,
  // ein zu fruehes revoke bricht ihn (v.a. Firefox/Safari) ab.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function RechnungenPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [mahnBusy, setMahnBusy] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt'>('alle');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ alle: 0, offen: 0, bezahlt: 0 });

  // Vorbelegung aus der globalen Suche (?q=). Nur clientseitig lesen (useEffect),
  // damit KEIN Suspense-Boundary noetig ist – analog zur Kundenliste.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  // Server-getrieben: Seite, Status-Reiter und Suche (Nummer ODER Kundenname)
  // laufen in der DB – die Liste bleibt konstant schnell, egal wie viele Belege.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(SEITENGROESSE) });
      if (filter !== 'alle') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const [inv, c] = await Promise.all([
        api.get<BelegListe>(`/invoices?${params.toString()}`),
        api.get<Customer[]>('/customers/select'),
      ]);
      setItems(inv.data);
      setTotal(inv.total);
      setCounts(inv.counts);
      setCustomers(c);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  // Entprellt (250ms): faengt schnelles Tippen in der Suche ab.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const TABS: { key: typeof filter; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'offen', label: 'Offen' },
    { key: 'bezahlt', label: 'Bezahlt' },
  ];

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await api.patch(`/invoices/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Statuswechsel fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(id: string, nummer: string) {
    setPdfBusy(id);
    try {
      await downloadPdf(id, nummer);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF konnte nicht geladen werden');
    } finally {
      setPdfBusy(null);
    }
  }

  async function markPaid(id: string) {
    setBusy(true);
    try {
      await api.post(`/invoices/${id}/bezahlt`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konnte nicht als bezahlt markiert werden');
    } finally {
      setBusy(false);
    }
  }

  // Beleg-PDF per E-Mail an den Kunden senden (Backend setzt versendetAm).
  async function sendEmail(id: string) {
    setSendBusy(id);
    try {
      await api.post(`/invoices/${id}/senden`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen');
    } finally {
      setSendBusy(null);
    }
  }

  // Öffentlichen Download-Link erzeugen (nur offen/bezahlt) und in die
  // Zwischenablage kopieren – ideal zum Weitergeben an den Kunden.
  async function copyDownloadLink(id: string) {
    setLinkBusy(id);
    try {
      const { token } = await api.post<{ token: string }>(`/invoices/${id}/download-token`);
      const url = `${window.location.origin}${appPath('/rechnung/')}?t=${encodeURIComponent(token)}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt('Download-Link kopieren:', url);
      }
      setLinkCopiedId(id);
      setTimeout(() => setLinkCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link konnte nicht erstellt werden');
    } finally {
      setLinkBusy(null);
    }
  }

  // Offene Rechnung mahnen: Stufe erhöhen + Mahn-PDF per E-Mail (Backend).
  async function mahnen(id: string) {
    setMahnBusy(id);
    try {
      await api.post(`/invoices/${id}/mahnen`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mahnung fehlgeschlagen');
    } finally {
      setMahnBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="Belege" subtitle="Angebote und Rechnungen" />
      {error && <ErrorBox message={error} />}
      {!loading && (counts.alle > 0 || search.trim() !== '') && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Suche nach Nummer oder Kunde…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div className="flex rounded-xl border border-ink-700 bg-ink-850 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setFilter(t.key); setPage(1); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === t.key ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
                }`}
              >
                {t.label}
                <span className="text-xs tabular-nums opacity-70">{counts[t.key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          counts.alle === 0 && search.trim() === '' ? (
            <Empty text="Noch keine Belege. Belege entstehen aus Auftraegen." />
          ) : (
            <Empty text="Keine Belege in dieser Ansicht." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nummer</th>
                  <th>Art</th>
                  <th>Kunde</th>
                  <th>Datum</th>
                  <th>Status</th>
                  <th className="text-right">Brutto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium">
                      {inv.nummer ?? <span className="text-chrome-500">Entwurf</span>}
                    </td>
                    <td>{INVOICE_KIND_LABEL[inv.art] ?? inv.art}</td>
                    <td>
                      {inv.customerId ? (
                        <Link href={`/kunden/detail/?id=${inv.customerId}`} className="text-chrome-100 hover:text-copper hover:underline">
                          {kundenName(custMap[inv.customerId])}
                        </Link>
                      ) : (
                        kundenName(custMap[inv.customerId])
                      )}
                    </td>
                    <td>{datum(inv.datum)}</td>
                    <td>
                      <Badge className={INVOICE_STATUS_COLOR[inv.status]}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {inv.status === 'offen' && inv.art === 'rechnung' && (() => {
                        const t = tageBis(inv);
                        if (t === null) return null;
                        return t < 0 ? (
                          <Badge className="badge-danger ml-1">
                            Überfällig seit {Math.abs(t)} Tagen
                          </Badge>
                        ) : (
                          <Badge className="badge-caution ml-1">fällig in {t} Tagen</Badge>
                        );
                      })()}
                      {inv.versendetAm && (
                        <span className="ml-1" title={`Gesendet am ${datum(inv.versendetAm)}`}>
                          <Badge className="badge-copper">Gesendet</Badge>
                        </span>
                      )}
                      {inv.mahnstufe ? (
                        <Badge className="badge-danger ml-1">
                          {MAHN_LABEL[inv.mahnstufe] ?? `Mahnstufe ${inv.mahnstufe}`}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-right">{eur(inv.brutto)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-xs text-copper hover:underline disabled:opacity-50"
                          disabled={pdfBusy === inv.id}
                          onClick={() => handlePdf(inv.id, inv.nummer ?? 'Entwurf')}
                        >
                          {pdfBusy === inv.id ? 'PDF …' : 'PDF'}
                        </button>
                        {inv.nummer && inv.status !== 'storniert' && (
                          <button
                            className="text-xs text-copper hover:underline disabled:opacity-50"
                            disabled={sendBusy === inv.id}
                            onClick={() => sendEmail(inv.id)}
                          >
                            {sendBusy === inv.id
                              ? 'Sendet …'
                              : inv.versendetAm
                                ? 'Erneut senden'
                                : 'Per E-Mail'}
                          </button>
                        )}
                        {inv.status === 'offen' && inv.art === 'rechnung' && (
                          <button
                            className="text-xs text-copper hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => markPaid(inv.id)}
                          >
                            Als bezahlt
                          </button>
                        )}
                        {(inv.status === 'offen' || inv.status === 'bezahlt') && (
                          <button
                            className="text-xs text-copper hover:underline disabled:opacity-50"
                            disabled={linkBusy === inv.id}
                            title="Öffentlichen Download-Link für den Kunden kopieren"
                            onClick={() => copyDownloadLink(inv.id)}
                          >
                            {linkCopiedId === inv.id ? 'Link kopiert!' : linkBusy === inv.id ? 'Link …' : 'Link'}
                          </button>
                        )}
                        {inv.status === 'offen' &&
                          inv.art === 'rechnung' &&
                          (() => {
                            const t = tageBis(inv);
                            return t !== null && t < 0 ? (
                              <button
                                className="text-xs text-copper hover:underline disabled:opacity-50"
                                disabled={mahnBusy === inv.id}
                                onClick={() => mahnen(inv.id)}
                              >
                                {mahnBusy === inv.id ? 'Mahnt …' : 'Mahnen'}
                              </button>
                            ) : null;
                          })()}
                        {(NEXT[inv.status] ?? []).map((s) => (
                          <button
                            key={s}
                            className="text-xs text-copper hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => setStatus(inv.id, s)}
                          >
                            → {INVOICE_STATUS_LABEL[s] ?? s}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />
    </div>
  );
}
