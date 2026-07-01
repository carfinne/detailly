'use client';

// Hilfe & Support: FAQ zur Selbsthilfe + Support-Anfragen an Detailly
// (Ticket mit Nachrichten-Verlauf). Fuer jede Rolle sichtbar.

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TICKET_STATUS_LABEL, TICKET_STATUS_COLOR, TICKET_KATEGORIE_LABEL } from '@/lib/labels';
import type { SupportTicket } from '@/lib/types';
import { PageHeader, SectionCard, Loading, ErrorBox, Empty, Badge, Modal } from '@/components/ui';

const FAQ: { frage: string; antwort: string }[] = [
  {
    frage: 'Wie lege ich einen Auftrag an?',
    antwort:
      'Unter „Aufträge" → „Neuer Auftrag": Kunde und (optional) Fahrzeug wählen, Positionen erfassen – Preise kannst du aus deinen Leistungen übernehmen. Netto/MwSt/Brutto rechnet Detailly automatisch.',
  },
  {
    frage: 'Wie wird aus einem Auftrag eine Rechnung?',
    antwort:
      'Im Auftrag rechts unter „Belege" auf „Rechnung erstellen". Die Rechnung startet als Entwurf; beim Festsetzen (Entwurf → Offen) vergibt Detailly die fortlaufende Rechnungsnummer (GoBD-konform, lückenlos).',
  },
  {
    frage: 'Was ist der Kunden-Tracking-Link?',
    antwort:
      'Im Auftrag unter „Kunden-Tracking" erzeugst du einen geheimen Link. Dein Kunde sieht darüber ohne Login den Status seines Fahrzeugs (angenommen → in Arbeit → fertig). Genauso gibt es bei offenen/bezahlten Rechnungen einen Download-Link fürs PDF.',
  },
  {
    frage: 'Wie funktioniert die Zeiterfassung?',
    antwort:
      'Unter „Zeiterfassung" stempeln Mitarbeiter Kommen/Gehen. Zusätzlich kann jeder im Auftrag unter „Arbeitszeit" Stunden auf den Auftrag buchen – daraus berechnet Detailly (nur für die Leitung sichtbar) Lohnkosten und Marge.',
  },
  {
    frage: 'Wie pflege ich Material und Lagerbestand?',
    antwort:
      'Unter „Shop & Lager" legst du Produkte mit Bestand und Mindestbestand an. Verbrauchst du Material im Auftrag (Karte „Material"), sinkt der Bestand automatisch. Wird es knapp, warnt dich das Dashboard und die Glocke oben.',
  },
  {
    frage: 'Welche Rollen gibt es für mein Team?',
    antwort:
      'Inhaber (Admin, alle Rechte), Manager (Betriebsleitung inkl. Auswertungen), Techniker (Werkstatt) und Rezeption (Annahme). Rollen und Stundenlöhne verwaltest du unter „Mitarbeiter".',
  },
  {
    frage: 'Wo sehe ich, ob sich ein Auftrag gelohnt hat?',
    antwort:
      'Auf der Auftragsseite zeigt die Karte „Wirtschaftlichkeit" (nur Leitung): Auftragswert minus Lohn- und Materialkosten = Marge. Übergreifende Zahlen findest du unter „Auswertungen".',
  },
  {
    frage: 'Wie exportiere ich Daten für den Steuerberater?',
    antwort:
      'Unter „Buchhaltung" exportierst du Rechnungen als universelles CSV oder DATEV-Buchungsstapel. Die Arbeitszeiten gibt es in der Zeiterfassung als Lohn-Export (CSV).',
  },
  {
    frage: 'Kann ich das Design umstellen?',
    antwort:
      'Ja – unter „Einstellungen" → „Darstellung" wechselst du zwischen Dunkel und Hell und kannst Animationen reduzieren. Die Einstellung gilt pro Gerät.',
  },
];

const KATEGORIEN = ['frage', 'problem', 'idee', 'abrechnung'];

const zeit = (v: string) =>
  new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function HilfePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Neue Anfrage
  const [neuOpen, setNeuOpen] = useState(false);
  const [betreff, setBetreff] = useState('');
  const [kategorie, setKategorie] = useState('frage');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* FAQ */}
        <SectionCard title="Häufige Fragen" subtitle="Kurz erklärt">
          <div className="divide-y divide-ink-700/50">
            {FAQ.map((f) => (
              <details key={f.frage} className="group py-2.5">
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
              <select className="input" value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
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
