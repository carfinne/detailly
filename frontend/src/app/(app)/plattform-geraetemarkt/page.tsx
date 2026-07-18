'use client';

// Betreiber-Moderation des Geraete-Gebrauchtmarkts (Detailly-Team). NUR
// Plattform-Rollen: Lesen fuer alle drei (Admin/Support/Analyst), Aktionen nur
// fuer Admin + Support (Analyst = read-only). Der eigentliche Schutz sitzt im
// Backend (@Roles PLATFORM_*); dieser Page-Guard blendet die Seite fuer alle
// anderen aus und versteckt Aktionen fuer den Analysten zusaetzlich clientseitig.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { datum } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { PLATTFORM_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import { PageHeader, ErrorBox, Empty, Badge, ConfirmDialog, useToast } from '@/components/ui';
import { Pager } from '@/components/Pager';
import {
  KATEGORIE_KEY,
  MELDE_GRUND_KEY,
  MELDUNG_STATUS,
  MELDUNG_STATUS_BADGE,
  MELDUNG_STATUS_KEY,
  MODERATION_STATUS,
  MODERATION_STATUS_BADGE,
  MODERATION_STATUS_KEY,
  STATUS_BADGE,
  STATUS_KEY,
  SYSTEM_MELDER_ID,
  type MeldungMitInserat,
  type ModerationInserat,
  type ModerationStatus,
  type Paginated,
} from '@/lib/geraetemarkt';

/** Aktionen sind Admin + Support vorbehalten – der Analyst liest nur mit. */
const HANDELNDE_ROLLEN = ['platform_admin', 'platform_support'];

type Tab = 'meldungen' | 'inserate';

/** Anstehende, zu bestaetigende Moderations-Aenderung eines Inserats. */
type PendingMod = { inseratId: string; titel: string; ziel: ModerationStatus };

