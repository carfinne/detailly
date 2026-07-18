'use client';

// Geraete-Gebrauchtmarkt · Inserat einstellen/bearbeiten. Ein Formular fuer
// beide Wege: ohne ?id= wird angelegt (POST), mit ?id= das eigene Inserat
// bearbeitet (PATCH). Nur fuer die Leitung (OWNER/MANAGER).
//
// WICHTIG (rechtlich): NUR Geraete/Ausruestung – KEINE Chemie/Verbrauchsstoffe.
// Der prominente Hinweis + die Pflicht-Bestaetigung sind gewollt (das Backend
// erzwingt gewerblichBestaetigt=true beim Anlegen zusaetzlich).

import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import { PageHeader, ErrorBox, Loading, Field, SectionCard, useToast } from '@/components/ui';
import AuthedImage from '@/components/AuthedImage';
import { Icon, ICON_PATHS } from '@/lib/icons';
import {
  GERAETE_KATEGORIEN,
  INSERAT_ZUSTAND,
  KATEGORIE_KEY,
  MAX_BILDER,
  MAX_PREIS,
  PREIS_MODUS,
  PREIS_MODUS_KEY,
  ZUSTAND_KEY,
  bildStreamPath,
  type InseratBildRef,
  type InseratFull,
} from '@/lib/geraetemarkt';

type FormState = {
  titel: string;
  beschreibung: string;
  kategorie: string;
  zustand: string;
  preisModus: string;
  preis: string;
  plzRegion: string;
  ort: string;
};

const LEER: FormState = {
  titel: '',
  beschreibung: '',
  kategorie: 'poliermaschine',
  zustand: 'gebraucht',
  preisModus: 'vb',
  preis: '',
  plzRegion: '',
  ort: '',
};

