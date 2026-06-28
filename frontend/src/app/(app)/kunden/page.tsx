'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import type { Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty } from '@/components/ui';
import { CustomerFormModal } from '@/components/CustomerFormModal';

export default function KundenPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  // Vorbelegung aus der globalen Suche (?q=). Nur clientseitig lesen (useEffect),
  // damit KEIN Suspense-Boundary nötig ist.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<Customer>>(
        `/customers?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      );
      setItems(res.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() { setEditCustomer(null); setOpen(true); }
  function openEdit(c: Customer) { setEditCustomer(c); setOpen(true); }

  return (
    <div>
      <PageHeader
        title="Kunden"
        subtitle="Privat- und Geschäftskunden"
        action={<button className="btn-primary" onClick={openNew}>Neuer Kunde</button>}
      />
      <input
        className="input mb-4 max-w-sm"
        placeholder="Suche nach Name, E-Mail, Telefon…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty text="Keine Kunden gefunden." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Typ</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Ort</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/kunden/detail/?id=${c.id}`} className="text-chrome-50 hover:text-copper hover:underline">
                        {kundenName(c)}
                      </Link>
                    </td>
                    <td>{c.type === 'business' ? 'Geschäft' : 'Privat'}</td>
                    <td>{c.email || '–'}</td>
                    <td>{c.phone || '–'}</td>
                    <td>{c.city || '–'}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <Link href={`/kunden/detail/?id=${c.id}`} className="text-copper hover:underline">Öffnen</Link>
                        <button className="link-muted" onClick={() => openEdit(c)}>Bearbeiten</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormModal open={open} onClose={() => setOpen(false)} customer={editCustomer} onSaved={load} />
    </div>
  );
}