export default function PlattformGeraetemarktPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();

  const darfSehen = !!user && PLATTFORM_ROLLEN.includes(user.role);
  const darfHandeln = !!user && HANDELNDE_ROLLEN.includes(user.role);

  const [tab, setTab] = useState<Tab>('meldungen');

  // Meldungen (Default: offen)
  const [meldStatus, setMeldStatus] = useState<string>('offen');
  const [meldPage, setMeldPage] = useState(1);
  const [meldungen, setMeldungen] = useState<Paginated<MeldungMitInserat> | null>(null);

  // Inserate (alle inkl. verborgene/entfernte)
  const [modFilter, setModFilter] = useState<string>('');
  const [insPage, setInsPage] = useState(1);
  const [inserate, setInserate] = useState<Paginated<ModerationInserat> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingMod, setPendingMod] = useState<PendingMod | null>(null);

  const loadMeldungen = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({ status: meldStatus, page: String(meldPage), limit: '25' });
      setMeldungen(await api.get<Paginated<MeldungMitInserat>>(`/platform/geraetemarkt/meldungen?${p}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plattformGeraetemarkt.error.load'));
    } finally {
      setLoading(false);
    }
  }, [meldStatus, meldPage, t]);

  const loadInserate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({ page: String(insPage), limit: '25' });
      if (modFilter) p.set('moderationStatus', modFilter);
      setInserate(await api.get<Paginated<ModerationInserat>>(`/platform/geraetemarkt/inserate?${p}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plattformGeraetemarkt.error.load'));
    } finally {
      setLoading(false);
    }
  }, [modFilter, insPage, t]);

  useEffect(() => {
    if (!darfSehen) return;
    if (tab === 'meldungen') void loadMeldungen();
    else void loadInserate();
  }, [darfSehen, tab, loadMeldungen, loadInserate]);

  /** Beide Listen neu laden (nach einer Aktion, die beide betreffen kann). */
  async function reloadAlles() {
    await Promise.all([loadMeldungen(), loadInserate()]);
  }

  /** Moderations-Status eines Inserats setzen. „ok" direkt, sonst per Bestaetigung. */
  function moderationAnfordern(inseratId: string, titel: string, ziel: ModerationStatus) {
    if (ziel === 'ok') void moderationSetzen(inseratId, ziel);
    else setPendingMod({ inseratId, titel, ziel });
  }

  async function moderationSetzen(inseratId: string, ziel: ModerationStatus) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/platform/geraetemarkt/inserate/${inseratId}/moderation`, { moderationStatus: ziel });
      setPendingMod(null);
      toast(t('plattformGeraetemarkt.toast.moderated'), { variant: 'copper' });
      await reloadAlles();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plattformGeraetemarkt.actionError'));
    } finally {
      setBusy(false);
    }
  }

  async function meldungBearbeiten(meldungId: string, status: 'erledigt' | 'verworfen') {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/platform/geraetemarkt/meldungen/${meldungId}`, { status });
      toast(
        status === 'erledigt'
          ? t('plattformGeraetemarkt.toast.meldungDone')
          : t('plattformGeraetemarkt.toast.meldungDismissed'),
        { variant: 'copper' },
      );
      await loadMeldungen();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plattformGeraetemarkt.actionError'));
    } finally {
      setBusy(false);
    }
  }

  if (!darfSehen) {
    return (
      <div>
        <PageHeader title={t('plattformGeraetemarkt.title')} />
        <div className="card">
          <Empty text={t('plattformGeraetemarkt.noAccess')} />
        </div>
      </div>
    );
  }

  const confirmTexte: Record<'verborgen' | 'entfernt', { title: string; text: string; label: string }> = {
    verborgen: {
      title: t('plattformGeraetemarkt.confirm.hideTitle'),
      text: t('plattformGeraetemarkt.confirm.hideText', { titel: pendingMod?.titel ?? '' }),
      label: t('plattformGeraetemarkt.action.hide'),
    },
    entfernt: {
      title: t('plattformGeraetemarkt.confirm.removeTitle'),
      text: t('plattformGeraetemarkt.confirm.removeText', { titel: pendingMod?.titel ?? '' }),
      label: t('plattformGeraetemarkt.action.remove'),
    },
  };

  return (
    <div>
      <PageHeader title={t('plattformGeraetemarkt.title')} subtitle={t('plattformGeraetemarkt.subtitle')} />

      {!darfHandeln && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/50 px-4 py-2.5 text-sm text-chrome-400">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {t('plattformGeraetemarkt.readonlyHint')}
        </div>
      )}

      <div className="seg-group mb-4">
        <button className={`seg ${tab === 'meldungen' ? 'seg-active' : ''}`} onClick={() => setTab('meldungen')}>
          {t('plattformGeraetemarkt.tab.meldungen')}
        </button>
        <button className={`seg ${tab === 'inserate' ? 'seg-active' : ''}`} onClick={() => setTab('inserate')}>
          {t('plattformGeraetemarkt.tab.inserate')}
        </button>
      </div>

      {error && <ErrorBox message={error} className="mb-4" />}

      {tab === 'meldungen' ? (
        <div className="space-y-4">
          {/* Status-Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="kpi-label">{t('plattformGeraetemarkt.meldungen.filterLabel')}</span>
            {MELDUNG_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setMeldPage(1);
                  setMeldStatus(s);
                }}
                className={`choice rounded-full px-3 py-1 text-xs font-medium ${meldStatus === s ? 'choice-active' : ''}`}
              >
                {t(MELDUNG_STATUS_KEY[s])}
              </button>
            ))}
          </div>

          {loading ? (
            <ListSkeleton />
          ) : !meldungen || meldungen.data.length === 0 ? (
            <div className="card">
              <Empty text={t('plattformGeraetemarkt.meldungen.empty')} />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {meldungen.data.map(({ meldung, inserat }) => {
                  const istSystem = meldung.melderTenantId === SYSTEM_MELDER_ID;
                  return (
                    <div key={meldung.id} className="card animate-fade-in space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="badge-danger">{t(MELDE_GRUND_KEY[meldung.grund] ?? meldung.grund)}</Badge>
                            <Badge className={MELDUNG_STATUS_BADGE[meldung.status] ?? 'badge-neutral'}>
                              {t(MELDUNG_STATUS_KEY[meldung.status] ?? meldung.status)}
                            </Badge>
                            {istSystem && (
                              <Badge className="badge-info">{t('plattformGeraetemarkt.meldungen.systemLabel')}</Badge>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs text-chrome-500">
                            {t('plattformGeraetemarkt.meldungen.reportedAt', { datum: datum(meldung.createdAt) })}
                          </p>
                        </div>
                      </div>

                      {meldung.kommentar && (
                        <div className="rounded-xl border border-ink-700 bg-ink-900/50 px-4 py-3">
                          <p className="kpi-label">{t('plattformGeraetemarkt.meldungen.comment')}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-chrome-200">{meldung.kommentar}</p>
                        </div>
                      )}

                      {/* Betroffenes Inserat */}
                      <div className="rounded-xl border border-ink-700/70 bg-ink-900/30 px-4 py-3">
                        {inserat ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-chrome-50">{inserat.titel}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge className={STATUS_BADGE[inserat.status] ?? 'badge-neutral'}>
                                  {t(STATUS_KEY[inserat.status] ?? inserat.status)}
                                </Badge>
                                <Badge className={MODERATION_STATUS_BADGE[inserat.moderationStatus] ?? 'badge-neutral'}>
                                  {t(MODERATION_STATUS_KEY[inserat.moderationStatus] ?? inserat.moderationStatus)}
                                </Badge>
                              </div>
                            </div>
                            <Link href={`/geraetemarkt/inserat/?id=${inserat.id}`} className="btn-subtle btn-sm shrink-0">
                              {t('plattformGeraetemarkt.action.viewInserat')}
                            </Link>
                          </div>
                        ) : (
                          <p className="text-sm text-chrome-500">{t('plattformGeraetemarkt.meldungen.inseratGone')}</p>
                        )}
                      </div>

                      {/* Aktionen (nur Admin/Support; nur offene Meldungen) */}
                      {darfHandeln && meldung.status === 'offen' && (
                        <div className="flex flex-wrap justify-end gap-2 border-t border-ink-700/50 pt-3">
                          {inserat && inserat.moderationStatus !== 'verborgen' && (
                            <button
                              className="btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => moderationAnfordern(inserat.id, inserat.titel, 'verborgen')}
                            >
                              {t('plattformGeraetemarkt.action.hide')}
                            </button>
                          )}
                          {inserat && inserat.moderationStatus !== 'entfernt' && (
                            <button
                              className="btn-ghost btn-sm text-danger"
                              disabled={busy}
                              onClick={() => moderationAnfordern(inserat.id, inserat.titel, 'entfernt')}
                            >
                              {t('plattformGeraetemarkt.action.remove')}
                            </button>
                          )}
                          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => meldungBearbeiten(meldung.id, 'verworfen')}>
                            {t('plattformGeraetemarkt.meldungen.dismiss')}
                          </button>
                          <button className="btn-primary btn-sm" disabled={busy} onClick={() => meldungBearbeiten(meldung.id, 'erledigt')}>
                            {t('plattformGeraetemarkt.meldungen.markDone')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Pager page={meldungen.page} total={meldungen.total} limit={meldungen.limit} onPage={setMeldPage} />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Moderations-Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="kpi-label">{t('plattformGeraetemarkt.inserate.filterLabel')}</span>
            <button
              onClick={() => {
                setInsPage(1);
                setModFilter('');
              }}
              className={`choice rounded-full px-3 py-1 text-xs font-medium ${modFilter === '' ? 'choice-active' : ''}`}
            >
              {t('plattformGeraetemarkt.inserate.filterAll')}
            </button>
            {MODERATION_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInsPage(1);
                  setModFilter(s);
                }}
                className={`choice rounded-full px-3 py-1 text-xs font-medium ${modFilter === s ? 'choice-active' : ''}`}
              >
                {t(MODERATION_STATUS_KEY[s])}
              </button>
            ))}
          </div>

          {loading ? (
            <ListSkeleton />
          ) : !inserate || inserate.data.length === 0 ? (
            <div className="card">
              <Empty text={t('plattformGeraetemarkt.inserate.empty')} />
            </div>
          ) : (
            <>
              <div className="card overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('plattformGeraetemarkt.table.listing')}</th>
                      <th>{t('plattformGeraetemarkt.table.category')}</th>
                      <th>{t('plattformGeraetemarkt.table.status')}</th>
                      <th>{t('plattformGeraetemarkt.table.moderation')}</th>
                      <th>{t('plattformGeraetemarkt.table.createdAt')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inserate.data.map((ins) => (
                      <tr key={ins.id} className={ins.moderationStatus !== 'ok' ? 'opacity-70' : undefined}>
                        <td className="max-w-[220px]">
                          <Link href={`/geraetemarkt/inserat/?id=${ins.id}`} className="link-action line-clamp-1">
                            {ins.titel}
                          </Link>
                        </td>
                        <td className="text-chrome-300">{t(KATEGORIE_KEY[ins.kategorie] ?? ins.kategorie)}</td>
                        <td>
                          <Badge className={STATUS_BADGE[ins.status] ?? 'badge-neutral'}>
                            {t(STATUS_KEY[ins.status] ?? ins.status)}
                          </Badge>
                        </td>
                        <td>
                          <Badge className={MODERATION_STATUS_BADGE[ins.moderationStatus] ?? 'badge-neutral'}>
                            {t(MODERATION_STATUS_KEY[ins.moderationStatus] ?? ins.moderationStatus)}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap text-chrome-400">{datum(ins.createdAt)}</td>
                        <td className="text-right">
                          {darfHandeln && (
                            <div className="flex justify-end gap-2">
                              {ins.moderationStatus !== 'ok' && (
                                <button className="link-action" disabled={busy} onClick={() => moderationAnfordern(ins.id, ins.titel, 'ok')}>
                                  {t('plattformGeraetemarkt.action.restore')}
                                </button>
                              )}
                              {ins.moderationStatus !== 'verborgen' && (
                                <button className="link-action" disabled={busy} onClick={() => moderationAnfordern(ins.id, ins.titel, 'verborgen')}>
                                  {t('plattformGeraetemarkt.action.hide')}
                                </button>
                              )}
                              {ins.moderationStatus !== 'entfernt' && (
                                <button className="link-action text-danger" disabled={busy} onClick={() => moderationAnfordern(ins.id, ins.titel, 'entfernt')}>
                                  {t('plattformGeraetemarkt.action.remove')}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={inserate.page} total={inserate.total} limit={inserate.limit} onPage={setInsPage} />
            </>
          )}
        </div>
      )}

      {/* Bestaetigung fuer Verbergen/Entfernen (destruktiv) */}
      <ConfirmDialog
        open={pendingMod !== null && pendingMod.ziel !== 'ok'}
        title={pendingMod && pendingMod.ziel !== 'ok' ? confirmTexte[pendingMod.ziel].title : ''}
        message={pendingMod && pendingMod.ziel !== 'ok' ? confirmTexte[pendingMod.ziel].text : ''}
        confirmLabel={pendingMod && pendingMod.ziel !== 'ok' ? confirmTexte[pendingMod.ziel].label : undefined}
        busy={busy}
        onConfirm={() => pendingMod && moderationSetzen(pendingMod.inseratId, pendingMod.ziel)}
        onCancel={() => setPendingMod(null)}
      />
    </div>
  );
}

/** Animiertes Lade-Skeleton fuer beide Listen. */
function ListSkeleton() {
  return (
    <div className="animate-fade-in space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card space-y-3">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
