'use client';

// Cockpit-Tab „Betriebe": paginierte, entprellte Betriebs-Suche (/platform/
// tenants) + Detail-Panel (/platform/tenants/:id). Read-only – KEINE Verwaltungs-
// aktionen (Abo-Verwaltung bleibt auf /abos). Zusaetzlich (nur Plattform-Admin)
// eine betriebsuebergreifende Nutzer-Suche per E-Mail (/platform/users).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { datum, datumZeit, eur, zahl } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { ROLE_KEY, SUBSCRIPTION_STATUS_KEY, SUBSCRIPTION_STATUS_COLOR } from '@/lib/labels';
import { Loading, ErrorBox, Empty, Badge, Modal, Row } from '@/components/ui';
import { Pager } from '@/components/Pager';
import {
  BETRIEBSTYP_KEY,
  TENANT_STATUS_KEY,
  TENANT_STATUS_COLOR,
  type TenantListItem,
  type TenantListResult,
  type TenantDetail,
  type TenantStatusWert,
  type UserLookupItem,
} from './types';

const SEITENGROESSE = 25;

const STATUS_TABS: { key: 'alle' | TenantStatusWert; labelKey: string }[] = [
  { key: 'alle', labelKey: 'cockpit.tenants.filter.alle' },
  { key: 'active', labelKey: 'cockpit.tenantStatus.active' },
  { key: 'trial', labelKey: 'cockpit.tenantStatus.trial' },
  { key: 'inactive', labelKey: 'cockpit.tenantStatus.inactive' },
];

