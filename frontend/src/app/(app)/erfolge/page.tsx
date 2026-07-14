'use client';

// Erfolge & Bestenliste (Gamification, Welle 1 – strikt BETRIEBSINTERN).
// - Meilenstein-Badges mit Stufe + Fortschritt (KERN, alle Rollen)
// - Leistung des Monats (KERN)
// - Mitarbeiter-Bestenliste (nur LEITUNG_ROLLEN gerendert; Backend hart gegatet)
// - Detailly Wrapped (On-Screen-Karte + dependency-freier PNG-Export)

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import { useT, useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { LEITUNG_ROLLEN } from '@/lib/rollen';
import { PageHeader, SectionCard, ErrorBox, Empty } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';
import { WrappedCard } from '@/components/WrappedCard';
import { downloadWrappedPng, type WrappedView } from '@/lib/wrapped-canvas';
import type {
  AchievementsResponse,
  BadgeTrack,
  LeaderboardResponse,
  LeaderboardZeitraum,
  WrappedResponse,
} from '@/lib/types';

const nf = (n: number) => n.toLocaleString('de-DE');

// UI-Sprache -> Intl-Locale fuer die (dependency-freie) Monatsformatierung.
const LOCALE_BY_LANG: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  ru: 'ru-RU',
  pl: 'pl-PL',
};

/** Monatsindex (1–12) -> kurzer Monatsname in der aktiven UI-Sprache. */
function monatKurz(monat: number, locale: string): string {
  return new Date(2000, monat - 1, 1).toLocaleDateString(locale, { month: 'short' });
}

// Trackwert-Formatierung: Umsatz als €, Jubiläum in Jahren, sonst Ganzzahl.
function fmtTrackWert(key: string, wert: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (key === 'umsatz') return eur(wert);
  if (key === 'jubilaeum') return t('erfolge.track.jahre', { n: wert });
  return nf(wert);
}

// ---------------------------------------------------------------------------
// Meilenstein-Badge
// ---------------------------------------------------------------------------

