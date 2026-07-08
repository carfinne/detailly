'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, authedFileUrl, downloadAuthed, appPath } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_LABEL, INVOICE_KIND_LABEL, INVOICE_STATUS_COLOR } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
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
  const toast = useToast();
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [xmlBusy, setXmlBusy] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [mahnBusy, setMahnBusy] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt'>('alle');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ alle: 0, offen: 0, bezahlt: 0 });

  // Storno-Bestätigung (Pending-State): Übergang nach 'storniert' ist destruktiv
  // (nicht umkehrbar, siehe NEXT-Mapping) – normale Vorwärts-Übergänge fragen nicht nach.
  const [confirmStorno, setConfirmStorno] = useState<Invoice | null>(null);

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
      toast(status === 'storniert' ? 'Beleg storniert' : 'Status aktualisiert');
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

  // XRechnung (UBL-XML) tenant-sicher laden und herunterladen. Reicht die
  // konkrete Backend-Meldung durch (z. B. 422 mit fehlenden §14-/Kundenfeldern),
  // damit der Betrieb sofort sieht, was er in den Einstellungen ergaenzen muss.
  async function handleXRechnung(id: string, nummer: string) {
    setXmlBusy(id);
    try {
      await downloadAuthed(`/invoices/${id}/xrechnung`, `xrechnung-${nummer}.xml`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'XRechnung konnte nicht erstellt werden');
    } finally {
      setXmlBusy(null);
    }
  }

  async function markPaid(id: string) {
    setBusy(true);
    try {
      await api.post(`/invoices/${id}/bezahlt`);
      await load();
      toast('Als bezahlt markiert');
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
      toast('Beleg per E-Mail versendet');
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
        toast('Download-Link kopiert', { variant: 'copper' });
      } catch {
        window.prompt('Download-Link kopieren:', url);
      }
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
      toast('Mahnung versendet');
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
          <div className="seg-group">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setFilter(t.key); setPage(1); }}
                className={`flex items-center gap-1.5 seg ${
                  filter === t.key ? 'seg-active' : ''
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
            <Empty text="Noch keine Belege. Belege entstehen aus Aufträgen." />
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
                        <Link href={`/kunden/detail/?id=${inv.customerId}`} className="link-row">
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
                      <div className="flex justify-end">
                        {(() => {
                          const t = tageBis(inv);
                          const menu: ActionMenuItem[] = [
                            {
                              key: 'pdf',
                              label: 'PDF herunterladen',
                              disabled: pdfBusy === inv.id,
                              onSelect: () => handlePdf(inv.id, inv.nummer ?? 'Entwurf'),
                            },
                          ];
                          // XRechnung (E-Rechnung) nur fuer echte Rechnungen mit
                          // Nummer – nicht fuer Angebote/Entwuerfe. Download, kein
                          // Auto-Versand (der Betrieb sendet selbst an B2B/Behoerde).
                          if (inv.art === 'rechnung' && inv.nummer) {
                            menu.push({
                              key: 'xrechnung',
                              label: 'XRechnung (XML)',
                              disabled: xmlBusy === inv.id,
                              onSelect: () => handleXRechnung(inv.id, inv.nummer ?? 'rechnung'),
                            });
                          }
                          if (inv.nummer && inv.status !== 'storniert') {
                            menu.push({
                              key: 'send',
                              label: inv.versendetAm ? 'Erneut per E-Mail senden' : 'Per E-Mail senden',
                              disabled: sendBusy === inv.id,
                              onSelect: () => sendEmail(inv.id),
                            });
                          }
                          if (inv.status === 'offen' && inv.art === 'rechnung') {
                            menu.push({
                              key: 'paid',
                              label: 'Als bezahlt markieren',
                              disabled: busy,
                              onSelect: () => markPaid(inv.id),
                            });
                          }
                          if (inv.status === 'offen' || inv.status === 'bezahlt') {
                            menu.push({
                              key: 'link',
                              label: 'Download-Link kopieren',
                              disabled: linkBusy === inv.id,
                              onSelect: () => copyDownloadLink(inv.id),
                            });
                          }
                          if (inv.status === 'offen' && inv.art === 'rechnung' && t !== null && t < 0) {
                            menu.push({
                              key: 'mahnen',
                              label: 'Mahnen',
                              disabled: mahnBusy === inv.id,
                              onSelect: () => mahnen(inv.id),
                            });
                          }
                          for (const s of NEXT[inv.status] ?? []) {
                            if (s === 'storniert') {
                              menu.push({
                                key: 'storno',
                                label: 'Stornieren',
                                danger: true,
                                disabled: busy,
                                onSelect: () => setConfirmStorno(inv),
                              });
                            } else {
                              menu.push({
                                key: `to-${s}`,
                                label: `Auf „${INVOICE_STATUS_LABEL[s] ?? s}“ setzen`,
                                disabled: busy,
                                onSelect: () => setStatus(inv.id, s),
                              });
                            }
                          }
                          return (
                            <ActionMenu label={`Aktionen für ${inv.nummer ?? 'Entwurf'}`} items={menu} />
                          );
                        })()}
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

      <ConfirmDialog
        open={!!confirmStorno}
        title="Beleg stornieren"
        message={
          confirmStorno
            ? confirmStorno.status === 'bezahlt'
              ? `Die bezahlte Rechnung ${confirmStorno.nummer ?? ''} wirklich stornieren? Das Storno kann nicht rückgängig gemacht werden – eine Gutschrift bzw. Erstattung ist ggf. separat zu klären.`
              : `Beleg ${confirmStorno.nummer ?? 'Entwurf'} wirklich stornieren? Ein stornierter Beleg kann nicht wieder aktiviert werden.`
            : ''
        }
        confirmLabel="Stornieren"
        busy={busy}
        onConfirm={async () => {
          if (!confirmStorno) return;
          await setStatus(confirmStorno.id, 'storniert');
          setConfirmStorno(null);
        }}
        onCancel={() => setConfirmStorno(null)}
      />
    </div>
  );
}
