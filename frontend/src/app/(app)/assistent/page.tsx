'use client';

// Support-Assistent: schlanke Chat-Oberflaeche fuer den internen Detailly-
// Hilfe-Assistenten. Der Client haelt eine kurze History und schickt sie mit
// (Kontext ueber mehrere Turns). Waehrend der Antwort laeuft die bestehende
// Lade-Animation (spinner); Fehler erscheinen ueber <ErrorBox>. Der Assistent
// beantwortet ausschliesslich Fragen zur Bedienung von Detailly – das Scoping
// passiert serverseitig im System-Prompt, der Client sendet nie einen solchen.

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, SectionCard, ErrorBox } from '@/components/ui';
import { Icon, ICON_PATHS } from '@/lib/icons';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** Nur die letzten Turns als Kontext senden (das Backend begrenzt zusaetzlich). */
const HISTORY_LIMIT = 8;

const BEGRUESSUNG: ChatTurn = {
  role: 'assistant',
  content:
    'Hallo! Ich bin dein Detailly-Assistent. Frag mich alles zur Bedienung – z. B. wie du einen Auftrag anlegst, eine Rechnung schreibst oder die 3D-Schadenserfassung nutzt.',
};

const BEISPIELE = [
  'Wie lege ich einen neuen Auftrag an?',
  'Wie schreibe ich eine Rechnung?',
  'Wie funktioniert die 3D-Schadenserfassung?',
  'Wie mahne ich eine überfällige Rechnung an?',
];

/** Eine Nachrichten-Blase (Nutzer rechts/kupfern, Assistent links/neutral). */
function Blase({ turn }: { turn: ChatTurn }) {
  const istNutzer = turn.role === 'user';
  return (
    <div className={`flex ${istNutzer ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={
          istNutzer
            ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-copper px-4 py-2.5 text-sm text-ink-950'
            : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-ink-700 bg-ink-850 px-4 py-2.5 text-sm text-chrome-100'
        }
      >
        {turn.content}
      </div>
    </div>
  );
}

/** „Tippt…"-Blase mit dem bestehenden Kupfer-Spinner waehrend der Antwort. */
function TippBlase() {
  return (
    <div className="flex justify-start animate-fade-in" role="status" aria-busy="true">
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border border-ink-700 bg-ink-850 px-4 py-2.5">
        <span className="spinner h-4 w-4 text-copper" aria-hidden="true" />
        <span className="text-sm text-chrome-400">Assistent schreibt…</span>
      </div>
    </div>
  );
}

export default function AssistentPage() {
  const [messages, setMessages] = useState<ChatTurn[]>([BEGRUESSUNG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Bei neuen Nachrichten / Ladezustand sanft ans Ende scrollen.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function absenden(frageRoh: string) {
    const frage = frageRoh.trim();
    if (!frage || loading) return;

    // History = bisheriger Verlauf ohne die statische Begruessung, letzte N Turns.
    const verlauf = messages.filter((m) => m !== BEGRUESSUNG).slice(-HISTORY_LIMIT);

    setMessages((prev) => [...prev, { role: 'user', content: frage }]);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ answer: string }>('/support-ai/ask', {
        question: frage,
        history: verlauf,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Der Assistent ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Support-Assistent" subtitle="Fragen zur Bedienung von Detailly" />

      {/* Hinweis-Banner: Scope + kein Datenzugriff. */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-copper/25 bg-copper-soft px-4 py-3 text-sm text-chrome-300">
        <span className="mt-0.5 shrink-0 text-copper">
          <Icon className="h-4 w-4">{ICON_PATHS.assistant}</Icon>
        </span>
        <span>
          Beantwortet nur Fragen zur Bedienung von Detailly. Kein Zugriff auf deine Kunden- oder
          Auftragsdaten.
        </span>
      </div>

      <SectionCard>
        {/* Nachrichtenliste */}
        <div className="flex max-h-[60vh] min-h-[240px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <Blase key={i} turn={m} />
          ))}
          {loading && <TippBlase />}
          {error && <ErrorBox message={error} />}
          <div ref={endRef} />
        </div>

        {/* Beispiel-Fragen nur im leeren Zustand (nur Begruessung sichtbar). */}
        {messages.length === 1 && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {BEISPIELE.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => absenden(b)}
                className="rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-chrome-300 transition hover:border-copper/40 hover:text-chrome-100"
              >
                {b}
              </button>
            ))}
          </div>
        )}

        {/* Eingabe */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            absenden(input);
          }}
          className="mt-4 flex items-end gap-2 border-t border-ink-700/60 pt-4"
        >
          <textarea
            className="input max-h-40 min-h-[48px] flex-1 resize-y"
            placeholder="Frage zur Bedienung von Detailly…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sendet, Shift+Enter macht einen Zeilenumbruch.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                absenden(input);
              }
            }}
            maxLength={2000}
            rows={1}
            disabled={loading}
            aria-label="Deine Frage"
          />
          <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
            Senden
          </button>
        </form>
      </SectionCard>
    </>
  );
}
