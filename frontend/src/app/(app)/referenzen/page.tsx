'use client';

// Betreiber-Verwaltung des oeffentlichen Schaufensters (Vorher/Nachher-Referenzen).
// Tarif-Feature 'schaufenster' (ab Basic). Anlegen/bearbeiten, Consent-pflichtig
// veroeffentlichen/zurueckziehen, Vorschau ueber den Vorher/Nachher-Slider,
// oeffentlichen Link kopieren. Fotos laufen ueber den guard-geschuetzten,
// tenant-scoped Bild-Endpunkt (AuthedImage) – auch fuer unveroeffentlichte Eintraege.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, appPath } from '@/lib/api';
import {
  PageHeader,
  Loading,
  ErrorBox,
  UpgradeHinweis,
  Empty,
  Modal,
  ConfirmDialog,
  Badge,
  useToast,
} from '@/components/ui';
import { useT } from '@/lib/i18n';
import AuthedImage from '@/components/AuthedImage';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';

type Gewerk = 'folie' | 'aufbereitung' | 'ppf';

interface ShowcaseItem {
  id: string;
  titel: string;
  beschreibung: string | null;
  gewerk: Gewerk;
  veroeffentlicht: boolean;
  shareToken: string | null;
  reihenfolge: number | null;
  kundeEinverstaendnis: boolean;
  einverstaendnisAm: string | null;
  bildVorher: string;
  bildNachher: string;
  createdAt: string;
  updatedAt: string;
}

const GEWERKE: Gewerk[] = ['folie', 'aufbereitung', 'ppf'];

