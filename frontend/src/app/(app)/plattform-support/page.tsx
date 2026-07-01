'use client';

// Plattform-Support (Detailly-Team): alle Kunden-Anfragen betriebsuebergreifend
// beantworten. Backend ist auf Plattform-Rollen begrenzt; Analyst ist read-only
// (Antwort-Endpoint lehnt ab) – die UI blendet das Antwortfeld entsprechend aus.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TICKET_STATUS_LABEL, TICKET_STATUS_COLOR, TICKET_KATEGORIE_LABEL } from '@/lib/labels';
import type { SupportTicket } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

const DARF_ANTWORTEN = ['platform_admin', 'platform_support'];
type Tab = 'offen' | 'beantwortet' | 'geschlossen' | 'alle';

const zeit = (v: string) =>
  new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function PlattformSupportPage() {
  const { user } = useAuth();
  const darfAntworten = !!user && DARF_ANTWORTEN.includes(user.role);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [tab, setTab] = useState<Tab>('offen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [aktiv, setAktiv] = useState<SupportTicket | null>(null);
  const [antwort, setAntwort] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tab === 'alle' ? '' : `?status=${tab}`;
      setTickets(await api.get<SupportTicket[]>(`/platform/support/tickets${qs}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anfragen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function oeffne(id: string) {
    try {
      setAktiv(await api.get<SupportTicket>(`/platform/support/tickets/${id}`));
      setAntwort('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verlauf konnte nicht geladen werden');
    }
  }

  async function antworten(e: React.FormEvent) {
    e.preventDefault();
    if (!aktiv || !antwort.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<SupportTicket>(`/platform/support/tickets/${aktiv.id}/antwort`, { text: antwort.trim() });
      setAktiv(res);
      setAntwort('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Antwort fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function schliessen() {
    if (!aktiv) return;
    setBusy(true);
    try {
      await api.patch(`/platform/support/tickets/${aktiv.id}/status`, { status: 'geschlossen' });
      setAktiv(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schließen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'offen', label: 'Offen' },
    { key: 'beantwortet', label: 'Beantwortet' },
    { key: 'geschlossen', label: 'Geschlossen' },
    { key: 'alle', label: 'Alle' },
  ];

  return (
    <div>
      <PageHeader title="Support-Anfragen" subtitle="Anfragen aller Betriebe – beantworten und schließen." />
      {error && <ErrorBox message={error} />}

      <div className="mb-4 flex rounded-xl border border-ink-700 bg-ink-850 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : tickets.length === 0 ? (
          <Empty text="Keine Anfragen in dieser Ansicht. 🎉" />
        ) : (
          <ul className="divide-y divide-ink-700/50">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => oeffne(t.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-ink-750"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-chrome-100">{t.betreff}</span>
                    <span className="block truncate text-xs text-chrome-500">
                      {t.betriebName} · {TICKET_KATEGORIE_LABEL[t.kategorie] ?? t.kategorie} · {zeit(t.updatedAt)}
                    </span>
                  </span>
                  <Badge className={TICKET_STATUS_COLOR[t.status] ?? 'badge-neutral'}>
                    {TICKET_STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={!!aktiv} onClose={() => setAktiv(null)} title={aktiv?.betreff ?? ''}>
        {aktiv && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={TICKET_STATUS_COLOR[aktiv.status] ?? 'badge-neutral'}>
                {TICKET_STATUS_LABEL[aktiv.status] ?? aktiv.status}
              </Badge>
              <span className="text-xs text-chrome-500">
                {aktiv.betriebName} · {TICKET_KATEGORIE_LABEL[aktiv.kategorie] ?? aktiv.kategorie}
              </span>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {(aktiv.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border px-3.5 py-2.5 ${
                    m.autorTyp === 'detailly' ? 'border-copper/30 bg-copper-soft' : 'border-ink-700 bg-ink-850'
                  }`}
                >
                  <p className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className={m.autorTyp === 'detailly' ? 'font-semibold text-copper' : 'font-semibold text-chrome-300'}>
                      {m.autorName}
                    </span>
                    <span className="shrink-0 text-chrome-500">{zeit(m.createdAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-chrome-100">{m.text}</p>
                </div>
              ))}
            </div>

            {darfAntworten ? (
              <form onSubmit={antworten} className="space-y-2">
                <textarea
                  className="input min-h-[80px] w-full resize-y"
                  value={antwort}
                  onChange={(e) => setAntwort(e.target.value)}
                  maxLength={5000}
                  placeholder="Als Detailly antworten…"
                />
                <div className="flex items-center justify-between gap-2">
                  {aktiv.status !== 'geschlossen' ? (
                    <button type="button" className="link-muted text-sm" onClick={schliessen} disabled={busy}>
                      Als geschlossen markieren
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="submit" className="btn-primary" disabled={busy || !antwort.trim()}>
                    {busy ? 'Sendet…' : 'Antwort senden'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-chrome-500">Nur-Lesen (Analyst): Antworten ist Platform-Admin/-Support vorbehalten.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
