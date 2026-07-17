'use client';

// Betreiber-Sicht "Sicherheit" (Sentinel Teil 2, Detailly-Plattform). NUR
// Plattform-Rollen – Backend @Roles-geschuetzt, die Nav blendet den Eintrag fuer
// Kunden aus. Analyst/Support duerfen LESEN; manuelles Sperren/Entsperren ist
// PLATFORM_ADMIN vorbehalten (Button/Endpoint). So geschnitten, dass ein spaeteres
// Betreiber-Cockpit dieselben Endpoints read-only einbetten kann.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import {
  PageHeader,
  SectionCard,
  StatCard,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Field,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';

interface Summary {
  failLogins24h: number;
  scan4xx24h: number;
  autoBlocks24h: number;
  activeBlocks: number;
  topIps: { ip: string; count: number }[];
}
interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  ip: string | null;
  emailHash: string | null;
  userId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
interface IpBlockRow {
  id: string;
  ip: string;
  reason: string;
  severity: string;
  createdBy: string;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

const EVENT_TYPES = ['login_fail', 'login_lockout', 'mfa_fail', 'scan_4xx', 'ip_block', 'ip_unblock'];
const SEVERITIES = ['info', 'warn', 'critical'];

const SEV_CLASS: Record<string, string> = {
  info: 'badge-neutral',
  warn: 'badge-caution',
  critical: 'badge-danger',
};

export default function PlattformSicherheitPage() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const darfSperren = user?.role === 'platform_admin';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [blocks, setBlocks] = useState<IpBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter (Ereignis-Tabelle)
  const [fType, setFType] = useState('');
  const [fSev, setFSev] = useState('');
  const [fIp, setFIp] = useState('');

  // Manuelles Sperren
  const [blockOpen, setBlockOpen] = useState(false);
  const [bIp, setBIp] = useState('');
  const [bReason, setBReason] = useState('');
  const [bDuration, setBDuration] = useState('');
  const [bSev, setBSev] = useState('warn');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [unblockRow, setUnblockRow] = useState<IpBlockRow | null>(null);