export function CockpitBetriebe({ istAdmin }: { istAdmin: boolean }) {
  const t = useT();
  const [rows, setRows] = useState<TenantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'alle' | TenantStatusWert>('alle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Monoton steigende Request-ID: bei entprellter Suche darf nur die juengste
  // Antwort den State setzen (Request-Reordering-Guard, Muster aus auftraege).
  const reqId = useRef(0);

  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(SEITENGROESSE),
        offset: String((page - 1) * SEITENGROESSE),
      });
      if (search.trim()) params.set('q', search.trim());
      if (status !== 'alle') params.set('status', status);
      const res = await api.get<TenantListResult>(`/platform/tenants?${params.toString()}`);
      if (id !== reqId.current) return;
      setRows(res.data);
      setTotal(res.total);
      setError('');
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, search, status, t]);

  // Entprellt (250ms) gegen schnelles Tippen.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const filterAktiv = search.trim() !== '' || status !== 'alle';

  return (
    <div className="space-y-5">
      {istAdmin && <NutzerLookup onOpenBetrieb={(bid) => setDetailId(bid)} />}

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder={t('cockpit.tenants.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="seg-group">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`seg ${status === tab.key ? 'seg-active' : ''}`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text={filterAktiv ? t('cockpit.tenants.emptyFiltered') : t('cockpit.tenants.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('cockpit.tenants.col.name')}</th>
                  <th>{t('cockpit.tenants.col.typ')}</th>
                  <th>{t('cockpit.tenants.col.status')}</th>
                  <th className="text-right">{t('cockpit.tenants.col.nutzer')}</th>
                  <th>{t('cockpit.tenants.col.abo')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setDetailId(b.id)}
                    className="cursor-pointer transition-colors hover:bg-ink-750"
                  >
                    <td>
                      <span className="block font-medium text-chrome-100">{b.name}</span>
                      <span className="block truncate text-xs text-chrome-500">
                        {b.ort ? `${b.ort} · ` : ''}
                        {b.slug}
                      </span>
                    </td>
                    <td className="text-chrome-300">
                      {BETRIEBSTYP_KEY[b.betriebstyp] ? t(BETRIEBSTYP_KEY[b.betriebstyp]) : b.betriebstyp}
                    </td>
                    <td>
                      <Badge className={TENANT_STATUS_COLOR[b.status] ?? 'badge-neutral'}>
                        {TENANT_STATUS_KEY[b.status] ? t(TENANT_STATUS_KEY[b.status]) : b.status}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums text-chrome-200">{zahl(b.nutzerAnzahl)}</td>
                    <td>
                      {b.abo ? (
                        <span className="flex items-center gap-2">
                          <Badge className={SUBSCRIPTION_STATUS_COLOR[b.abo.status] ?? 'badge-neutral'}>
                            {SUBSCRIPTION_STATUS_KEY[b.abo.status]
                              ? t(SUBSCRIPTION_STATUS_KEY[b.abo.status])
                              : b.abo.status}
                          </Badge>
                          {b.abo.tarif && <span className="text-xs text-chrome-400">{b.abo.tarif}</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-chrome-600">{t('cockpit.detail.noAbo')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />

      <BetriebDetail id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

// --- Betriebs-Detail-Panel (Modal) ------------------------------------------

function BetriebDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useT();
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setError('');
      return;
    }
    let aktiv = true;
    setLoading(true);
    setDetail(null);
    setError('');
    api
      .get<TenantDetail>(`/platform/tenants/${id}`)
      .then((d) => {
        if (aktiv) setDetail(d);
      })
      .catch((e) => {
        if (aktiv) setError(e instanceof Error ? e.message : t('cockpit.detail.loadError'));
      })
      .finally(() => {
        if (aktiv) setLoading(false);
      });
    return () => {
      aktiv = false;
    };
  }, [id, t]);

  const titel = detail?.profil.name ?? t('cockpit.detail.title');
  const anschrift = detail
    ? [detail.profil.street, [detail.profil.postalCode, detail.profil.city].filter(Boolean).join(' '), detail.profil.country]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Modal open={!!id} onClose={onClose} title={titel} size="lg">
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : detail ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={TENANT_STATUS_COLOR[detail.profil.status] ?? 'badge-neutral'}>
              {TENANT_STATUS_KEY[detail.profil.status]
                ? t(TENANT_STATUS_KEY[detail.profil.status])
                : detail.profil.status}
            </Badge>
            <span className="text-xs text-chrome-500">
              {BETRIEBSTYP_KEY[detail.profil.betriebstyp]
                ? t(BETRIEBSTYP_KEY[detail.profil.betriebstyp])
                : detail.profil.betriebstyp}
            </span>
          </div>

          {/* Profil */}
          <section>
            <h3 className="mb-1 font-display text-sm font-semibold text-chrome-200">{t('cockpit.detail.profil')}</h3>
            <div>
              <Row label={t('cockpit.detail.slug')} value={detail.profil.slug} />
              {anschrift && <Row label={t('cockpit.detail.address')} value={anschrift} />}
              <Row label={t('cockpit.detail.created')} value={datum(detail.profil.createdAt)} />
            </div>
          </section>

          {/* Nutzung */}
          <section>
            <h3 className="mb-1 font-display text-sm font-semibold text-chrome-200">{t('cockpit.detail.nutzung')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <KennzahlKachel label={t('cockpit.detail.auftraege')} wert={detail.nutzung.auftraege} />
              <KennzahlKachel label={t('cockpit.detail.belege')} wert={detail.nutzung.belege} />
            </div>
          </section>

          {/* Abo (nur Anzeige – Verwaltung auf /abos) */}
          <section>
            <div className="mb-1 flex items-center justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-chrome-200">{t('cockpit.detail.abo')}</h3>
              <Link href="/abos" className="link-action text-xs">
                {t('cockpit.detail.toAbos')}
              </Link>
            </div>
            {detail.abo ? (
              <div>
                <Row
                  label={t('cockpit.tenants.col.status')}
                  value={
                    <Badge className={SUBSCRIPTION_STATUS_COLOR[detail.abo.status] ?? 'badge-neutral'}>
                      {SUBSCRIPTION_STATUS_KEY[detail.abo.status]
                        ? t(SUBSCRIPTION_STATUS_KEY[detail.abo.status])
                        : detail.abo.status}
                    </Badge>
                  }
                />
                {detail.abo.tarif && <Row label={t('cockpit.detail.tarif')} value={detail.abo.tarif} />}
                {detail.abo.preisMonatlich != null && (
                  <Row label={t('cockpit.detail.price')} value={eur(detail.abo.preisMonatlich)} />
                )}
                {detail.abo.trialEndsAt && (
                  <Row label={t('cockpit.detail.trialEnds')} value={datum(detail.abo.trialEndsAt)} />
                )}
                {detail.abo.currentPeriodEnd && (
                  <Row label={t('cockpit.detail.periodEnd')} value={datum(detail.abo.currentPeriodEnd)} />
                )}
                {detail.abo.cancelAtPeriodEnd && (
                  <Row label={t('cockpit.detail.cancelAtPeriodEnd')} value={t('cockpit.common.yes')} />
                )}
                {detail.abo.canceledAt && (
                  <Row label={t('cockpit.detail.canceled')} value={datum(detail.abo.canceledAt)} />
                )}
                {detail.abo.notiz && <Row label={t('cockpit.detail.note')} value={detail.abo.notiz} />}
              </div>
            ) : (
              <p className="text-sm text-chrome-500">{t('cockpit.detail.noAbo')}</p>
            )}
            <p className="mt-2 text-xs text-chrome-600">{t('cockpit.detail.readonlyHint')}</p>
          </section>

          {/* Nutzer */}
          <section>
            <h3 className="mb-1 font-display text-sm font-semibold text-chrome-200">
              {t('cockpit.detail.nutzer')} <span className="text-chrome-500">({zahl(detail.nutzer.length)})</span>
            </h3>
            {detail.nutzer.length === 0 ? (
              <p className="text-sm text-chrome-500">{t('cockpit.detail.noUsers')}</p>
            ) : (
              <ul className="divide-y divide-ink-700/50">
                {detail.nutzer.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-chrome-100">
                        {u.name || u.email}
                        {!u.aktiv && <span className="ml-2 text-xs text-chrome-600">({t('cockpit.detail.inactive')})</span>}
                      </span>
                      <span className="block truncate text-xs text-chrome-500">{u.email}</span>
                    </span>
                    <span className="shrink-0 text-xs text-chrome-400">
                      {ROLE_KEY[u.rolle] ? t(ROLE_KEY[u.rolle]) : u.rolle}
                    </span>
                    <span className="hidden shrink-0 text-xs text-chrome-600 sm:inline">
                      {u.letzterLogin ? datumZeit(u.letzterLogin) : '–'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

function KennzahlKachel({ label, wert }: { label: string; wert: number }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-chrome-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-chrome-50">{zahl(wert)}</p>
    </div>
  );
}

// --- Nutzer-Lookup (nur Plattform-Admin) ------------------------------------

function NutzerLookup({ onOpenBetrieb }: { onOpenBetrieb: (betriebId: string) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [treffer, setTreffer] = useState<UserLookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const term = q.trim();

  useEffect(() => {
    // Backend sucht erst ab 3 Zeichen; darunter Ergebnis leeren, kein Request.
    if (term.length < 3) {
      setTreffer([]);
      setError('');
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get<{ data: UserLookupItem[] }>(`/platform/users?q=${encodeURIComponent(term)}`)
        .then((r) => {
          if (id !== reqId.current) return;
          setTreffer(r.data);
          setError('');
        })
        .catch((e) => {
          if (id === reqId.current) setError(e instanceof Error ? e.message : t('cockpit.error.load'));
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, t]);

  return (
    <section className="card-flush p-4">
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold text-chrome-50">{t('cockpit.lookup.title')}</h3>
        <p className="mt-0.5 text-xs text-chrome-400">{t('cockpit.lookup.subtitle')}</p>
      </div>
      <input
        className="input max-w-md"
        placeholder={t('cockpit.lookup.placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        inputMode="email"
        autoComplete="off"
      />
      {error && <ErrorBox className="mt-3" message={error} />}
      {term.length > 0 && term.length < 3 ? (
        <p className="mt-2 text-xs text-chrome-500">{t('cockpit.lookup.hint')}</p>
      ) : loading ? (
        <div className="mt-3">
          <Loading />
        </div>
      ) : term.length >= 3 && treffer.length === 0 ? (
        <p className="mt-3 text-sm text-chrome-500">{t('cockpit.lookup.empty')}</p>
      ) : treffer.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink-700/50">
          {treffer.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-chrome-100">{u.email}</span>
                <span className="block truncate text-xs text-chrome-500">
                  {u.name || '–'} · {ROLE_KEY[u.rolle] ? t(ROLE_KEY[u.rolle]) : u.rolle}
                </span>
              </span>
              {u.betrieb ? (
                <button
                  type="button"
                  onClick={() => onOpenBetrieb(u.betrieb!.id)}
                  className="link-action shrink-0 text-xs"
                >
                  {u.betrieb.name}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-chrome-600">{t('cockpit.lookup.noBetrieb')}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