/** Erlaubte Bild-MIME-Typen (Backend prueft zusaetzlich per Magic-Byte). */
const BILD_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function InseratForm() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const id = useSearchParams().get('id') ?? '';
  const istBearbeiten = !!id;

  const [form, setForm] = useState<FormState>(LEER);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'bestaetigt', string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  // Laden (nur Bearbeiten): eigenes Inserat voll.
  const [loading, setLoading] = useState(istBearbeiten);
  const [notFound, setNotFound] = useState(false);

  // Bilder: im Bearbeiten-Modus direkt am Server (existierende Referenzen),
  // im Anlege-Modus lokal gesammelt und erst nach dem POST hochgeladen.
  const [serverBilder, setServerBilder] = useState<InseratBildRef[]>([]);
  const [lokaleDateien, setLokaleDateien] = useState<File[]>([]);

  const errId = useId();

  useEffect(() => {
    if (!istBearbeiten) return;
    setLoading(true);
    api
      .get<InseratFull>(`/geraetemarkt/${id}`)
      .then((data) => {
        setForm({
          titel: data.titel ?? '',
          beschreibung: data.beschreibung ?? '',
          kategorie: data.kategorie ?? 'poliermaschine',
          zustand: data.zustand ?? 'gebraucht',
          preisModus: data.preisModus ?? 'vb',
          preis: data.preis != null ? String(data.preis) : '',
          plzRegion: data.plzRegion ?? '',
          ort: data.ort ?? '',
        });
        setServerBilder(data.bilder ?? []);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setSubmitError(e instanceof Error ? e.message : t('geraetemarkt.error.load'));
      })
      .finally(() => setLoading(false));
  }, [id, istBearbeiten, t]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const bilderGesamt = istBearbeiten ? serverBilder.length : lokaleDateien.length;

  /** Client-Validierung (spiegelt die DTO-Regeln des Backends). */
  function validieren(): boolean {
    const e: Partial<Record<keyof FormState | 'bestaetigt', string>> = {};
    if (!form.titel.trim()) e.titel = t('geraetemarkt.form.error.titelRequired');
    else if (form.titel.length > 120) e.titel = t('geraetemarkt.form.error.titelMax');
    if (!form.beschreibung.trim()) e.beschreibung = t('geraetemarkt.form.error.beschreibungRequired');
    else if (form.beschreibung.length > 4000) e.beschreibung = t('geraetemarkt.form.error.beschreibungMax');
    if (form.preisModus !== 'anfrage') {
      const n = Number(form.preis.replace(',', '.'));
      if (!form.preis.trim() || Number.isNaN(n)) e.preis = t('geraetemarkt.form.error.preisRequired');
      else if (n < 0 || n > MAX_PREIS) e.preis = t('geraetemarkt.form.error.preisRange');
    }
    if (form.plzRegion && !/^\d{2}$/.test(form.plzRegion)) e.plzRegion = t('geraetemarkt.form.error.plz');
    if (form.ort.length > 120) e.ort = t('geraetemarkt.form.error.ortMax');
    if (!istBearbeiten && !bestaetigt) e.bestaetigt = t('geraetemarkt.form.error.confirm');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /** Baut den Payload (preis nur ausser bei 'anfrage', optionale Felder weglassen). */
  function payload(includeGewerblich: boolean) {
    const preisNum = Number(form.preis.replace(',', '.'));
    const body: Record<string, unknown> = {
      titel: form.titel.trim(),
      beschreibung: form.beschreibung.trim(),
      kategorie: form.kategorie,
      zustand: form.zustand,
      preisModus: form.preisModus,
      plzRegion: form.plzRegion || undefined,
      ort: form.ort.trim() || undefined,
    };
    if (form.preisModus !== 'anfrage') body.preis = Math.round(preisNum * 100) / 100;
    if (includeGewerblich) body.gewerblichBestaetigt = true;
    return body;
  }

  async function submit(evt: React.FormEvent) {
    evt.preventDefault();
    setSubmitError('');
    if (!validieren()) return;
    setSaving(true);
    try {
      if (istBearbeiten) {
        await api.patch(`/geraetemarkt/${id}`, payload(false));
        toast(t('geraetemarkt.form.saved'), { variant: 'copper' });
        router.push('/geraetemarkt/meine/');
      } else {
        const neu = await api.post<InseratFull>('/geraetemarkt', payload(true));
        // Gesammelte Bilder nach dem Anlegen hochladen (best effort: das Inserat
        // existiert bereits, ein Upload-Fehler soll den Anlage-Erfolg nicht kippen).
        if (lokaleDateien.length > 0) {
          try {
            const fd = new FormData();
            lokaleDateien.forEach((f) => fd.append('bilder', f));
            await api.postForm(`/geraetemarkt/inserate/${neu.id}/bilder`, fd);
          } catch (e) {
            toast(e instanceof Error ? e.message : t('geraetemarkt.form.uploadError'), { variant: 'copper' });
          }
        }
        toast(t('geraetemarkt.form.created'), { variant: 'copper' });
        router.push('/geraetemarkt/meine/');
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('geraetemarkt.form.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <Loading />;

  if (!istLeitung) {
    return (
      <div>
        <PageHeader title={t('geraetemarkt.newListing')} />
        <SectionCard>
          <p className="text-sm text-chrome-400">{t('geraetemarkt.form.roleHint')}</p>
          <Link href="/geraetemarkt" className="btn-subtle btn-sm mt-4 inline-flex">
            {t('geraetemarkt.detail.backToBrowse')}
          </Link>
        </SectionCard>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title={t('geraetemarkt.form.editTitle')} />
        <SectionCard>
          <p className="text-sm text-chrome-400">{t('geraetemarkt.detail.notFound')}</p>
          <Link href="/geraetemarkt/meine" className="btn-subtle btn-sm mt-4 inline-flex">
            {t('geraetemarkt.myListings')}
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href={istBearbeiten ? '/geraetemarkt/meine' : '/geraetemarkt'}
          className="inline-flex items-center gap-1.5 text-sm text-chrome-400 transition-colors hover:text-copper"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {istBearbeiten ? t('geraetemarkt.myListings') : t('geraetemarkt.detail.backToBrowse')}
        </Link>
      </div>

      <PageHeader
        title={istBearbeiten ? t('geraetemarkt.form.editTitle') : t('geraetemarkt.form.createTitle')}
        subtitle={t('geraetemarkt.form.subtitle')}
      />

      {/* Prominenter Chemie-/Ausruestungs-Hinweis */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3.5">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-caution" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <div className="text-sm">
          <p className="font-semibold text-chrome-50">{t('geraetemarkt.form.chemieTitle')}</p>
          <p className="mt-0.5 text-chrome-300">{t('geraetemarkt.form.chemieHint')}</p>
          <Link
            href="/geraetemarkt/regeln"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-copper transition-colors hover:text-copper-200"
          >
            {t('geraetemarkt.rules.link')}
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      {submitError && <ErrorBox message={submitError} className="mb-5" />}

      <form onSubmit={submit} className="space-y-5" noValidate>
        <SectionCard title={t('geraetemarkt.form.sectionBasics')}>
          <div className="space-y-4">
            <Field label={t('geraetemarkt.form.titel')} htmlFor="gm-titel" required error={errors.titel} errorId={`${errId}-titel`}>
              <input
                id="gm-titel"
                className="input"
                value={form.titel}
                maxLength={120}
                onChange={(e) => set('titel', e.target.value)}
                placeholder={t('geraetemarkt.form.titelPlaceholder')}
                aria-invalid={!!errors.titel}
                aria-describedby={errors.titel ? `${errId}-titel` : undefined}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('geraetemarkt.form.kategorie')} htmlFor="gm-kategorie" required>
                <select id="gm-kategorie" className="select" value={form.kategorie} onChange={(e) => set('kategorie', e.target.value)}>
                  {GERAETE_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {t(KATEGORIE_KEY[k])}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('geraetemarkt.form.zustand')} htmlFor="gm-zustand" required>
                <select id="gm-zustand" className="select" value={form.zustand} onChange={(e) => set('zustand', e.target.value)}>
                  {INSERAT_ZUSTAND.map((z) => (
                    <option key={z} value={z}>
                      {t(ZUSTAND_KEY[z])}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              label={t('geraetemarkt.form.beschreibung')}
              htmlFor="gm-beschreibung"
              required
              error={errors.beschreibung}
              errorId={`${errId}-beschreibung`}
              help={t('geraetemarkt.form.beschreibungHelp')}
            >
              <textarea
                id="gm-beschreibung"
                className="input min-h-[140px]"
                value={form.beschreibung}
                maxLength={4000}
                onChange={(e) => set('beschreibung', e.target.value)}
                placeholder={t('geraetemarkt.form.beschreibungPlaceholder')}
                aria-invalid={!!errors.beschreibung}
                aria-describedby={errors.beschreibung ? `${errId}-beschreibung` : undefined}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title={t('geraetemarkt.form.sectionPrice')}>
          <div className="space-y-4">
            <Field label={t('geraetemarkt.form.preisModus')} required>
              <div className="flex flex-wrap gap-2">
                {PREIS_MODUS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('preisModus', m)}
                    className={`choice rounded-xl px-4 py-2 text-sm font-semibold ${form.preisModus === m ? 'choice-active' : ''}`}
                  >
                    {t(PREIS_MODUS_KEY[m])}
                  </button>
                ))}
              </div>
            </Field>

            {form.preisModus !== 'anfrage' && (
              <Field
                label={t('geraetemarkt.form.preis')}
                htmlFor="gm-preis"
                required
                error={errors.preis}
                errorId={`${errId}-preis`}
              >
                <div className="relative w-full sm:max-w-[220px]">
                  <input
                    id="gm-preis"
                    className="input pr-8"
                    inputMode="decimal"
                    value={form.preis}
                    onChange={(e) => set('preis', e.target.value)}
                    placeholder="0,00"
                    aria-invalid={!!errors.preis}
                    aria-describedby={errors.preis ? `${errId}-preis` : undefined}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-chrome-500">€</span>
                </div>
              </Field>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t('geraetemarkt.form.sectionLocation')} subtitle={t('geraetemarkt.form.locationSubtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('geraetemarkt.form.plz')} htmlFor="gm-plz" error={errors.plzRegion} errorId={`${errId}-plz`} help={t('geraetemarkt.form.plzHelp')}>
              <input
                id="gm-plz"
                className="input w-28"
                inputMode="numeric"
                maxLength={2}
                value={form.plzRegion}
                onChange={(e) => set('plzRegion', e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="12"
                aria-invalid={!!errors.plzRegion}
                aria-describedby={errors.plzRegion ? `${errId}-plz` : undefined}
              />
            </Field>
            <Field label={t('geraetemarkt.form.ort')} htmlFor="gm-ort" error={errors.ort} errorId={`${errId}-ort`}>
              <input
                id="gm-ort"
                className="input"
                value={form.ort}
                maxLength={120}
                onChange={(e) => set('ort', e.target.value)}
                placeholder={t('geraetemarkt.form.ortPlaceholder')}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title={t('geraetemarkt.form.sectionImages')} subtitle={t('geraetemarkt.form.imagesSubtitle', { max: MAX_BILDER })}>
          <BildUpload
            inseratId={istBearbeiten ? id : null}
            serverBilder={serverBilder}
            setServerBilder={setServerBilder}
            lokaleDateien={lokaleDateien}
            setLokaleDateien={setLokaleDateien}
            gesamt={bilderGesamt}
            onError={setSubmitError}
          />
        </SectionCard>

        {/* Pflicht-Bestaetigung (nur beim Anlegen) */}
        {!istBearbeiten && (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
                checked={bestaetigt}
                onChange={(e) => {
                  setBestaetigt(e.target.checked);
                  setErrors((prev) => ({ ...prev, bestaetigt: undefined }));
                }}
                aria-invalid={!!errors.bestaetigt}
              />
              <span className="text-chrome-200">{t('geraetemarkt.form.confirm')}</span>
            </label>
            {errors.bestaetigt && <p role="alert" className="mt-2 text-xs font-medium text-danger">{errors.bestaetigt}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Link href={istBearbeiten ? '/geraetemarkt/meine' : '/geraetemarkt'} className="btn-ghost">
            {t('common.cancel')}
          </Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            {istBearbeiten ? t('geraetemarkt.form.saveEdit') : t('geraetemarkt.form.publish')}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Bild-Upload mit Drag&Drop, Vorschau und Loeschen.
 *  - Bearbeiten (inseratId gesetzt): Upload/Loeschen laufen SOFORT gegen den
 *    Server (PR2-Routen); Vorschau ueber den auth Bild-Stream.
 *  - Anlegen (inseratId null): Dateien werden lokal gesammelt (Object-URL-
 *    Vorschau) und erst nach dem POST des Inserats hochgeladen.
 */
function BildUpload({
  inseratId,
  serverBilder,
  setServerBilder,
  lokaleDateien,
  setLokaleDateien,
  gesamt,
  onError,
}: {
  inseratId: string | null;
  serverBilder: InseratBildRef[];
  setServerBilder: React.Dispatch<React.SetStateAction<InseratBildRef[]>>;
  lokaleDateien: File[];
  setLokaleDateien: React.Dispatch<React.SetStateAction<File[]>>;
  gesamt: number;
  onError: (msg: string) => void;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const voll = gesamt >= MAX_BILDER;

  const dateienAufnehmen = useCallback(
    async (dateien: FileList | null) => {
      if (!dateien || dateien.length === 0) return;
      const gueltig = Array.from(dateien).filter((d) => BILD_MIME.includes(d.type));
      if (gueltig.length === 0) {
        onError(t('geraetemarkt.form.error.imageType'));
        return;
      }
      const frei = MAX_BILDER - gesamt;
      const aufnehmen = gueltig.slice(0, Math.max(0, frei));
      if (aufnehmen.length === 0) {
        onError(t('geraetemarkt.form.error.imageMax', { max: MAX_BILDER }));
        return;
      }

      if (!inseratId) {
        // Anlege-Modus: nur lokal sammeln.
        setLokaleDateien((prev) => [...prev, ...aufnehmen]);
        return;
      }

      // Bearbeiten-Modus: sofort hochladen.
      setUploading(true);
      onError('');
      try {
        const fd = new FormData();
        aufnehmen.forEach((f) => fd.append('bilder', f));
        const neu = await api.postForm<InseratBildRef[]>(`/geraetemarkt/inserate/${inseratId}/bilder`, fd);
        setServerBilder((prev) => [...prev, ...neu]);
      } catch (e) {
        onError(e instanceof Error ? e.message : t('geraetemarkt.form.uploadError'));
      } finally {
        setUploading(false);
      }
    },
    [gesamt, inseratId, onError, setLokaleDateien, setServerBilder, t],
  );

  async function serverBildLoeschen(bildId: string) {
    if (!inseratId) return;
    setUploading(true);
    onError('');
    try {
      await api.delete(`/geraetemarkt/inserate/${inseratId}/bilder/${bildId}`);
      setServerBilder((prev) => prev.filter((b) => b.id !== bildId));
    } catch (e) {
      onError(e instanceof Error ? e.message : t('geraetemarkt.form.deleteImageError'));
    } finally {
      setUploading(false);
    }
  }

  function lokalEntfernen(index: number) {
    setLokaleDateien((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={voll ? -1 : 0}
        aria-disabled={voll}
        onClick={() => !voll && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!voll && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!voll) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!voll) void dateienAufnehmen(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          voll
            ? 'cursor-not-allowed border-ink-700/60 opacity-60'
            : dragOver
              ? 'border-copper bg-copper-soft'
              : 'cursor-pointer border-ink-700 hover:border-copper/60'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50`}
      >
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-copper-soft text-copper">
          {uploading ? <span className="spinner" /> : <Icon className="h-5 w-5">{ICON_PATHS.box}</Icon>}
        </span>
        <p className="text-sm font-medium text-chrome-200">
          {voll ? t('geraetemarkt.form.imagesFull', { max: MAX_BILDER }) : t('geraetemarkt.form.dropzone')}
        </p>
        <p className="text-xs text-chrome-500">{t('geraetemarkt.form.dropzoneHint', { count: gesamt, max: MAX_BILDER })}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          void dateienAufnehmen(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Vorschau-Raster */}
      {(serverBilder.length > 0 || lokaleDateien.length > 0) && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {serverBilder
            .slice()
            .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
            .map((b) => (
              <div key={b.id} className="group relative aspect-square overflow-hidden rounded-lg border border-ink-700/50">
                {inseratId && <AuthedImage path={bildStreamPath(inseratId, b.id)} alt="" className="h-full w-full object-cover" />}
                <button
                  type="button"
                  onClick={() => serverBildLoeschen(b.id)}
                  disabled={uploading}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-950/80 text-chrome-100 opacity-0 transition-opacity hover:bg-danger hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={t('geraetemarkt.form.removeImage')}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          {lokaleDateien.map((datei, i) => (
            <LokaleVorschau key={i} datei={datei} onRemove={() => lokalEntfernen(i)} removeLabel={t('geraetemarkt.form.removeImage')} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Lokale Datei-Vorschau via Object-URL (Anlege-Modus, noch nicht hochgeladen). */
function LokaleVorschau({ datei, onRemove, removeLabel }: { datei: File; onRemove: () => void; removeLabel: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(datei);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [datei]);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-ink-700/50">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- lokale Object-URL-Vorschau vor dem Upload
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-950/80 text-chrome-100 opacity-0 transition-opacity hover:bg-danger hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={removeLabel}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function InseratBearbeitenPage() {
  return (
    <Suspense fallback={<Loading />}>
      <InseratForm />
    </Suspense>
  );
}