  const zeit = (v: string) =>
    new Date(v).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const loadEvents = useCallback(async () => {
    const qs = new URLSearchParams();
    if (fType) qs.set('type', fType);
    if (fSev) qs.set('severity', fSev);
    if (fIp.trim()) qs.set('ip', fIp.trim());
    qs.set('limit', '50');
    const res = await api.get<{ data: SecurityEvent[]; total: number }>(
      `/platform/security/events?${qs.toString()}`,
    );
    setEvents(res.data);
    setEventsTotal(res.total);
  }, [fType, fSev, fIp]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        api.get<Summary>('/platform/security/summary'),
        api.get<IpBlockRow[]>('/platform/security/blocks'),
      ]);
      setSummary(s);
      setBlocks(b);
      await loadEvents();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('platformSecurity.error.load'));
    } finally {
      setLoading(false);
    }
  }, [loadEvents, t]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter-Aenderung laedt nur die Ereignis-Tabelle neu (nicht die Kacheln).
  useEffect(() => {
    if (loading) return;
    void loadEvents().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fType, fSev, fIp]);

  async function submitBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!bIp.trim() || bReason.trim().length < 3) return;
    setBusy(true);
    setModalError('');
    try {
      const body: Record<string, unknown> = { ip: bIp.trim(), reason: bReason.trim(), severity: bSev };
      const mins = Number(bDuration);
      if (Number.isInteger(mins) && mins > 0) body.durationMinutes = mins;
      await api.post('/platform/security/blocks', body);
      setBlockOpen(false);
      setBIp('');
      setBReason('');
      setBDuration('');
      setBSev('warn');
      toast(t('platformSecurity.block.success'));
      await loadAll();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : t('platformSecurity.block.error'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnblock() {
    if (!unblockRow) return;
    setBusy(true);
    try {
      await api.delete(`/platform/security/blocks/${unblockRow.id}`);
      setUnblockRow(null);
      toast(t('platformSecurity.unblock.success'));
      await loadAll();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('platformSecurity.block.error'), { variant: 'copper' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageHeader title={t('platformSecurity.title')} subtitle={t('platformSecurity.subtitle')} />

      {/* Kacheln */}
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('platformSecurity.tile.failLogins')} value={summary.failLogins24h} icon={ICON_PATHS.shield} />
          <StatCard label={t('platformSecurity.tile.scans')} value={summary.scan4xx24h} />
          <StatCard label={t('platformSecurity.tile.autoBlocks')} value={summary.autoBlocks24h} />
          <StatCard label={t('platformSecurity.tile.activeBlocks')} value={summary.activeBlocks} accent />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Top-IPs */}
        <SectionCard title={t('platformSecurity.topIps.title')} subtitle={t('platformSecurity.topIps.subtitle')}>
          {!summary || summary.topIps.length === 0 ? (
            <Empty text={t('platformSecurity.topIps.empty')} />
          ) : (
            <ul className="space-y-2">
              {summary.topIps.map((r) => (
                <li key={r.ip} className="flex items-center justify-between gap-3 border-b border-ink-700/50 pb-2 text-sm last:border-0">
                  <span className="truncate font-mono text-chrome-200">{r.ip}</span>
                  <span className="shrink-0 tabular-nums text-chrome-400">{r.count.toLocaleString('de-DE')}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* Aktive Sperren */}
        <SectionCard
          title={t('platformSecurity.blocks.title')}
          subtitle={t('platformSecurity.blocks.subtitle')}
          action={
            darfSperren ? (
              <button className="btn-ghost btn-sm" onClick={() => setBlockOpen(true)}>
                <Icon className="h-4 w-4">{ICON_PATHS.plus}</Icon>
                {t('platformSecurity.blocks.add')}
              </button>
            ) : undefined
          }
        >
          {blocks.length === 0 ? (
            <Empty text={t('platformSecurity.blocks.empty')} />
          ) : (
            <ul className="divide-y divide-ink-700/50">
              {blocks.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm text-chrome-100">{b.ip}</span>
                      <Badge className={SEV_CLASS[b.severity] ?? 'badge-neutral'}>
                        {t(`platformSecurity.severity.${b.severity}`)}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-chrome-500">
                      {b.reason} ·{' '}
                      {b.expiresAt
                        ? `${t('platformSecurity.blocks.until')} ${zeit(b.expiresAt)}`
                        : t('platformSecurity.blocks.permanent')}{' '}
                      · {b.createdBy === 'system' ? t('platformSecurity.blocks.system') : t('platformSecurity.blocks.manual')}
                    </span>
                  </span>
                  {darfSperren && (
                    <button className="link-muted shrink-0 text-xs" onClick={() => setUnblockRow(b)}>
                      {t('platformSecurity.blocks.unblock')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Ereignis-Tabelle */}
      <SectionCard
        className="mt-5"
        title={t('platformSecurity.events.title')}
        subtitle={`${eventsTotal.toLocaleString('de-DE')} ${t('platformSecurity.events.count')}`}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <select className="input w-auto text-sm" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">{t('platformSecurity.events.filter.allTypes')}</option>
            {EVENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`platformSecurity.eventType.${ty}`)}
              </option>
            ))}
          </select>
          <select className="input w-auto text-sm" value={fSev} onChange={(e) => setFSev(e.target.value)}>
            <option value="">{t('platformSecurity.events.filter.allSeverities')}</option>
            {SEVERITIES.map((sv) => (
              <option key={sv} value={sv}>
                {t(`platformSecurity.severity.${sv}`)}
              </option>
            ))}
          </select>
          <input
            className="input w-auto text-sm"
            placeholder={t('platformSecurity.events.filter.ip')}
            value={fIp}
            onChange={(e) => setFIp(e.target.value)}
          />
        </div>

        {events.length === 0 ? (
          <Empty text={t('platformSecurity.events.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-chrome-500">
                  <th className="py-2 pr-3 font-medium">{t('platformSecurity.events.col.time')}</th>
                  <th className="py-2 pr-3 font-medium">{t('platformSecurity.events.col.type')}</th>
                  <th className="py-2 pr-3 font-medium">{t('platformSecurity.events.col.severity')}</th>
                  <th className="py-2 pr-3 font-medium">{t('platformSecurity.events.col.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-ink-800/60">
                    <td className="whitespace-nowrap py-2 pr-3 text-chrome-400">{zeit(ev.createdAt)}</td>
                    <td className="py-2 pr-3 text-chrome-100">{t(`platformSecurity.eventType.${ev.type}`)}</td>
                    <td className="py-2 pr-3">
                      <Badge className={SEV_CLASS[ev.severity] ?? 'badge-neutral'}>
                        {t(`platformSecurity.severity.${ev.severity}`)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-chrome-300">{ev.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {!darfSperren && (
        <p className="mt-4 text-xs text-chrome-500">{t('platformSecurity.readonly')}</p>
      )}

      {/* Manuelles Sperren (nur PLATFORM_ADMIN) */}
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title={t('platformSecurity.block.modalTitle')} size="sm">
        <form onSubmit={submitBlock} className="space-y-4">
          <Field label={t('platformSecurity.block.ip')} htmlFor="b-ip" required>
            <input id="b-ip" className="input" value={bIp} onChange={(e) => setBIp(e.target.value)} placeholder="203.0.113.10" required />
          </Field>
          <Field label={t('platformSecurity.block.reason')} htmlFor="b-reason" required>
            <input id="b-reason" className="input" value={bReason} onChange={(e) => setBReason(e.target.value)} maxLength={200} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('platformSecurity.block.duration')} htmlFor="b-dur" help={t('platformSecurity.block.durationHint')}>
              <input id="b-dur" type="number" min={1} className="input" value={bDuration} onChange={(e) => setBDuration(e.target.value)} placeholder="—" />
            </Field>
            <Field label={t('platformSecurity.block.severity')} htmlFor="b-sev">
              <select id="b-sev" className="input" value={bSev} onChange={(e) => setBSev(e.target.value)}>
                {SEVERITIES.map((sv) => (
                  <option key={sv} value={sv}>
                    {t(`platformSecurity.severity.${sv}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {modalError && <ErrorBox message={modalError} />}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setBlockOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-danger" disabled={busy || !bIp.trim() || bReason.trim().length < 3}>
              {busy && <span className="spinner" />}
              {t('platformSecurity.block.submit')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!unblockRow}
        title={t('platformSecurity.blocks.unblockConfirmTitle')}
        message={t('platformSecurity.blocks.unblockConfirmMsg').replace('{ip}', unblockRow?.ip ?? '')}
        confirmLabel={t('platformSecurity.blocks.unblock')}
        variant="neutral"
        busy={busy}
        onConfirm={confirmUnblock}
        onCancel={() => setUnblockRow(null)}
      />
    </div>
  );
}