/** Liest eine Bild-Datei als Data-URL (fuer den Upload). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

export default function SchaufensterPage() {
  const t = useT();
  const toast = useToast();

  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState(false);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState('');

  // Formular (Anlegen/Bearbeiten)
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [titel, setTitel] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [gewerk, setGewerk] = useState<Gewerk>('aufbereitung');
  const [vorher, setVorher] = useState('');
  const [nachher, setNachher] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Veroeffentlichen-Dialog (Consent-Pflicht)
  const [publishId, setPublishId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Loeschen-Dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get<ShowcaseItem[]>('/schaufenster')
      .then((res) => setItems(res))
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
        else setError(t('schaufenster.error.load'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
    // Eigenen Slug fuer den oeffentlichen Link laden (best effort).
    api
      .get<{ slug?: string }>('/tenants/me')
      .then((res) => setSlug(res.slug ?? ''))
      .catch(() => setSlug(''));
  }, [load]);

  const publishedCount = useMemo(() => items.filter((i) => i.veroeffentlicht).length, [items]);

  const galleryUrl = useMemo(() => {
    if (!slug || typeof window === 'undefined') return '';
    return `${window.location.origin}${appPath('/schaufenster/')}?b=${encodeURIComponent(slug)}`;
  }, [slug]);

  function itemUrl(shareToken: string | null): string {
    if (!slug || !shareToken || typeof window === 'undefined') return '';
    return `${window.location.origin}${appPath('/schaufenster/')}?b=${encodeURIComponent(slug)}&item=${shareToken}`;
  }

  async function copy(value: string, key: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast(t('schaufenster.toast.copied'), { variant: 'copper' });
      setTimeout(() => setCopied(''), 1800);
    } catch {
      /* Clipboard gesperrt -> stiller No-op */
    }
  }

  function openCreate() {
    setEditId(null);
    setTitel('');
    setBeschreibung('');
    setGewerk('aufbereitung');
    setVorher('');
    setNachher('');
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(item: ShowcaseItem) {
    setEditId(item.id);
    setTitel(item.titel);
    setBeschreibung(item.beschreibung ?? '');
    setGewerk(item.gewerk);
    setVorher('');
    setNachher('');
    setFormError('');
    setFormOpen(true);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>, which: 'vorher' | 'nachher') {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      if (which === 'vorher') setVorher(url);
      else setNachher(url);
    } catch {
      setFormError(t('schaufenster.error.images'));
    }
  }

  async function onSave() {
    setFormError('');
    if (!titel.trim()) {
      setFormError(t('schaufenster.form.titel'));
      return;
    }
    // Beim Anlegen sind beide Bilder Pflicht; beim Bearbeiten optional.
    if (!editId && (!vorher || !nachher)) {
      setFormError(t('schaufenster.error.images'));
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/schaufenster/${editId}`, {
          titel: titel.trim(),
          beschreibung: beschreibung.trim() || undefined,
          gewerk,
          vorherBild: vorher || undefined,
          nachherBild: nachher || undefined,
        });
        toast(t('schaufenster.toast.updated'), { variant: 'positive' });
      } else {
        await api.post('/schaufenster', {
          titel: titel.trim(),
          beschreibung: beschreibung.trim() || undefined,
          gewerk,
          vorherBild: vorher,
          nachherBild: nachher,
        });
        toast(t('schaufenster.toast.created'), { variant: 'positive' });
      }
      setFormOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof ApiError || e instanceof Error ? e.message : t('schaufenster.error.load'));
    } finally {
      setSaving(false);
    }
  }

  function openPublish(item: ShowcaseItem) {
    setPublishId(item.id);
    setConsent(item.kundeEinverstaendnis);
    setPublishError('');
  }

  async function onPublish() {
    if (!publishId) return;
    if (!consent) {
      setPublishError(t('schaufenster.consent.required'));
      return;
    }
    setPublishBusy(true);
    setPublishError('');
    try {
      await api.post(`/schaufenster/${publishId}/veroeffentlichen`, {
        veroeffentlicht: true,
        kundeEinverstaendnis: true,
      });
      toast(t('schaufenster.toast.published'), { variant: 'positive' });
      setPublishId(null);
      load();
    } catch (e) {
      setPublishError(e instanceof ApiError || e instanceof Error ? e.message : t('schaufenster.consent.required'));
    } finally {
      setPublishBusy(false);
    }
  }

  async function onUnpublish(item: ShowcaseItem) {
    try {
      await api.post(`/schaufenster/${item.id}/veroeffentlichen`, { veroeffentlicht: false });
      toast(t('schaufenster.toast.unpublished'), { variant: 'copper' });
      load();
    } catch (e) {
      toast(e instanceof ApiError || e instanceof Error ? e.message : t('schaufenster.error.load'), { variant: 'copper' });
    }
  }

  async function onDelete() {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/schaufenster/${deleteId}`);
      toast(t('schaufenster.toast.deleted'), { variant: 'copper' });
      setDeleteId(null);
      load();
    } catch (e) {
      toast(e instanceof ApiError || e instanceof Error ? e.message : t('schaufenster.error.load'), { variant: 'copper' });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('schaufenster.title')}
        subtitle={t('schaufenster.subtitle')}
        action={
          !upgrade ? (
            <button className="btn-primary" onClick={openCreate}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('schaufenster.new')}
            </button>
          ) : undefined
        }
      />

      {upgrade ? (
        <UpgradeHinweis message={t('schaufenster.upgrade')} />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <div className="space-y-3">
          <ErrorBox message={error} />
          <button className="btn-ghost" onClick={load}>{t('common.back')}</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Oeffentlicher Galerie-Link */}
          {galleryUrl && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-copper-300">
                {t('schaufenster.publicLink.title')}
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 truncate rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-chrome-200">
                  {galleryUrl}
                </code>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => copy(galleryUrl, 'gallery')}>
                    {copied === 'gallery' ? t('schaufenster.action.copied') : t('schaufenster.action.copyLink')}
                  </button>
                  <a className="btn-ghost" href={galleryUrl} target="_blank" rel="noreferrer">
                    {t('schaufenster.action.openPublic')}
                  </a>
                </div>
              </div>
              <p className="mt-2 text-xs text-chrome-400">{t('schaufenster.publicLink.hint')}</p>
            </div>
          )}

          <p className="text-sm text-chrome-400">
            {t('schaufenster.count', { n: items.length, p: publishedCount })}
          </p>

          {items.length === 0 ? (
            <Empty text={t('schaufenster.empty')} action={<button className="btn-primary" onClick={openCreate}>{t('schaufenster.new')}</button>} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="card flex flex-col gap-4">
                  <BeforeAfterSlider
                    before={<AuthedImage path={item.bildVorher} alt={t('schaufenster.preview.before')} className="h-full w-full object-cover" />}
                    after={<AuthedImage path={item.bildNachher} alt={t('schaufenster.preview.after')} className="h-full w-full object-cover" />}
                    beforeLabel={t('schaufenster.preview.before')}
                    afterLabel={t('schaufenster.preview.after')}
                    ariaLabel={t('schaufenster.slider.aria')}
                    handleLabel={t('schaufenster.slider.handle')}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold text-chrome-50">{item.titel}</h3>
                      <p className="mt-0.5 text-xs text-chrome-400">{t(`schaufenster.gewerk.${item.gewerk}`)}</p>
                    </div>
                    {item.veroeffentlicht ? (
                      <Badge className="bg-positive-soft text-positive ring-1 ring-positive/30">{t('schaufenster.status.published')}</Badge>
                    ) : (
                      <Badge className="bg-ink-700/50 text-chrome-300 ring-1 ring-ink-600">{t('schaufenster.status.draft')}</Badge>
                    )}
                  </div>

                  {item.beschreibung && <p className="text-sm text-chrome-300">{item.beschreibung}</p>}

                  {item.veroeffentlicht && item.einverstaendnisAm && (
                    <p className="text-xs text-chrome-500">
                      {t('schaufenster.consent.confirmedAt', {
                        datum: new Date(item.einverstaendnisAm).toLocaleDateString('de-DE'),
                      })}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2">
                    {item.veroeffentlicht ? (
                      <>
                        <button className="btn-ghost" onClick={() => onUnpublish(item)}>{t('schaufenster.action.unpublish')}</button>
                        <button className="btn-ghost" onClick={() => copy(itemUrl(item.shareToken), item.id)}>
                          {copied === item.id ? t('schaufenster.action.copied') : t('schaufenster.action.copyLink')}
                        </button>
                      </>
                    ) : (
                      <button className="btn-primary" onClick={() => openPublish(item)}>{t('schaufenster.action.publish')}</button>
                    )}
                    <button className="btn-ghost" onClick={() => openEdit(item)}>{t('schaufenster.action.edit')}</button>
                    <button className="btn-ghost text-danger" onClick={() => setDeleteId(item.id)}>{t('schaufenster.action.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anlegen/Bearbeiten */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId ? t('schaufenster.form.editTitle') : t('schaufenster.form.newTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div className="field">
            <label className="label" htmlFor="sf-titel">{t('schaufenster.form.titel')}</label>
            <input id="sf-titel" className="input" value={titel} maxLength={120} onChange={(e) => setTitel(e.target.value)} placeholder={t('schaufenster.form.titelPlaceholder')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="sf-gewerk">{t('schaufenster.form.gewerk')}</label>
            <select id="sf-gewerk" className="input" value={gewerk} onChange={(e) => setGewerk(e.target.value as Gewerk)}>
              {GEWERKE.map((g) => (
                <option key={g} value={g}>{t(`schaufenster.gewerk.${g}`)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="sf-beschreibung">{t('schaufenster.form.beschreibung')}</label>
            <textarea id="sf-beschreibung" className="input min-h-[80px] resize-y" value={beschreibung} maxLength={2000} onChange={(e) => setBeschreibung(e.target.value)} placeholder={t('schaufenster.form.beschreibungPlaceholder')} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label">{t('schaufenster.form.vorher')}</label>
              <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
                {vorher ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vorher} alt={t('schaufenster.preview.before')} className="aspect-video w-full object-cover" />
                ) : editId ? (
                  <AuthedImage path={`/schaufenster/${editId}/bild/vorher`} alt={t('schaufenster.preview.before')} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="grid aspect-video w-full place-items-center text-xs text-chrome-500">—</div>
                )}
              </div>
              <label className="btn-ghost mt-2 cursor-pointer text-center">
                {editId ? t('schaufenster.form.bildErsetzen') : t('schaufenster.form.bildWaehlen')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e, 'vorher')} />
              </label>
            </div>
            <div className="field">
              <label className="label">{t('schaufenster.form.nachher')}</label>
              <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
                {nachher ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={nachher} alt={t('schaufenster.preview.after')} className="aspect-video w-full object-cover" />
                ) : editId ? (
                  <AuthedImage path={`/schaufenster/${editId}/bild/nachher`} alt={t('schaufenster.preview.after')} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="grid aspect-video w-full place-items-center text-xs text-chrome-500">—</div>
                )}
              </div>
              <label className="btn-ghost mt-2 cursor-pointer text-center">
                {editId ? t('schaufenster.form.bildErsetzen') : t('schaufenster.form.bildWaehlen')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e, 'nachher')} />
              </label>
            </div>
          </div>
          <p className="text-xs text-chrome-500">{t('schaufenster.form.bildHint')}</p>

          {formError && (
            <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{formError}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setFormOpen(false)} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={onSave} disabled={saving}>
              {saving && <span className="spinner" />}
              {saving ? t('schaufenster.form.saving') : t('schaufenster.form.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Veroeffentlichen mit Consent */}
      <Modal open={!!publishId} onClose={() => setPublishId(null)} title={t('schaufenster.publishDialog.title')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-chrome-300">{t('schaufenster.publishDialog.text')}</p>
          <div className="rounded-xl border border-copper/30 bg-copper-soft/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-copper-300">{t('schaufenster.consent.title')}</p>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 text-sm text-chrome-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t('schaufenster.consent.checkbox')}</span>
            </label>
            <p className="mt-2 text-xs text-chrome-500">{t('schaufenster.consent.recommendation')}</p>
          </div>
          {publishError && (
            <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{publishError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPublishId(null)} disabled={publishBusy}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={onPublish} disabled={publishBusy || !consent}>
              {publishBusy && <span className="spinner" />}
              {t('schaufenster.action.publish')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Loeschen */}
      <ConfirmDialog
        open={!!deleteId}
        title={t('schaufenster.delete.title')}
        message={t('schaufenster.delete.text')}
        confirmLabel={t('schaufenster.action.delete')}
        busy={deleteBusy}
        onConfirm={onDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
