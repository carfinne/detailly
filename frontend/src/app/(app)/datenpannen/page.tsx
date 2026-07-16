'use client';

// Datenpannen-Register (Art. 33/34 DSGVO). KERN – kein Tarif-Gate.
// Endpunkte: GET/POST /incidents, GET/PATCH /incidents/:id,
//            POST /incidents/:id/meldung-entwurf (erzeugt Text, versendet NICHTS).
// Review-before-send: Meldungen an Behoerde/Verantwortlichen/Betroffene werden
// NIE automatisch verschickt – das Register dokumentiert nur DASS/WANN.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { datumZeit } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { INHABER_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import type {
  DataIncident,
  IncidentSchweregrad,
  IncidentStatus,
} from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Field,
  SectionCard,
  Modal,
  useToast,
} from '@/components/ui';

const STATUS_VALUES: IncidentStatus[] = [
  'erkannt',
  'in_pruefung',
  'meldepflichtig',
  'gemeldet',
  'nicht_meldepflichtig',
  'abgeschlossen',
];
const SCHWERE_VALUES: IncidentSchweregrad[] = ['niedrig', 'mittel', 'hoch', 'kritisch'];

const STATUS_BADGE: Record<IncidentStatus, string> = {
  erkannt: 'badge-caution',
  in_pruefung: 'badge-neutral',
  meldepflichtig: 'badge-danger',
  gemeldet: 'badge-positive',
  nicht_meldepflichtig: 'badge-neutral',
  abgeschlossen: 'badge-positive',
};
const SCHWERE_BADGE: Record<IncidentSchweregrad, string> = {
  niedrig: 'badge-neutral',
  mittel: 'badge-caution',
  hoch: 'badge-danger',
  kritisch: 'badge-danger',
};

const H_MS = 60 * 60 * 1000;

/** Kleiner Inline-Spinner fuer Buttons im Lade-/Speichern-Zustand (nie totes „Lädt…"). */
function ButtonSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      {label}
    </span>
  );
}

