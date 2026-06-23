'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_LABEL, INVOICE_KIND_LABEL } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

const STATUS_COLOR: Record<string, string> = {
  entwurf: 'badge-neutral',
  offen: 'badge-caution',
  bezahlt: 'badge-positive',
  storniert: 'badge-danger',
};

const NEXT: Record<string, string[]> = {
  entwurf: ['offen', 'storniert'],
  offen: ['bezahlt', 'storniert'],
  bezahlt: [],
  storniert: [],
};

export default function RechnungenPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
                      <Badge className={STATUS_COLOR[inv.status]}>
                        {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </td>
                    <td className="text-right">{eur(inv.brutto)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
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
