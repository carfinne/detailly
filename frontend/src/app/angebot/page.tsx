'use client';

// Öffentliche Angebots-Annahme (Welle 1, F2). Kein Login: der Zugang ist das
// geheime Token in der URL (?t=...). Statischer Export -> Token clientseitig aus
// window.location (keine dynamische Route, kein Suspense). Bewusst DEUTSCH fest
// verdrahtet – konsistent mit /rechnung und /track (das sieht der Endkunde des
// Betriebs). Zeigt die Varianten nebeneinander; der Kunde wählt genau EINE und
// nimmt sie verbindlich an.

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { eur } from '@/lib/format';
import { PublicShell } from '@/components/PublicShell';
import { LoadingCard, ConfirmDialog } from '@/components/ui';

interface Position {
  beschreibung: string;
  menge: number;
  einzelpreis: number;
  gesamtpreis: number;
}
interface Variante {
  id: string;
  nummer: string | null;
  label: string | null;
  status: string | null;
  istGewaehlt: boolean;
  gueltigBis: string | null;
  istAbgelaufen: boolean;
  netto: number;
  mwst: number;
  brutto: number;
  positionen: Position[];
}
interface Gruppe {
  betrieb: string;
  varianten: Variante[];
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
}

function fmtDatum(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AngebotAnnahmePage() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Gruppe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wahl, setWahl] = useState<Variante | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [erfolg, setErfolg] = useState(false);
  const [aktionsFehler, setAktionsFehler] = useState('');

  async function ladeGruppe(tk: string): Promise<Gruppe | null> {
    const g = await api.get<Gruppe>(`/public/angebote/${encodeURIComponent(tk)}`);
    setData(g);
    return g;
  }

  useEffect(() => {
    const tk = readToken();
    setToken(tk);
    if (!tk) {
      setLoading(false);
      setError('Kein Angebot angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    ladeGruppe(tk)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Dieses Angebot wurde nicht gefunden. Möglicherweise ist der Link veraltet.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const varianten = data?.varianten ?? [];
  const gewaehlte = varianten.find((v) => v.istGewaehlt || v.status === 'angenommen') ?? null;
  const bereitsAngenommen = !!gewaehlte;
  const alleAbgelaufen = varianten.length > 0 && varianten.every((v) => v.istAbgelaufen);
  const spalten = varianten.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';

  async function annehmen() {
    if (!wahl || !token) return;
    setAccepting(true);
    setAktionsFehler('');
    try {
      await api.post(`/public/angebote/${encodeURIComponent(token)}/annehmen`, { invoiceId: wahl.id });
      setErfolg(true);
      setWahl(null);
      await ladeGruppe(token).catch(() => {});
    } catch (e) {
      // 409 = andere Variante bereits angenommen, 410 = abgelaufen. Freundliche
      // Meldung + Gruppe neu laden, damit der aktuelle Stand sichtbar wird.
      if (e instanceof ApiError && e.status === 409) {
        setAktionsFehler('Aus diesem Angebot wurde bereits eine andere Variante angenommen.');
      } else if (e instanceof ApiError && e.status === 410) {
        setAktionsFehler('Dieses Angebot ist leider abgelaufen und kann nicht mehr angenommen werden.');
      } else {
        setAktionsFehler(e instanceof Error ? e.message : 'Die Auswahl konnte nicht bestätigt werden.');
      }
      setWahl(null);
      await ladeGruppe(token).catch(() => {});
    } finally {
      setAccepting(false);
    }
  }

  return (
    <PublicShell width="wide" raster>
      {loading ? (
        <LoadingCard />
      ) : error ? (
        <div className="mx-auto max-w-lg card text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm text-chrome-300">{error}</p>
        </div>
      ) : data ? (
        <div className="mx-auto max-w-5xl">
          <div className="mb-7 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-copper-300">Ihr Angebot</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb}</h1>
            {!bereitsAngenommen && !alleAbgelaufen && (
              <p className="mt-2 text-sm text-chrome-400">
                Bitte wählen Sie eine Variante aus. Ihre Auswahl ist verbindlich.
              </p>
            )}
          </div>

          {erfolg && gewaehlte && (
            <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-positive/30 bg-positive-soft px-5 py-4 text-center">
              <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-positive/20 text-positive">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-chrome-50">Vielen Dank! Ihr Auftrag ist bestätigt.</p>
              <p className="mt-1 text-sm text-chrome-400">
                Gewählt: {gewaehlte.label || gewaehlte.nummer} · {eur(gewaehlte.brutto)}. {data.betrieb} meldet sich bei Ihnen.
              </p>
            </div>
          )}

          {!erfolg && bereitsAngenommen && (
            <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-info/30 bg-info/10 px-5 py-4 text-center">
              <p className="text-sm font-semibold text-chrome-50">Dieses Angebot wurde bereits angenommen.</p>
              <p className="mt-1 text-sm text-chrome-400">
                Angenommen: {gewaehlte?.label || gewaehlte?.nummer} · {eur(gewaehlte?.brutto ?? 0)}.
              </p>
            </div>
          )}

          {!erfolg && !bereitsAngenommen && alleAbgelaufen && (
            <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-caution/30 bg-caution/10 px-5 py-4 text-center">
              <p className="text-sm font-semibold text-chrome-50">Dieses Angebot ist abgelaufen.</p>
              <p className="mt-1 text-sm text-chrome-400">
                Bitte wenden Sie sich an {data.betrieb} für ein neues Angebot.
              </p>
            </div>
          )}

          {aktionsFehler && (
            <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-danger/30 bg-danger-soft px-5 py-4 text-center text-sm text-danger">
              {aktionsFehler}
            </div>
          )}

          <div className={`grid grid-cols-1 gap-4 ${spalten}`}>
            {varianten.map((v) => {
              const gewaehlt = v.istGewaehlt || v.status === 'angenommen';
              const abgelehnt = v.status === 'abgelehnt';
              const waehlbar = !bereitsAngenommen && !v.istAbgelaufen && !erfolg;
              return (
                <div
                  key={v.id}
                  className={`flex flex-col rounded-2xl border p-5 transition-colors ${
                    gewaehlt
                      ? 'border-positive/50 bg-positive/10 shadow-glow'
                      : abgelehnt
                        ? 'border-ink-700 bg-ink-900/40 opacity-60'
                        : 'border-ink-700 bg-ink-850'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-semibold text-chrome-50">
                        {v.label || 'Variante'}
                      </h2>
                      {v.nummer && <p className="font-mono text-xs text-chrome-500">{v.nummer}</p>}
                    </div>
                    {gewaehlt && (
                      <span className="shrink-0 rounded-full bg-positive/20 px-2.5 py-1 text-xs font-semibold text-positive">
                        Angenommen
                      </span>
                    )}
                    {!gewaehlt && v.istAbgelaufen && (
                      <span className="shrink-0 rounded-full bg-caution/20 px-2.5 py-1 text-xs font-semibold text-caution">
                        Abgelaufen
                      </span>
                    )}
                  </div>

                  <ul className="mb-4 space-y-2 border-y border-ink-700/70 py-3">
                    {v.positionen.map((p, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-sm">
                        <span className="min-w-0 text-chrome-300">
                          {p.beschreibung}
                          {p.menge !== 1 && <span className="text-chrome-500"> · {p.menge}×</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-chrome-200">{eur(p.gesamtpreis)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto space-y-1 text-sm">
                    <div className="flex justify-between text-chrome-400">
                      <span>Netto</span>
                      <span className="tabular-nums">{eur(v.netto)}</span>
                    </div>
                    <div className="flex justify-between text-chrome-400">
                      <span>MwSt.</span>
                      <span className="tabular-nums">{eur(v.mwst)}</span>
                    </div>
                    <div className="flex justify-between border-t border-ink-700/70 pt-1.5 text-base font-semibold text-chrome-50">
                      <span>Gesamt</span>
                      <span className="tabular-nums">{eur(v.brutto)}</span>
                    </div>
                  </div>

                  {v.gueltigBis && !gewaehlt && (
                    <p className="mt-2 text-center text-xs text-chrome-500">
                      {v.istAbgelaufen ? 'Abgelaufen am' : 'Gültig bis'} {fmtDatum(v.gueltigBis)}
                    </p>
                  )}

                  {waehlbar && (
                    <button
                      type="button"
                      className="btn-primary mt-4 w-full justify-center"
                      onClick={() => { setAktionsFehler(''); setWahl(v); }}
                    >
                      Diese Variante wählen
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-chrome-600">{data.betrieb} · Detailly</p>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!wahl}
        variant="neutral"
        title="Angebot verbindlich annehmen"
        message={
          wahl
            ? `Möchten Sie die Variante „${wahl.label || wahl.nummer}" für ${eur(wahl.brutto)} verbindlich annehmen? Die übrigen Varianten entfallen damit.`
            : ''
        }
        confirmLabel="Verbindlich annehmen"
        cancelLabel="Abbrechen"
        busy={accepting}
        onConfirm={annehmen}
        onCancel={() => setWahl(null)}
      />
    </PublicShell>
  );
}