export default function DatenpannenPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const darfSehen = !!user && INHABER_ROLLEN.includes(user.role);

  const [items, setItems] = useState<DataIncident[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);

  // Live-Countdown: Tick alle 30 s (kein sekundengenaues Neurendern noetig).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<DataIncident[]>('/incidents');
      setItems(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('datenpanne.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (darfSehen) void load();
  }, [darfSehen, load]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const replace = useCallback((inc: DataIncident) => {
    setItems((list) => list.map((i) => (i.id === inc.id ? inc : i)));
  }, []);

  const patch = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      try {
        const updated = await api.patch<DataIncident>(`/incidents/${id}`, body);
        replace(updated);
        toast(t('datenpanne.saved'), { variant: 'positive' });
      } catch (e) {
        toast(e instanceof ApiError ? e.message : t('datenpanne.error.save'), { variant: 'copper' });
      }
    },
    [replace, t, toast],
  );

  if (!darfSehen) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('datenpanne.title')} subtitle={t('datenpanne.subtitle')} />
        <ErrorBox message={t('datenpanne.noAccess')} withGame={false} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('datenpanne.title')}
        subtitle={t('datenpanne.subtitle')}
        action={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            {t('datenpanne.new')}
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <SectionCard>
          <Empty
            text={t('datenpanne.empty')}
            action={
              <button className="btn-secondary" onClick={() => setCreateOpen(true)}>
                {t('datenpanne.new')}
              </button>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Liste */}
          <div className="space-y-2">
            {items.map((inc) => {
              const rest = new Date(inc.frist.deadline).getTime() - now;
              return (
                <button
                  key={inc.id}
                  onClick={() => setSelectedId(inc.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    inc.id === selectedId
                      ? 'border-copper/60 bg-copper-soft'
                      : 'border-ink-700 bg-ink-850 hover:border-ink-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={STATUS_BADGE[inc.status]}>{t(`datenpanne.status.${inc.status}`)}</Badge>
                    <FristChip restMs={rest} t={t} />
                  </div>
                  <p className="mt-1.5 truncate text-sm text-chrome-100">
                    {inc.beschreibung ||
                      (inc.signalTyp
                        ? t(`datenpanne.signal.${inc.signalTyp}`)
                        : t('datenpanne.detail.noTitle'))}
                  </p>
                  <p className="mt-0.5 text-xs text-chrome-500">
                    {t(`datenpanne.quelle.${inc.quelle}`)} · {datumZeit(inc.kenntnisAm)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          {selected ? (
            <IncidentDetail
              key={selected.id}
              inc={selected}
              now={now}
              t={t}
              onPatch={patch}
              onMeldung={async () => {
                try {
                  const { entwurf } = await api.post<{ entwurf: string }>(
                    `/incidents/${selected.id}/meldung-entwurf`,
                  );
                  replace({ ...selected, meldungEntwurf: entwurf });
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : t('datenpanne.error.save'), { variant: 'copper' });
                }
              }}
              onCopy={(text) => {
                void navigator.clipboard?.writeText(text);
                toast(t('datenpanne.meldung.copied'), { variant: 'positive' });
              }}
            />
          ) : (
            <SectionCard>
              <Empty text={t('datenpanne.detail.select')} />
            </SectionCard>
          )}
        </div>
      )}

      <CreateModal
        open={createOpen}
        t={t}
        onClose={() => setCreateOpen(false)}
        onCreated={(inc) => {
          setItems((list) => [inc, ...list]);
          setSelectedId(inc.id);
          setCreateOpen(false);
          toast(t('datenpanne.create.saved'), { variant: 'positive' });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 72h-Frist-Chip
// ---------------------------------------------------------------------------
function FristChip({ restMs, t }: { restMs: number; t: (k: string, p?: Record<string, string | number>) => string }) {
  if (restMs < 0) return <Badge className="badge-danger">{t('datenpanne.frist.ueberfaellig')}</Badge>;
  const std = Math.floor(restMs / H_MS);
  const klasse = restMs < 12 * H_MS ? 'badge-danger' : restMs < 24 * H_MS ? 'badge-caution' : 'badge-neutral';
  return <Badge className={klasse}>{t('datenpanne.frist.rest', { stunden: std })}</Badge>;
}

// ---------------------------------------------------------------------------
// Detail-Panel
// ---------------------------------------------------------------------------
function IncidentDetail({
  inc,
  now,
  t,
  onPatch,
  onMeldung,
  onCopy,
}: {
  inc: DataIncident;
  now: number;
  t: (k: string, p?: Record<string, string | number>) => string;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
  onMeldung: () => Promise<void>;
  onCopy: (text: string) => void;
}) {
  const [draft, setDraft] = useState({
    beschreibung: inc.beschreibung ?? '',
    betroffeneDatenkategorien: (inc.betroffeneDatenkategorien ?? []).join(', '),
    betroffenePersonenAnzahl: inc.betroffenePersonenAnzahl?.toString() ?? '',
    betroffeneDatensaetzeAnzahl: inc.betroffeneDatensaetzeAnzahl?.toString() ?? '',
    wahrscheinlicheFolgen: inc.wahrscheinlicheFolgen ?? '',
    getroffeneMassnahmen: inc.getroffeneMassnahmen ?? '',
    risikoBewertung: inc.risikoBewertung ?? '',
  });
  const [saving, setSaving] = useState(false);

  const rest = new Date(inc.frist.deadline).getTime() - now;

  const speichern = async () => {
    setSaving(true);
    await onPatch(inc.id, {
      beschreibung: draft.beschreibung,
      betroffeneDatenkategorien: draft.betroffeneDatenkategorien
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      // Leeres Feld -> null (Wert bewusst ZURUECKSETZEN), nicht undefined (PATCH
      // wuerde das Feld sonst auslassen und der alte Wert bliebe stehen).
      betroffenePersonenAnzahl: draft.betroffenePersonenAnzahl
        ? Number(draft.betroffenePersonenAnzahl)
        : null,
      betroffeneDatensaetzeAnzahl: draft.betroffeneDatensaetzeAnzahl
        ? Number(draft.betroffeneDatensaetzeAnzahl)
        : null,
      wahrscheinlicheFolgen: draft.wahrscheinlicheFolgen,
      getroffeneMassnahmen: draft.getroffeneMassnahmen,
      risikoBewertung: draft.risikoBewertung,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Kopf: Frist + Status/Schweregrad */}
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-chrome-500">{t('datenpanne.frist.label')}</p>
            <p className={`mt-0.5 text-lg font-semibold ${rest < 0 ? 'text-danger' : 'text-chrome-50'}`}>
              {rest < 0 ? t('datenpanne.frist.ueberfaellig') : t('datenpanne.frist.rest', { stunden: Math.floor(rest / H_MS) })}
            </p>
            <p className="mt-0.5 text-xs text-chrome-500">
              {t('datenpanne.frist.deadline', { datum: datumZeit(inc.frist.deadline) })}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('datenpanne.field.status')} htmlFor="dp-status" className="!mb-0">
              <select
                id="dp-status"
                className="select"
                value={inc.status}
                onChange={(e) => void onPatch(inc.id, { status: e.target.value })}
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`datenpanne.status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('datenpanne.field.schweregrad')} htmlFor="dp-schwere" className="!mb-0">
              <select
                id="dp-schwere"
                className="select"
                value={inc.schweregrad}
                onChange={(e) => void onPatch(inc.id, { schweregrad: e.target.value })}
              >
                {SCHWERE_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {t(`datenpanne.schwere.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-chrome-500">
          <Badge className={SCHWERE_BADGE[inc.schweregrad]}>{t(`datenpanne.schwere.${inc.schweregrad}`)}</Badge>
          <span>{t(`datenpanne.quelle.${inc.quelle}`)}</span>
          {inc.signalTyp && <span>· {t(`datenpanne.signal.${inc.signalTyp}`)}</span>}
          <span>· {t('datenpanne.field.kenntnis')}: {datumZeit(inc.kenntnisAm)}</span>
        </div>
      </SectionCard>

      {/* Sachverhalt */}
      <SectionCard title={t('datenpanne.section.sachverhalt')}>
        <div className="space-y-4">
          <Field label={t('datenpanne.field.beschreibung')} htmlFor="dp-b">
            <textarea
              id="dp-b"
              className="input"
              rows={3}
              value={draft.beschreibung}
              onChange={(e) => setDraft({ ...draft, beschreibung: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('datenpanne.field.personen')} htmlFor="dp-p">
              <input
                id="dp-p"
                type="number"
                min={0}
                className="input"
                value={draft.betroffenePersonenAnzahl}
                onChange={(e) => setDraft({ ...draft, betroffenePersonenAnzahl: e.target.value })}
              />
            </Field>
            <Field label={t('datenpanne.field.datensaetze')} htmlFor="dp-d">
              <input
                id="dp-d"
                type="number"
                min={0}
                className="input"
                value={draft.betroffeneDatensaetzeAnzahl}
                onChange={(e) => setDraft({ ...draft, betroffeneDatensaetzeAnzahl: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label={t('datenpanne.field.kategorien')}
            htmlFor="dp-k"
            help={t('datenpanne.field.kategorienHint')}
          >
            <input
              id="dp-k"
              className="input"
              value={draft.betroffeneDatenkategorien}
              onChange={(e) => setDraft({ ...draft, betroffeneDatenkategorien: e.target.value })}
            />
          </Field>
          <Field label={t('datenpanne.field.folgen')} htmlFor="dp-f">
            <textarea
              id="dp-f"
              className="input"
              rows={2}
              value={draft.wahrscheinlicheFolgen}
              onChange={(e) => setDraft({ ...draft, wahrscheinlicheFolgen: e.target.value })}
            />
          </Field>
          <Field label={t('datenpanne.field.massnahmen')} htmlFor="dp-m">
            <textarea
              id="dp-m"
              className="input"
              rows={2}
              value={draft.getroffeneMassnahmen}
              onChange={(e) => setDraft({ ...draft, getroffeneMassnahmen: e.target.value })}
            />
          </Field>
          <Field label={t('datenpanne.field.risiko')} htmlFor="dp-r">
            <textarea
              id="dp-r"
              className="input"
              rows={2}
              value={draft.risikoBewertung}
              onChange={(e) => setDraft({ ...draft, risikoBewertung: e.target.value })}
            />
          </Field>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => void speichern()} disabled={saving}>
              {saving ? <ButtonSpinner label={t('common.loadingEllipsis')} /> : t('datenpanne.save')}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Melde-/Eskalationskette */}
      <SectionCard title={t('datenpanne.eskalation.title')} subtitle={t('datenpanne.eskalation.hint')}>
        <div className="space-y-3">
          <EskalationRow
            label={t('datenpanne.eskalation.verantwortlicher')}
            at={inc.verantwortlicherInformiertAm}
            onToggle={(v) => void onPatch(inc.id, { verantwortlicherInformiert: v })}
          />
          <EskalationRow
            label={t('datenpanne.eskalation.behoerde')}
            at={inc.aufsichtsbehoerdeGemeldetAm}
            onToggle={(v) => void onPatch(inc.id, { aufsichtsbehoerdeGemeldet: v })}
          />
          <EskalationRow
            label={t('datenpanne.eskalation.betroffene')}
            at={inc.betroffeneInformiertAm}
            onToggle={(v) => void onPatch(inc.id, { betroffeneInformiert: v })}
          />
        </div>
      </SectionCard>

      {/* Melde-Vorlage (Art. 33) */}
      <SectionCard
        title={t('datenpanne.meldung.title')}
        subtitle={t('datenpanne.meldung.hint')}
        action={
          <button className="btn-secondary" onClick={() => void onMeldung()}>
            {t('datenpanne.meldung.generate')}
          </button>
        }
      >
        {inc.meldungEntwurf ? (
          <div className="space-y-3">
            <textarea className="input font-mono text-xs" rows={14} readOnly value={inc.meldungEntwurf} />
            <div className="flex justify-end">
              <button className="btn-secondary" onClick={() => onCopy(inc.meldungEntwurf ?? '')}>
                {t('datenpanne.meldung.copy')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-chrome-500">{t('datenpanne.meldung.empty')}</p>
        )}
      </SectionCard>
    </div>
  );
}

function EskalationRow({
  label,
  at,
  onToggle,
}: {
  label: string;
  at: string | null;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
        checked={!!at}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="text-sm text-chrome-100">{label}</span>
        {at && <span className="ml-2 text-xs text-chrome-500">({datumZeit(at)})</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Anlage-Modal
// ---------------------------------------------------------------------------
function CreateModal({
  open,
  t,
  onClose,
  onCreated,
}: {
  open: boolean;
  t: (k: string, p?: Record<string, string | number>) => string;
  onClose: () => void;
  onCreated: (inc: DataIncident) => void;
}) {
  const [beschreibung, setBeschreibung] = useState('');
  const [schweregrad, setSchweregrad] = useState<IncidentSchweregrad>('mittel');
  const [kategorien, setKategorien] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!beschreibung.trim()) {
      setErr(t('datenpanne.create.beschreibungRequired'));
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const inc = await api.post<DataIncident>('/incidents', {
        beschreibung: beschreibung.trim(),
        schweregrad,
        betroffeneDatenkategorien: kategorien
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setBeschreibung('');
      setKategorien('');
      setSchweregrad('mittel');
      onCreated(inc);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t('datenpanne.error.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('datenpanne.create.title')}>
      <div className="space-y-4">
        <p className="text-xs text-chrome-500">{t('datenpanne.create.hint')}</p>
        {err && <ErrorBox message={err} withGame={false} />}
        <Field label={t('datenpanne.field.beschreibung')} htmlFor="dp-c-b" required>
          <textarea
            id="dp-c-b"
            className="input"
            rows={3}
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
        </Field>
        <Field label={t('datenpanne.field.schweregrad')} htmlFor="dp-c-s">
          <select
            id="dp-c-s"
            className="select"
            value={schweregrad}
            onChange={(e) => setSchweregrad(e.target.value as IncidentSchweregrad)}
          >
            {SCHWERE_VALUES.map((s) => (
              <option key={s} value={s}>
                {t(`datenpanne.schwere.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('datenpanne.field.kategorien')}
          htmlFor="dp-c-k"
          help={t('datenpanne.field.kategorienHint')}
        >
          <input
            id="dp-c-k"
            className="input"
            value={kategorien}
            onChange={(e) => setKategorien(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? <ButtonSpinner label={t('common.loadingEllipsis')} /> : t('datenpanne.create.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