function BadgeCard({ track }: { track: BadgeTrack }) {
  const t = useT();
  const wert = fmtTrackWert(track.key, track.wert, t);
  const rest =
    track.naechsteSchwelle != null
      ? fmtTrackWert(track.key, Math.max(0, track.naechsteSchwelle - track.wert), t)
      : null;

  return (
    <div className={`card transition-colors ${track.erreicht ? 'border-copper/25' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-chrome-500">
            {t(`erfolge.track.${track.key}`)}
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-chrome-50">{wert}</p>
        </div>
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 transition-transform ${
            track.erreicht
              ? 'bg-copper-soft text-copper ring-copper/25'
              : 'bg-ink-850 text-chrome-600 ring-ink-700'
          }`}
        >
          <Icon className="h-5 w-5">{ICON_PATHS.trophy}</Icon>
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-copper-grad transition-[width] duration-700 ease-emphasized"
          style={{ width: `${Math.max(3, track.fortschrittProzent)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-chrome-400">
          {track.erreicht
            ? t('erfolge.badge.level', { n: track.stufeIndex + 1, max: track.stufenAnzahl })
            : t('erfolge.badge.locked')}
        </span>
        <span className="shrink-0 text-chrome-500">
          {rest != null ? t('erfolge.badge.next', { rest }) : t('erfolge.badge.max')}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leistung des Monats
// ---------------------------------------------------------------------------

function LeistungDesMonats({ data }: { data: AchievementsResponse }) {
  const t = useT();
  const lp = data.leistungDesMonats;
  return (
    <SectionCard title={t('erfolge.leistungMonat.title')} subtitle={t('erfolge.leistungMonat.subtitle')}>
      {!lp ? (
        <Empty text={t('erfolge.leistungMonat.empty')} />
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-copper-soft text-copper ring-1 ring-copper/20">
              <Icon className="h-5 w-5">{ICON_PATHS.services}</Icon>
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-chrome-50">{lp.name}</p>
              <p className="text-sm text-chrome-400">
                {t('erfolge.leistungMonat.count', { count: lp.anzahl, sum: eur(lp.umsatz) })}
              </p>
            </div>
          </div>
          {data.topKategorieMonat && (
            <p className="mt-4 border-t border-ink-700/60 pt-3 text-xs text-chrome-500">
              {t('erfolge.leistungMonat.topCategory', {
                kategorie: t(`erfolge.art.${data.topKategorieMonat.kategorie}`),
              })}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Mitarbeiter-Bestenliste (nur Leitung)
// ---------------------------------------------------------------------------

const ZEITRAEUME: LeaderboardZeitraum[] = ['monat', 'jahr', 'all'];

function Bestenliste() {
  const t = useT();
  const [zeitraum, setZeitraum] = useState<LeaderboardZeitraum>('monat');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<LeaderboardResponse>(`/gamification/leaderboard?zeitraum=${zeitraum}`));
      setError('');
    } catch (e) {
      // 403 (Rolle) sollte hier nicht auftreten (Seite rendert nur fuer Leitung),
      // faellt aber defensiv in die Fehlermeldung.
      setError(e instanceof ApiError ? e.message : t('erfolge.error.load'));
    } finally {
      setLoading(false);
    }
  }, [zeitraum, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs = (
    <div className="flex gap-1 rounded-xl bg-ink-850 p-1">
      {ZEITRAEUME.map((z) => (
        <button
          key={z}
          type="button"
          onClick={() => setZeitraum(z)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            zeitraum === z ? 'bg-copper text-ink-950' : 'text-chrome-400 hover:text-chrome-100'
          }`}
        >
          {t(`erfolge.leaderboard.zeitraum.${z}`)}
        </button>
      ))}
    </div>
  );

  return (
    <SectionCard
      title={t('erfolge.leaderboard.title')}
      subtitle={t('erfolge.leaderboard.subtitle')}
      action={tabs}
    >
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full rounded-xl" style={{ opacity: 1 - i * 0.18 }} />
          ))}
        </div>
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data || data.eintraege.length === 0 ? (
        <Empty text={t('erfolge.leaderboard.empty')} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-14">{t('erfolge.leaderboard.rank')}</th>
                  <th>{t('erfolge.leaderboard.name')}</th>
                  <th className="text-right">{t('erfolge.leaderboard.count')}</th>
                  <th className="text-right">{t('erfolge.leaderboard.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {data.eintraege.map((e) => (
                  <tr key={e.userId}>
                    <td>
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                          e.rang === 1
                            ? 'bg-copper-soft text-copper ring-1 ring-copper/30'
                            : 'bg-ink-750 text-chrome-300'
                        }`}
                      >
                        {e.rang}
                      </span>
                    </td>
                    <td className="font-medium text-chrome-100">{e.name}</td>
                    <td className="text-right tabular-nums">{nf(e.anzahlAuftraege)}</td>
                    <td className="text-right tabular-nums text-chrome-300">{eur(e.umsatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.nichtZugeordnet.anzahlAuftraege > 0 && (
            <p className="mt-3 border-t border-ink-700/60 pt-3 text-xs text-chrome-500">
              <span className="font-medium text-chrome-400">{t('erfolge.leaderboard.unassigned')}:</span>{' '}
              {t('erfolge.leaderboard.unassignedHint', { count: data.nichtZugeordnet.anzahlAuftraege })}
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Detailly Wrapped
// ---------------------------------------------------------------------------

function buildWrappedView(
  d: WrappedResponse,
  t: (k: string, p?: Record<string, string | number>) => string,
  locale: string,
): WrappedView {
  const dash = '–';
  return {
    jahr: d.jahr,
    betriebsname: d.betriebsname,
    badge: t('erfolge.wrapped.badge'),
    tagline: t('erfolge.wrapped.tagline'),
    stats: [
      { label: t('erfolge.wrapped.orders'), value: nf(d.anzahlAuftraege) },
      { label: t('erfolge.wrapped.revenue'), value: eur(d.umsatz) },
      { label: t('erfolge.wrapped.topService'), value: d.topLeistung?.name ?? dash },
      {
        label: t('erfolge.wrapped.topCategory'),
        value: d.topKategorie ? t(`erfolge.art.${d.topKategorie}`) : dash,
      },
      {
        label: t('erfolge.wrapped.strongestMonth'),
        value: d.staerksterMonat
          ? `${monatKurz(d.staerksterMonat.monat, locale)} · ${eur(d.staerksterMonat.umsatz)}`
          : dash,
      },
      { label: t('erfolge.wrapped.newCustomers'), value: nf(d.neueKunden) },
    ],
  };
}

function WrappedSection() {
  const t = useT();
  const { lang } = useLanguage();
  const locale = LOCALE_BY_LANG[lang] ?? 'de-DE';
  const jahrJetzt = new Date().getFullYear();
  const jahre = [0, 1, 2, 3, 4].map((i) => jahrJetzt - i);
  const [jahr, setJahr] = useState(jahrJetzt);
  const [data, setData] = useState<WrappedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<WrappedResponse>(`/gamification/wrapped?jahr=${jahr}`));
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('erfolge.error.load'));
    } finally {
      setLoading(false);
    }
  }, [jahr, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = data ? buildWrappedView(data, t, locale) : null;

  const onDownload = async () => {
    if (!view) return;
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadWrappedPng(view, `detailly-wrapped-${view.jahr}.png`);
    } catch {
      // Fehler NUR am Button anzeigen – die Karte bleibt stehen und erneut teilbar.
      setDownloadError(t('erfolge.error.download'));
    } finally {
      setDownloading(false);
    }
  };

  const jahrWahl = (
    <select
      className="input h-9 w-auto py-0 text-sm"
      value={jahr}
      onChange={(e) => setJahr(Number(e.target.value))}
      aria-label={t('erfolge.wrapped.year')}
    >
      {jahre.map((j) => (
        <option key={j} value={j}>
          {j}
        </option>
      ))}
    </select>
  );

  return (
    <SectionCard title={t('erfolge.wrapped.title')} subtitle={t('erfolge.wrapped.subtitle')} action={jahrWahl}>
      {loading ? (
        <div className="mx-auto skeleton h-[520px] w-full max-w-[420px] rounded-3xl" />
      ) : error ? (
        <ErrorBox message={error} />
      ) : view ? (
        <div className="flex flex-col items-center gap-5">
          <WrappedCard view={view} />
          <div className="w-full max-w-[420px]">
            <button type="button" className="btn-primary w-full" onClick={onDownload} disabled={downloading}>
              {downloading ? (
                <span className="spinner" />
              ) : (
                <Icon className="h-4 w-4">{ICON_PATHS.arrow}</Icon>
              )}
              {downloading ? t('erfolge.wrapped.downloading') : t('erfolge.wrapped.download')}
            </button>
            {downloadError ? (
              <p role="alert" className="mt-2 text-center text-xs font-medium text-danger">
                {downloadError}
              </p>
            ) : (
              <p className="mt-2 text-center text-xs text-chrome-500">{t('erfolge.wrapped.downloadHint')}</p>
            )}
          </div>
        </div>
      ) : (
        <Empty text={t('erfolge.wrapped.empty')} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Lade-Skeleton (erfolge-förmig)
// ---------------------------------------------------------------------------

function ErfolgeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-2xl" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function ErfolgePage() {
  const t = useT();
  const { user } = useAuth();
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let aktiv = true;
    api
      .get<AchievementsResponse>('/gamification/achievements')
      .then((d) => aktiv && setData(d))
      .catch((e) => aktiv && setError(e instanceof Error ? e.message : t('erfolge.error.load')));
    return () => {
      aktiv = false;
    };
  }, [t]);

  const istLeitung = !!user && LEITUNG_ROLLEN.includes(user.role);

  return (
    <div>
      <PageHeader title={t('erfolge.title')} subtitle={t('erfolge.subtitle')} />

      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <ErfolgeSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Meilenstein-Badges */}
          <div>
            <div className="mb-3">
              <h2 className="font-display text-base font-semibold text-chrome-50">{t('erfolge.badges.title')}</h2>
              <p className="text-xs text-chrome-400">{t('erfolge.badges.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.tracks.map((track) => (
                <BadgeCard key={track.key} track={track} />
              ))}
            </div>
          </div>

          {/* Leistung des Monats */}
          <LeistungDesMonats data={data} />

          {/* Mitarbeiter-Bestenliste – nur für die Leitung sichtbar */}
          {istLeitung && <Bestenliste />}

          {/* Detailly Wrapped */}
          <WrappedSection />
        </div>
      )}
    </div>
  );
}
