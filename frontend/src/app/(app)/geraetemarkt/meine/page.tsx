'use client';

// Geraete-Gebrauchtmarkt · Meine Inserate. Eigene Inserate des Betriebs mit
// Status-Aktionen (reservieren/verkauft/wieder aktiv/loeschen) und Bearbeiten.
// Nur fuer die Leitung (OWNER/MANAGER) – wie die Backend-Mutationen.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { useT } from '@/lib/i18n';
import { PageHeader, ErrorBox, Empty, Loading, ConfirmDialog, useToast, SectionCard } from '@/components/ui';
import AuthedImage from '@/components/AuthedImage';
import { Icon, ICON_PATHS } from '@/lib/icons';
import {
  KATEGORIE_KEY,
  STATUS_BADGE,
  STATUS_KEY,
  bildStreamPath,
  primaerBild,
  type InseratFull,
} from '@/lib/geraetemarkt';

/** Kleines Vorschaubild einer Inserats-Zeile; sonst Gradient-Kachel. */
function ZeilenBild({ inserat }: { inserat: InseratFull }) {
  const bild = primaerBild(inserat);
  if (!bild) {
    return (
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-ink-700/50 bg-copper-grad">
        <Icon className="h-6 w-6 text-ink-950/60">{ICON_PATHS.box}</Icon>
      </div>
    );
  }
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-700/50">
      <AuthedImage path={bildStreamPath(inserat.id, bild.id)} alt={inserat.titel} className="h-full w-full object-cover" />
    </div>
  );
}

export default function MeineInseratePage() {
  const t = useT();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  const [inserate, setInserate] = useState<InseratFull[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<InseratFull | null>(null);
  const [loeschtBusy, setLoeschtBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get<InseratFull[]>('/geraetemarkt/meine')
      .then(setInserate)
      .catch((e) => setError(e instanceof Error ? e.message : t('geraetemarkt.error.load')));
  }, [t]);

  useEffect(() => {
    if (istLeitung) load();
  }, [istLeitung, load]);

  async function statusSetzen(inserat: InseratFull, status: string) {
    setBusyId(inserat.id);
    setError('');
    try {
      await api.patch(`/geraetemarkt/${inserat.id}/status`, { status });
      setInserate((list) => (list ?? []).map((i) => (i.id === inserat.id ? { ...i, status } : i)));
      toast(t('geraetemarkt.meine.statusUpdated'), { variant: 'copper' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('geraetemarkt.meine.statusError'));
    } finally {
      setBusyId(null);
    }
  }

  async function loeschenBestaetigt() {
    if (!loeschen) return;
    setLoeschtBusy(true);
    try {
      await api.delete(`/geraetemarkt/${loeschen.id}`);
      setInserate((list) => (list ?? []).filter((i) => i.id !== loeschen.id));
      toast(t('geraetemarkt.meine.deleted'));
      setLoeschen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('geraetemarkt.meine.deleteError'));
    } finally {
      setLoeschtBusy(false);
    }
  }

  if (authLoading) return <Loading />;

  if (!istLeitung) {
    return (
      <div>
        <PageHeader title={t('geraetemarkt.myListings')} />
        <SectionCard>
          <p className="text-sm text-chrome-400">{t('geraetemarkt.form.roleHint')}</p>
          <Link href="/geraetemarkt" className="btn-subtle btn-sm mt-4 inline-flex">
            {t('geraetemarkt.detail.backToBrowse')}
          </Link>
        </SectionCard>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('geraetemarkt.myListings')}
        subtitle={t('geraetemarkt.meine.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <Link href="/geraetemarkt" className="btn-subtle btn-sm">
              {t('geraetemarkt.meine.toBrowse')}
            </Link>
            <Link href="/geraetemarkt/bearbeiten" className="btn-primary btn-sm">
              {t('geraetemarkt.newListing')}
            </Link>
          </div>
        }
      />

      {error && <ErrorBox message={error} />}

      {inserate === null ? (
        <Loading />
      ) : inserate.length === 0 ? (
        <div className="card">
          <Empty
            text={t('geraetemarkt.meine.empty')}
            action={
              <Link href="/geraetemarkt/bearbeiten" className="btn-primary btn-sm">
                {t('geraetemarkt.newListing')}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {inserate.map((inserat) => {
            const busy = busyId === inserat.id;
            return (
              <div key={inserat.id} className="card-flush flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ZeilenBild inserat={inserat} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[inserat.status] ?? 'badge-neutral'}`}
                      >
                        {t(STATUS_KEY[inserat.status] ?? inserat.status)}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-chrome-500">
                        {t(KATEGORIE_KEY[inserat.kategorie] ?? inserat.kategorie)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-chrome-50">{inserat.titel}</p>
                    <p className="text-xs text-chrome-500">
                      {inserat.preisModus === 'anfrage' || inserat.preis == null
                        ? t('geraetemarkt.preisModus.anfrage')
                        : `${eur(inserat.preis)}${inserat.preisModus === 'vb' ? ' ' + t('geraetemarkt.preisModus.vbShort') : ''}`}
                      {' · '}
                      {datum(inserat.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {inserat.status === 'aktiv' && (
                    <button className="btn-subtle btn-sm" disabled={busy} onClick={() => statusSetzen(inserat, 'reserviert')}>
                      {t('geraetemarkt.meine.action.reserve')}
                    </button>
                  )}
                  {inserat.status === 'reserviert' && (
                    <button className="btn-subtle btn-sm" disabled={busy} onClick={() => statusSetzen(inserat, 'aktiv')}>
                      {t('geraetemarkt.meine.action.reactivate')}
                    </button>
                  )}
                  {(inserat.status === 'aktiv' || inserat.status === 'reserviert') && (
                    <button className="btn-subtle btn-sm" disabled={busy} onClick={() => statusSetzen(inserat, 'verkauft')}>
                      {t('geraetemarkt.meine.action.markSold')}
                    </button>
                  )}
                  {(inserat.status === 'verkauft' || inserat.status === 'entfernt') && (
                    <button className="btn-subtle btn-sm" disabled={busy} onClick={() => statusSetzen(inserat, 'aktiv')}>
                      {t('geraetemarkt.meine.action.republish')}
                    </button>
                  )}
                  <Link href={`/geraetemarkt/bearbeiten/?id=${inserat.id}`} className="btn-ghost btn-sm">
                    {t('geraetemarkt.meine.action.edit')}
                  </Link>
                  <button
                    className="btn-ghost btn-sm text-danger hover:text-danger"
                    disabled={busy}
                    onClick={() => setLoeschen(inserat)}
                    aria-label={t('geraetemarkt.meine.action.delete')}
                  >
                    {t('geraetemarkt.meine.action.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!loeschen}
        title={t('geraetemarkt.meine.deleteTitle')}
        message={t('geraetemarkt.meine.deleteConfirm', { titel: loeschen?.titel ?? '' })}
        confirmLabel={t('geraetemarkt.meine.action.delete')}
        busy={loeschtBusy}
        onConfirm={loeschenBestaetigt}
        onCancel={() => setLoeschen(null)}
      />
    </div>
  );
}
