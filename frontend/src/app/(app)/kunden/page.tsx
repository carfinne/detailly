'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { kundenName } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import type { Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { CustomerFormModal } from '@/components/CustomerFormModal';
import { ImportModal } from '@/components/ImportModal';

export default function KundenPage() {
  const { user } = useAuth();
  const toast = useToast();
  const darfLoeschen = !!user && LEITUNG_ROLLEN.includes(user.role);
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  // Loeschen-Bestaetigung (Soft-Delete: Kunde wird deaktiviert und aus der Liste
  // ausgeblendet – Auftraege/Rechnungen bleiben erhalten).
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function deleteCustomer() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${confirmDelete.id}`);
      toast(`${kundenName(confirmDelete)} gelöscht`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Kunden"
        subtitle="Privat- und Geschäftskunden"
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>CSV-Import</button>
            <button className="btn-primary" onClick={openNew}>Neuer Kunde</button>
          </div>
        }
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
          <Empty
            text={search.trim() ? 'Keine Kunden gefunden.' : 'Noch keine Kunden angelegt.'}
            action={
              search.trim() ? undefined : (
                <button className="btn-primary btn-sm" onClick={openNew}>
                  Ersten Kunden anlegen
                </button>
              )
            }
          />
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
                      <Link href={`/kunden/detail/?id=${c.id}`} className="link-row">
                        {kundenName(c)}
                      </Link>
                    </td>
                    <td>{c.type === 'business' ? 'Geschäft' : 'Privat'}</td>
                    <td>{c.email || '–'}</td>
                    <td>{c.phone || '–'}</td>
                    <td>{c.city || '–'}</td>
                    <td className="text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={`Aktionen für ${kundenName(c)}`}
                          items={[
                            { key: 'open', label: 'Öffnen', href: `/kunden/detail/?id=${c.id}` },
                            { key: 'order', label: 'Neuer Auftrag', href: `/auftraege?kunde=${c.id}&neu=1` },
                            { key: 'edit', label: 'Bearbeiten', onSelect: () => openEdit(c) },
                            ...(darfLoeschen
                              ? [{ key: 'delete', label: 'Löschen', danger: true, onSelect: () => setConfirmDelete(c) }]
                              : []),
                          ] satisfies ActionMenuItem[]}
                        />
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
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Kunde löschen"
        message={
          confirmDelete
            ? `${kundenName(confirmDelete)} wirklich löschen? Der Kunde wird deaktiviert und aus der Liste entfernt. Bereits erfasste Aufträge und Rechnungen bleiben erhalten.`
            : ''
        }
        confirmLabel="Löschen"
        busy={deleting}
        onConfirm={deleteCustomer}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
