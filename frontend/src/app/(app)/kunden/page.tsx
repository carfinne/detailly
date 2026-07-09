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
import { useT } from '@/lib/i18n';

export default function KundenPage() {
  const t = useT();
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
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function openNew() { setEditCustomer(null); setOpen(true); }
  function openEdit(c: Customer) { setEditCustomer(c); setOpen(true); }

  async function deleteCustomer() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${confirmDelete.id}`);
      toast(t('kunden.toast.deleted', { name: kundenName(confirmDelete) }));
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setConfirmDelete(null);
      setError(e instanceof Error ? e.message : t('kunden.error.delete'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('kunden.title')}
        subtitle={t('kunden.subtitle')}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>{t('kunden.csvImport')}</button>
            <button className="btn-primary" onClick={openNew}>{t('kunden.new')}</button>
          </div>
        }
      />
      <input
        className="input mb-4 max-w-sm"
        placeholder={t('kunden.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <ErrorBox message={error} />}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty
            text={search.trim() ? t('kunden.empty.filtered') : t('kunden.empty.none')}
            action={
              search.trim() ? undefined : (
                <button className="btn-primary btn-sm" onClick={openNew}>
                  {t('kunden.empty.cta')}
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('kunden.col.name')}</th>
                  <th>{t('kunden.col.typ')}</th>
                  <th>{t('kunden.col.email')}</th>
                  <th>{t('kunden.col.telefon')}</th>
                  <th>{t('kunden.col.ort')}</th>
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
                    <td>{c.type === 'business' ? t('kunden.type.business') : t('kunden.type.private')}</td>
                    <td>{c.email || '–'}</td>
                    <td>{c.phone || '–'}</td>
                    <td>{c.city || '–'}</td>
                    <td className="text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          label={t('kunden.actionsFor', { name: kundenName(c) })}
                          items={[
                            { key: 'open', label: t('kunden.action.open'), href: `/kunden/detail/?id=${c.id}` },
                            { key: 'order', label: t('kunden.action.newOrder'), href: `/auftraege?kunde=${c.id}&neu=1` },
                            { key: 'edit', label: t('kunden.action.edit'), onSelect: () => openEdit(c) },
                            ...(darfLoeschen
                              ? [{ key: 'delete', label: t('common.delete'), danger: true, onSelect: () => setConfirmDelete(c) }]
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
        title={t('kunden.delete.title')}
        message={
          confirmDelete
            ? t('kunden.delete.msg', { name: kundenName(confirmDelete) })
            : ''
        }
        confirmLabel={t('common.delete')}
        busy={deleting}
        onConfirm={deleteCustomer}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
