'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, authedFileUrl } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_LABEL, INVOICE_KIND_LABEL, INVOICE_STATUS_COLOR } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

const NEXT: Record<string, string[]> = {
  entwurf: ['offen', 'storniert'],
  // 'bezahlt' bewusst NICHT hier: Zahlung laeuft ueber den 'Als bezahlt'-Button
  // (POST /:id/bezahlt), damit immer das Zahldatum gesetzt wird.
  offen: ['storniert'],
  bezahlt: [],
  storniert: [],
};

// Ganze Tage zwischen heute und dem Faelligkeitsdatum (negativ = ueberfaellig).
function tageBis(faelligkeit?: string): number | null {
  if (!faelligkeit) return null;
  const d = new Date(faelligkeit);
  if (Number.isNaN(d.getTime())) return null;
  const tag = 24 * 60 * 60 * 1000;
  return Math.ceil((d.getTime() - Date.now()) / tag);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, c] = await Promise.all([
        api.get<Invoice[]>('/invoices'),
        api.get<Paginated<Customer>>('/customers?limit=200'),
      ]);
      setItems(inv);
      setCustomers(c.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

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

  return (
    <div>
      <PageHeader title="Belege" subtitle="Angebote und Rechnungen" />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="Noch keine Belege. Belege entstehen aus Auftraegen." />
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
                    <td className="font-medium">{inv.nummer}</td>
                    <td>{INVOICE_KIND_LABEL[inv.art] ?? inv.art}</td>
                    <td>{kundenName(custMap[inv.customerId])}</td>
                    <td>{datum(inv.datum)}</td>
                    <td>
                      <Badge className={INVOICE_STATUS_COLOR[inv.status]}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                      {inv.status === 'offen' && inv.art === 'rechnung' && (() => {
                        const t = tageBis(inv.faelligkeitsdatum);
                        if (t === null) return null;
                        return t < 0 ? (
                          <Badge className="badge-danger ml-1">
                            Überfällig seit {Math.abs(t)} Tagen
                          </Badge>
                        ) : (
                          <Badge className="badge-caution ml-1">fällig in {t} Tagen</Badge>
                        );
                      })()}
                    </td>
                    <td className="text-right">{eur(inv.brutto)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="text-xs text-copper hover:underline disabled:opacity-50"
                          disabled={pdfBusy === inv.id}
                          onClick={() => handlePdf(inv.id, inv.nummer)}
                        >
                          {pdfBusy === inv.id ? 'PDF …' : 'PDF'}
                        </button>
                        {inv.status === 'offen' && inv.art === 'rechnung' && (
                          <button
                            className="text-xs text-copper hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => markPaid(inv.id)}
                          >
                            Als bezahlt
                          </button>
                        )}
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
    </div>
  );
}
