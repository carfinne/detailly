'use client';

// Hilfe & Support: durchsuchbare Wissensdatenbank (Q&A ueber ALLE Funktionen,
// Daten in lib/hilfe-daten.ts) + Support-Anfragen an Detailly (Ticket mit
// Nachrichten-Verlauf). Findet die Suche nichts, oeffnet ein Klick das Ticket
// mit der Suchfrage vorbelegt. Fuer jede Rolle sichtbar.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { TICKET_STATUS_LABEL, TICKET_STATUS_COLOR, TICKET_KATEGORIE_LABEL } from '@/lib/labels';
import { HILFE_QA } from '@/lib/hilfe-daten';
import type { SupportTicket } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

/** Themen in Anzeige-Reihenfolge (aus den Q&A-Daten abgeleitet, stabil). */
const THEMEN = Array.from(new Set(HILFE_QA.map((q) => q.thema)));

const KATEGORIEN = ['frage', 'problem', 'idee', 'abrechnung'];

const zeit = (v: string) =>
  new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function HilfePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Q&A-Suche
  const [qaSuche, setQaSuche] = useState('');
  const [thema, setThema] = useState('');

  // Neue Anfrage
  const [neuOpen, setNeuOpen] = useState(false);
  const [betreff, setBetreff] = useState('');
  const [kategorie, setKategorie] = useState('frage');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // Gefilterte Q&A: Suchbegriff matcht Frage, Antwort, Thema und Stichworte.
  const qaTreffer = useMemo(() => {
    const term = qaSuche.trim().toLowerCase();
    return HILFE_QA.filter(
      (q) =>
        (!thema || q.thema === thema) &&
        (!term ||
          q.frage.toLowerCase().includes(term) ||
          q.antwort.toLowerCase().includes(term) ||
          q.thema.toLowerCase().includes(term) ||
          (q.stichworte ?? []).some((s) => s.includes(term))),
    );
  }, [qaSuche, thema]);

  // Treffer nach Thema gruppieren (Reihenfolge wie THEMEN).
  const qaGruppen = useMemo(
    () =>
      THEMEN.map((t) => ({ thema: t, eintraege: qaTreffer.filter((q) => q.thema === t) })).filter(
        (g) => g.eintraege.length > 0,
      ),
    [qaTreffer],
  );

  /** Ticket-Dialog oeffnen – optional mit der (erfolglosen) Suchfrage vorbelegt. */
  function supportKontaktieren(vorschlag?: string) {
    if (vorschlag?.trim()) setBetreff(vorschlag.trim().slice(0, 150));
    setNeuOpen(true);
  }

  // Verlauf
  const [aktiv, setAktiv] = useState<SupportTicket | null>(null);
  const [antwort, setAntwort] = useState('');
  const [antwortSaving, setAntwortSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await api.get<SupportTicket[]>('/support/tickets'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anfragen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function erstellen(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/support/tickets', { betreff: betreff.trim(), kategorie, text: text.trim() });
      setNeuOpen(false);
      setBetreff('');
      setKategorie('frage');
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anfrage konnte nicht gesendet werden');
    } finally {
      setSaving(false);
    }
  }

  async function oeffneVerlauf(id: string) {
    try {
      setAktiv(await api.get<SupportTicket>(`/support/tickets/${id}`));
      setAntwort('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verlauf konnte nicht geladen werden');
    }
  }

  async function antworten(e: React.FormEvent) {
    e.preventDefault();
    if (!aktiv || !antwort.trim()) return;
    setAntwortSaving(true);
    try {
      const res = await api.post<SupportTicket>(`/support/tickets/${aktiv.id}/messages`, { text: antwort.trim() });
      setAktiv(res);
      setAntwort('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Antwort konnte nicht gesendet werden');
    } finally {
      setAntwortSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Hilfe & Support"
        subtitle="Antworten auf häufige Fragen – oder frag direkt das Detailly-Team."
        action={<button className="btn-primary" onClick={() => setNeuOpen(true)}>Support kontaktieren</button>}
      />
      {error && <ErrorBox message={error} />}

      {/* Q&A-Suche: grosses Feld + Themen-Chips – Antworten auf alles. */}
      <div className="mb-4">
        <div className="relative max-w-lg">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="input pl-10"
            placeholder={'Frag mich was… z. B. Mahnung, Tracking-Link, DATEV'}
            value={qaSuche}
            onChange={(e) => setQaSuche(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setThema('')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              thema === ''
                ? 'border-copper/60 bg-copper-soft text-copper'
                : 'border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50'
            }`}
          >
            Alle Themen
          </button>
          {THEMEN.map((t) => (
            <button
              key={t}
              onClick={() => setThema(thema === t ? '' : t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                thema === t
                  ? 'border-copper/60 bg-copper-soft text-copper'
                  : 'border-ink-700 bg-ink-850 text-chrome-300 hover:text-chrome-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Q&A – Antworten auf alles */}
        <SectionCard
          title="Fragen & Antworten"
          subtitle={`${qaTreffer.length} von ${HILFE_QA.length} Antworten`}
          className="lg:col-span-2"
        >
          {qaGruppen.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-chrome-400">
                Dazu haben wir noch keine Antwort – aber das Detailly-Team hilft dir direkt.
              </p>
              <button className="btn-primary btn-sm mt-3" onClick={() => supportKontaktieren(qaSuche)}>
                {qaSuche.trim() ? `Support fragen: „${qaSuche.trim().slice(0, 40)}"` : 'Support fragen'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {qaGruppen.map((g) => (
                <div key={g.thema}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-chrome-600">{g.thema}</p>
                  <div className="divide-y divide-ink-700/50">
                    {g.eintraege.map((f) => (
                      <details key={f.frage} className="group py-2.5" open={qaSuche.trim().length > 1 && qaTreffer.length <= 3}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-chrome-100 hover:text-copper">
                          {f.frage}
                          <svg viewBox="0 0 24 24" className="faq-chev h-4 w-4 shrink-0 text-chrome-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </summary>
                        <p className="pb-1.5 pt-2 text-sm leading-relaxed text-chrome-300">{f.antwort}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Eigene Anfragen */}
        <SectionCard title="Meine Anfragen" subtitle="Dein Draht zum Detailly-Team">
          {loading ? (
            <Loading />
          ) : tickets.length === 0 ? (
            <Empty
              text="Noch keine Anfragen. Wir helfen gern – meld dich einfach."
              action={<button className="btn-ghost btn-sm" onClick={() => setNeuOpen(true)}>Anfrage stellen</button>}
            />
          ) : (
            <ul className="divide-y divide-ink-700/50">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => oeffneVerlauf(t.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink-750"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-chrome-100">{t.betreff}</span>
                      <span className="block text-xs text-chrome-500">
                        {TICKET_KATEGORIE_LABEL[t.kategorie] ?? t.kategorie} · {zeit(t.updatedAt)}
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
        </SectionCard>
      </div>

      {/* Neue Anfrage */}
      <Modal open={neuOpen} onClose={() => setNeuOpen(false)} title="Support kontaktieren">
        <form onSubmit={erstellen} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 field">
              <label className="label">Betreff</label>
              <input className="input" value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={150} required />
            </div>
            <div className="field">
              <label className="label">Kategorie</label>
              <select className="select" value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
                {KATEGORIEN.map((k) => (
                  <option key={k} value={k}>{TICKET_KATEGORIE_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="label">Deine Nachricht</label>
            <textarea className="input min-h-[120px] resize-y" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder="Beschreib kurz, worum es geht…" required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setNeuOpen(false)}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Sendet…' : 'Anfrage senden'}</button>
          </div>
        </form>
      </Modal>

      {/* Verlauf */}
      <Modal open={!!aktiv} onClose={() => setAktiv(null)} title={aktiv?.betreff ?? ''}>
        {aktiv && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={TICKET_STATUS_COLOR[aktiv.status] ?? 'badge-neutral'}>
                {TICKET_STATUS_LABEL[aktiv.status] ?? aktiv.status}
              </Badge>
              <span className="text-xs text-chrome-500">{TICKET_KATEGORIE_LABEL[aktiv.kategorie] ?? aktiv.kategorie}</span>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {(aktiv.messages ?? []).map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border px-3.5 py-2.5 ${
                    m.autorTyp === 'detailly'
                      ? 'border-copper/30 bg-copper-soft'
                      : 'border-ink-700 bg-ink-850'
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

            <form onSubmit={antworten} className="flex items-end gap-2">
              <textarea
                className="input min-h-[64px] flex-1 resize-y"
                value={antwort}
                onChange={(e) => setAntwort(e.target.value)}
                maxLength={5000}
                placeholder="Antwort schreiben…"
              />
              <button type="submit" className="btn-primary" disabled={antwortSaving || !antwort.trim()}>
                {antwortSaving ? '…' : 'Senden'}
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
