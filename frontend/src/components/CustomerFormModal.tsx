'use client';

import { useEffect, useState } from 'react';
import { api, authedFileUrl } from '@/lib/api';
import type { Customer } from '@/lib/types';
import { Modal, ErrorBox, ConfirmDialog, Field } from '@/components/ui';
import { useT } from '@/lib/i18n';

const LEER = {
  type: 'private' as 'private' | 'business',
  firstName: '', lastName: '', companyName: '', email: '', phone: '',
  street: '', city: '', postalCode: '', vatNumber: '', leitwegId: '',
};

/** Antwort von GET /customers/:id/gdpr-preview. */
interface GdprPreview {
  modus: 'anonymisiert' | 'geloescht';
  bereitsAnonymisiert: boolean;
  belege: {
    rechnungen: number;
    angebote: number;
    abgerechneteAuftraege: number;
    signierteProtokolle: number;
  };
}

function buildPayload(form: typeof LEER) {
  const out: Record<string, unknown> = { type: form.type };
  for (const [k, v] of Object.entries(form)) {
    if (k === 'type') continue;
    if (v && String(v).trim()) out[k] = v;
  }
  return out;
}

/** Geteiltes Anlegen/Bearbeiten von Kunden (Liste + Kunden-Detailseite). */
export function CustomerFormModal({
  open, onClose, customer, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmAnonymize, setConfirmAnonymize] = useState(false);
  // DSGVO-Loesch-Vorschau: zeigt VOR der Bestaetigung, ob anonymisiert oder hart
  // geloescht wird (klare Folgen, Review-before-send fuer unumkehrbares Loeschen).
  const [preview, setPreview] = useState<GdprPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const editId = customer?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmAnonymize(false);
    setPreview(null);
    setPreviewLoading(false);
    setForm(
      customer
        ? {
            type: (customer.type as 'private' | 'business') ?? 'private',
            firstName: customer.firstName ?? '', lastName: customer.lastName ?? '',
            companyName: customer.companyName ?? '', email: customer.email ?? '', phone: customer.phone ?? '',
            street: customer.street ?? '', city: customer.city ?? '', postalCode: customer.postalCode ?? '',
            vatNumber: customer.vatNumber ?? '', leitwegId: customer.leitwegId ?? '',
          }
        : LEER,
    );
  }, [open, customer]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(form);
      if (editId) await api.patch(`/customers/${editId}`, payload);
      else await api.post('/customers', payload);
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kunden.form.error.save'));
    } finally {
      setSaving(false);
    }
  }

  async function exportGdpr() {
    if (!editId) return;
    try {
      const url = await authedFileUrl(`/customers/${editId}/export`);
      const a = document.createElement('a');
      a.href = url; a.download = `kunde-${editId}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kunden.form.error.export'));
    }
  }

  // Oeffnet den Bestaetigungs-Dialog UND laedt die Vorschau (loeschen vs.
  // anonymisieren), damit der Nutzer die konkrete Folge vor dem Klick sieht.
  async function openDeleteConfirm() {
    if (!editId) return;
    setConfirmAnonymize(true);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const p = await api.get<GdprPreview>(`/customers/${editId}/gdpr-preview`);
      setPreview(p);
    } catch {
      /* Vorschau best-effort – der Dialog bleibt mit generischer Warnung nutzbar */
    } finally {
      setPreviewLoading(false);
    }
  }

  async function deleteGdpr() {
    if (!editId) return;
    setSaving(true);
    try {
      await api.post(`/customers/${editId}/gdpr-delete`);
      onClose();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('kunden.form.error.anonymize'));
    } finally {
      setSaving(false);
      setConfirmAnonymize(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editId ? t('kunden.form.editTitle') : t('kunden.new')}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t('kunden.col.typ')} htmlFor="kunde-typ">
          <select id="kunde-typ" className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'private' | 'business' })}>
            <option value="private">{t('kunden.type.private')}</option>
            <option value="business">{t('kunden.type.business')}</option>
          </select>
        </Field>
        {/* Pflicht ist der NAME des Kunden: privat der Nachname, geschäftlich die
            Firma – aber nur bei der NEUANLAGE. Bestandskunden ohne Namen (z. B.
            nach DSGVO-Anonymisierung) müssen weiter editierbar bleiben; dort
            gibt es statt Blockade nur einen weichen Hinweis. */}
        {form.type === 'business' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={t('kunden.form.company')}
              htmlFor="kunde-firma"
              required={!editId}
              help={editId && !form.companyName.trim() ? t('kunden.form.noNameHelp') : undefined}
            >
              <input id="kunde-firma" className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required={!editId} />
            </Field>
            <Field label={t('kunden.detail.vatNumber')} htmlFor="kunde-ustid">
              <input id="kunde-ustid" className="input" value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
            </Field>
            <Field
              label={t('kunden.form.leitwegId.label')}
              htmlFor="kunde-leitwegid"
              help={t('kunden.form.leitwegId.help')}
              className="sm:col-span-2"
            >
              <input
                id="kunde-leitwegid"
                className="input"
                maxLength={46}
                value={form.leitwegId}
                onChange={(e) => setForm({ ...form, leitwegId: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('kunden.form.firstName')} htmlFor="kunde-vorname">
              <input id="kunde-vorname" className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field
              label={t('kunden.form.lastName')}
              htmlFor="kunde-nachname"
              required={!editId}
              help={editId && !form.lastName.trim() ? t('kunden.form.noNameHelp') : undefined}
            >
              <input id="kunde-nachname" className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required={!editId} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('kunden.col.email')} htmlFor="kunde-email">
            <input id="kunde-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t('kunden.col.telefon')} htmlFor="kunde-telefon">
            <input id="kunde-telefon" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('kunden.form.street')} htmlFor="kunde-strasse" className="sm:col-span-2">
            <input id="kunde-strasse" className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
          </Field>
          <Field label={t('kunden.form.postalCode')} htmlFor="kunde-plz">
            <input id="kunde-plz" className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </Field>
        </div>
        <Field label={t('kunden.col.ort')} htmlFor="kunde-ort">
          <input id="kunde-ort" className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>

        {editId && (
          <div className="mt-2 space-y-3 border-t border-ink-700 pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-chrome-600">{t('kunden.form.gdprSection')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={exportGdpr}>{t('kunden.form.exportJson')}</button>
              <button type="button" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50" onClick={openDeleteConfirm} disabled={saving}>
                {t('kunden.form.anonymizeBtn')}
              </button>
            </div>
            <p className="text-xs text-chrome-600">{t('kunden.form.gdprNote')}</p>
          </div>
        )}

        {error && <ErrorBox message={error} />}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('kunden.form.saving') : t('common.save')}</button>
        </div>
      </form>

      {/* Gestapelt ueber dem Formular-Modal – Stacking ist seit Phase 1 sicher. */}
      <ConfirmDialog
        open={confirmAnonymize}
        title={t('kunden.form.anonymize.title')}
        message={
          previewLoading ? (
            <span className="inline-flex items-center gap-2 text-chrome-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-chrome-500 border-t-transparent" />
              {t('kunden.form.gdpr.checking')}
            </span>
          ) : preview ? (
            preview.modus === 'anonymisiert' ? (
              <span>
                {t('kunden.form.gdpr.willAnonymize', {
                  count: String(
                    preview.belege.rechnungen +
                      preview.belege.angebote +
                      preview.belege.abgerechneteAuftraege +
                      preview.belege.signierteProtokolle,
                  ),
                })}{' '}
                <strong className="font-semibold text-chrome-100">{t('kunden.form.gdpr.irreversible')}</strong>
              </span>
            ) : (
              <span>
                {t('kunden.form.gdpr.willDelete')}{' '}
                <strong className="font-semibold text-chrome-100">{t('kunden.form.gdpr.irreversible')}</strong>
              </span>
            )
          ) : (
            <>
              {t('kunden.form.anonymize.msgPre')}
              <strong className="font-semibold text-chrome-100">{t('kunden.form.anonymize.msgEmph')}</strong>
              {t('kunden.form.anonymize.msgPost')}
            </>
          )
        }
        confirmLabel={
          preview?.modus === 'geloescht'
            ? t('kunden.form.gdpr.confirmDelete')
            : t('kunden.form.anonymize.confirm')
        }
        busy={saving}
        onConfirm={deleteGdpr}
        onCancel={() => setConfirmAnonymize(false)}
      />
    </Modal>
  );
}
