'use client';

// Datenschutz-Cockpit (DSGVO Art. 5/15/17). KERN – kein Tarif-Gate.
// Endpunkte:
//   GET  /datenschutz/faellige-kunden   (OWNER/MANAGER)
//   GET  /datenschutz/verlauf           (OWNER/MANAGER)
//   POST /customers/:id/gdpr-delete      (OWNER/MANAGER, Entscheidung anonym/loeschen)
//   GET  /datenschutz/export            (OWNER, Betriebs-Gesamtexport)
//   PATCH /tenants/me { datenschutz }    (OWNER, Fristkonfiguration)
// Review-before-send: es wird NICHTS automatisch geloescht – der Betrieb bestaetigt
// jede (unumkehrbare) Loeschung/Anonymisierung einzeln oder gesammelt.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, downloadAuthed } from '@/lib/api';
import { datum } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { INHABER_ROLLEN, LEITUNG_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import {
  PageHeader,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Field,
  SectionCard,
  ConfirmDialog,
  useToast,
} from '@/components/ui';

interface FaelligerKunde {
  id: string;
  name: string;
  letzterKontakt: string | null;
  modus: 'anonymisiert' | 'geloescht';
  belege: { rechnungen: number; angebote: number; abgerechneteAuftraege: number; signierteProtokolle: number };
}
interface FaelligeResult {
  aktiv: boolean;
  fristJahre: number;
  cutoff: string | null;
  anzahl: number;
  gekappt: boolean;
  kunden: FaelligerKunde[];
}
interface VerlaufEintrag {
  id: string;
  action: string;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
}

/** Uebersetzt eine Audit-Action in ein lesbares Label (Fallback: rohe Action). */
function actionLabel(action: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    gdpr_delete: t('dsgvo.action.delete'),
    gdpr_anonymize: t('dsgvo.action.anonymize'),
    gdpr_export: t('dsgvo.action.export'),
    gdpr_tenant_export: t('dsgvo.action.tenantExport'),
  };
  return map[action] ?? action;
}

/** Kleiner Inline-Spinner fuer Buttons im Lade-/Speichern-Zustand. */
function ButtonSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
      {label}
    </span>
  );
}

export default function DatenschutzCockpitPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const darfSehen = !!user && LEITUNG_ROLLEN.includes(user.role);
  const istInhaber = !!user && INHABER_ROLLEN.includes(user.role);

  const [faellige, setFaellige] = useState<FaelligeResult | null>(null);
  const [verlauf, setVerlauf] = useState<VerlaufEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Auswahl fuer die Sammel-Bestaetigung.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fristkonfiguration (OWNER).
  const [fristInput, setFristInput] = useState('');
  const [savingFrist, setSavingFrist] = useState(false);
  const [exporting, setExporting] = useState(false);

  const laden = useCallback(async () => {
    if (!darfSehen) return;
    setLoading(true);
    setError('');
    try {
      const [f, v] = await Promise.all([
        api.get<FaelligeResult>('/datenschutz/faellige-kunden'),
        api.get<VerlaufEintrag[]>('/datenschutz/verlauf'),
      ]);
      setFaellige(f);
      setVerlauf(v);
      setFristInput(String(f.fristJahre));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dsgvo.error.load'));
    } finally {
      setLoading(false);
    }
  }, [darfSehen, t]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const alleAusgewaehlt = useMemo(
    () => !!faellige && faellige.kunden.length > 0 && selected.size === faellige.kunden.length,
    [faellige, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAlle() {
    if (!faellige) return;
    setSelected((prev) => (prev.size === faellige.kunden.length ? new Set() : new Set(faellige.kunden.map((k) => k.id))));
  }

  async function bestaetigen() {
    if (!selected.size) return;
    setBusy(true);
    let ok = 0;
    let fehler = 0;
    for (const id of Array.from(selected)) {
      try {
        await api.post(`/customers/${id}/gdpr-delete`);
        ok += 1;
      } catch {
        fehler += 1;
      }
    }
    setBusy(false);
    setConfirmOpen(false);
    if (ok > 0) toast(t('dsgvo.toast.done', { count: String(ok) }), { variant: 'positive' });
    if (fehler > 0) toast(t('dsgvo.toast.partial', { count: String(fehler) }), { variant: 'copper' });
    await laden();
  }

  async function saveFrist(e: React.FormEvent) {
    e.preventDefault();
    setSavingFrist(true);
    try {
      const jahre = Math.max(0, Math.min(20, parseInt(fristInput, 10) || 0));
      await api.patch('/tenants/me', { datenschutz: { aufbewahrungInaktiveKundenJahre: jahre } });
      toast(t('dsgvo.toast.fristSaved'), { variant: 'positive' });
      await laden();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('dsgvo.error.save'), { variant: 'copper' });
    } finally {
      setSavingFrist(false);
    }
  }

  async function exportBetrieb() {
    setExporting(true);
    try {
      await downloadAuthed('/datenschutz/export', 'betriebsdaten.json');
      toast(t('dsgvo.toast.exportDone'), { variant: 'positive' });
    } catch (err) {
      toast(err instanceof Error ? err.message : t('dsgvo.error.export'), { variant: 'copper' });
    } finally {
      setExporting(false);
    }
  }

  if (!darfSehen) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dsgvo.title')} subtitle={t('dsgvo.subtitle')} />
        <ErrorBox message={t('dsgvo.noAccess')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('dsgvo.title')} subtitle={t('dsgvo.subtitle')} />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : (
        <>
          {/* --- Pruefliste faelliger Kunden --- */}
          <SectionCard
            title={t('dsgvo.pruefliste.title')}
            subtitle={
              faellige?.aktiv
                ? t('dsgvo.pruefliste.subtitleActive', {
                    jahre: String(faellige.fristJahre),
                    cutoff: faellige.cutoff ? datum(faellige.cutoff) : '–',
                  })
                : t('dsgvo.pruefliste.subtitleOff')
            }
          >
            {!faellige?.aktiv ? (
              <Empty text={t('dsgvo.pruefliste.off')} />
            ) : faellige.kunden.length === 0 ? (
              <Empty text={t('dsgvo.pruefliste.empty')} />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-chrome-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40" checked={alleAusgewaehlt} onChange={toggleAlle} />
                    {t('dsgvo.pruefliste.selectAll')}
                  </label>
                  <button
                    type="button"
                    className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    disabled={selected.size === 0 || busy}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t('dsgvo.pruefliste.confirmSelected', { count: String(selected.size) })}
                  </button>
                </div>

                <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">
                  {faellige.kunden.map((k) => {
                    const belege =
                      k.belege.rechnungen + k.belege.angebote + k.belege.abgerechneteAuftraege + k.belege.signierteProtokolle;
                    return (
                      <li key={k.id} className="flex flex-wrap items-center gap-3 p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
                          checked={selected.has(k.id)}
                          onChange={() => toggle(k.id)}
                          aria-label={k.name}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-chrome-100">{k.name}</p>
                          <p className="text-xs text-chrome-500">
                            {t('dsgvo.pruefliste.lastContact')}: {k.letzterKontakt ? datum(k.letzterKontakt) : '–'}
                          </p>
                        </div>
                        <Badge className={k.modus === 'geloescht' ? 'badge-danger' : 'badge-neutral'}>
                          {k.modus === 'geloescht'
                            ? t('dsgvo.modus.delete')
                            : t('dsgvo.modus.anonymize', { count: String(belege) })}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                {faellige.gekappt && <p className="text-xs text-chrome-500">{t('dsgvo.pruefliste.capped')}</p>}
              </div>
            )}
          </SectionCard>

          {/* --- Frist-Konfiguration (OWNER) --- */}
          {istInhaber && (
            <SectionCard title={t('dsgvo.frist.title')} subtitle={t('dsgvo.frist.subtitle')}>
              <form onSubmit={saveFrist} className="flex flex-wrap items-end gap-3">
                <Field label={t('dsgvo.frist.label')} htmlFor="frist" help={t('dsgvo.frist.help')}>
                  <input
                    id="frist"
                    type="number"
                    min={0}
                    max={20}
                    className="input w-28"
                    value={fristInput}
                    onChange={(e) => setFristInput(e.target.value)}
                  />
                </Field>
                <button type="submit" className="btn-primary" disabled={savingFrist}>
                  {savingFrist ? <ButtonSpinner label={t('common.save')} /> : t('common.save')}
                </button>
              </form>
            </SectionCard>
          )}

          {/* --- Betriebs-Gesamtexport (OWNER) --- */}
          {istInhaber && (
            <SectionCard title={t('dsgvo.tenantExport.title')} subtitle={t('dsgvo.tenantExport.subtitle')}>
              <button type="button" className="btn-ghost" onClick={exportBetrieb} disabled={exporting}>
                {exporting ? <ButtonSpinner label={t('dsgvo.tenantExport.exporting')} /> : t('dsgvo.tenantExport.btn')}
              </button>
            </SectionCard>
          )}

          {/* --- Verlauf / Protokoll --- */}
          <SectionCard title={t('dsgvo.verlauf.title')} subtitle={t('dsgvo.verlauf.subtitle')}>
            {verlauf.length === 0 ? (
              <Empty text={t('dsgvo.verlauf.empty')} />
            ) : (
              <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">
                {verlauf.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <Badge className="badge-neutral">{actionLabel(v.action, t)}</Badge>
                    <span className="text-chrome-400">{datum(v.createdAt)}</span>
                    <span className="text-chrome-600">{v.entityId ? `#${v.entityId.slice(0, 8)}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('dsgvo.confirm.title')}
        message={
          <>
            {t('dsgvo.confirm.message', { count: String(selected.size) })}{' '}
            <strong className="font-semibold text-chrome-100">{t('dsgvo.confirm.emph')}</strong>
          </>
        }
        confirmLabel={t('dsgvo.confirm.confirm')}
        busy={busy}
        onConfirm={bestaetigen}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
