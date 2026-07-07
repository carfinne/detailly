'use client';

// Oeffentliche Beleg-Download-Seite. Kein Login: der Zugang ist das geheime Token
// in der URL (?t=...). Statischer Export -> Token clientseitig aus window.location.
// Zeigt Eckdaten + Download-Button (oeffentlicher PDF-Endpoint).
//
// P3-4 (T-006): Fuer OFFENE Rechnungen zusaetzlich "Jetzt bezahlen": GiroCode
// (EPC-QR fuer die Banking-App), Bankverbindung mit Kopier-Buttons und optional
// der eigene Online-Zahlungslink des Betriebs. Die Zahlung laeuft IMMER direkt
// an den Betrieb – nie ueber Detailly.

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, absoluteApiUrl } from '@/lib/api';
import { eur, datum } from '@/lib/format';
import { PublicShell } from '@/components/PublicShell';
import { QrCode, Ecc } from '@/lib/qrcodegen';

interface Zahlung {
  empfaenger: string;
  iban: string;
  bic: string;
  bankname: string;
  betrag: number;
  verwendungszweck: string;
  epcQrData: string | null;
  paymentLink: string | null;
}

interface Meta {
  betrieb: string;
  nummer: string;
  art: string;
  status: string;
  brutto: number;
  datum: string | null;
  zahlung: Zahlung | null;
}

function readToken(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('t')?.trim() ?? '';
}

/** IBAN lesbar in Vierergruppen (nur Anzeige – kopiert wird ohne Leerzeichen). */
function ibanAnzeige(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** GiroCode als SVG (gevendorte QR-Bibliothek, ECC M laut EPC-Vorgabe). */
function GiroCode({ data }: { data: string }) {
  const svg = useMemo(() => {
    try {
      const qr = QrCode.encodeText(data, Ecc.MEDIUM);
      const rand = 3; // Ruhezone in Modulen
      const gesamt = qr.size + rand * 2;
      let pfad = '';
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) pfad += `M${x + rand} ${y + rand}h1v1h-1z`;
        }
      }
      return { gesamt, pfad };
    } catch {
      return null; // Payload unerwartet zu gross o. ae. -> lieber kein QR
    }
  }, [data]);

  if (!svg) return null;
  return (
    <svg
      viewBox={`0 0 ${svg.gesamt} ${svg.gesamt}`}
      className="h-44 w-44"
      role="img"
      aria-label="GiroCode: SEPA-Überweisung per Banking-App"
      shapeRendering="crispEdges"
    >
      <rect width={svg.gesamt} height={svg.gesamt} fill="#ffffff" />
      <path d={svg.pfad} fill="#111111" />
    </svg>
  );
}

/** Wert-Zeile mit Kopier-Button (Bankdaten fehlerfrei uebernehmen). */
function KopierZeile({ label, wert, kopierWert }: { label: string; wert: string; kopierWert?: string }) {
  const [kopiert, setKopiert] = useState(false);

  async function kopieren() {
    const text = kopierWert ?? wert;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback fuer Umgebungen ohne Clipboard-API (z. B. eingebettete Ansicht).
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* dann eben nicht – der Wert steht sichtbar daneben */
      }
      ta.remove();
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2">
      <div className="min-w-0 text-left">
        <p className="text-[11px] uppercase tracking-wide text-chrome-600">{label}</p>
        <p className="truncate font-mono text-sm text-chrome-200">{wert}</p>
      </div>
      <button
        type="button"
        onClick={kopieren}
        className="shrink-0 rounded-lg border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-chrome-300 transition hover:border-copper-400 hover:text-copper-300"
      >
        {kopiert ? 'Kopiert ✓' : 'Kopieren'}
      </button>
    </div>
  );
}

export default function RechnungDownloadPage() {
  const [token, setToken] = useState('');
  const [data, setData] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = readToken();
    setToken(t);
    if (!t) {
      setLoading(false);
      setError('Kein Beleg angegeben. Bitte den vollständigen Link aus Ihrer Nachricht verwenden.');
      return;
    }
    api
      .get<Meta>(`/public/invoices/${encodeURIComponent(t)}`)
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'Dieser Beleg wurde nicht gefunden. Möglicherweise ist der Link veraltet.'
            : 'Die Seite konnte nicht geladen werden. Bitte später erneut versuchen.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const istAngebot = data?.art === 'angebot';
  const titel = istAngebot ? 'Angebot' : 'Rechnung';
  const pdfUrl = token ? absoluteApiUrl(`/public/invoices/${encodeURIComponent(token)}/pdf`) : '';
  const zahlung = data?.zahlung ?? null;

  return (
    <PublicShell raster>
        {loading ? (
          <div className="card text-center text-chrome-400">Lädt…</div>
        ) : error ? (
          <div className="card text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-850 text-chrome-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm text-chrome-300">{error}</p>
          </div>
        ) : data ? (
          <>
            <div className="mb-7 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-copper-300">{titel} zum Download</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.betrieb}</h1>
            </div>

            <div className="card space-y-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12v18l-3-1.6L12 21l-3-1.6L6 21z" />
                  <path d="M9 8h6M9 12h6" />
                </svg>
              </div>

              <div>
                <p className="font-mono text-lg font-semibold text-chrome-50">{data.nummer || titel}</p>
                <p className="mt-1 text-sm text-chrome-400">
                  {data.datum ? `vom ${datum(data.datum)} · ` : ''}{eur(data.brutto)}
                  {!istAngebot && data.status === 'bezahlt' && ' · bezahlt'}
                </p>
              </div>

              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-primary w-full justify-center">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
                PDF herunterladen
              </a>
            </div>

            {zahlung && (
              <div className="card mt-4 space-y-4">
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-copper-300">Jetzt bezahlen</p>
                  <p className="mt-1 text-sm text-chrome-400">
                    {eur(zahlung.betrag)} per Überweisung an {zahlung.empfaenger || data.betrieb}
                  </p>
                </div>

                {zahlung.epcQrData && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-2xl bg-white p-2 shadow-glow">
                      <GiroCode data={zahlung.epcQrData} />
                    </div>
                    <p className="max-w-xs text-center text-xs text-chrome-500">
                      GiroCode: mit der Banking-App scannen – Empfänger, Betrag und
                      Verwendungszweck sind vorausgefüllt.
                    </p>
                  </div>
                )}

                {zahlung.iban && (
                  <div className="space-y-2">
                    <KopierZeile
                      label="IBAN"
                      wert={ibanAnzeige(zahlung.iban)}
                      kopierWert={zahlung.iban.replace(/\s+/g, '')}
                    />
                    {zahlung.bic && <KopierZeile label="BIC" wert={zahlung.bic} />}
                    <KopierZeile label="Verwendungszweck" wert={zahlung.verwendungszweck} />
                    {zahlung.bankname && (
                      <p className="text-center text-xs text-chrome-600">Bank: {zahlung.bankname}</p>
                    )}
                  </div>
                )}

                {zahlung.paymentLink && (
                  <a
                    href={zahlung.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="btn-primary w-full justify-center"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 14 21 3m0 0h-6m6 0v6M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                    </svg>
                    Online bezahlen
                  </a>
                )}

                <p className="text-center text-xs text-chrome-600">
                  Die Zahlung geht direkt an {zahlung.empfaenger || data.betrieb}. Nach
                  Zahlungseingang markiert der Betrieb die Rechnung als bezahlt.
                </p>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-chrome-600">{data.betrieb} · Detailly</p>
          </>
        ) : null}
    </PublicShell>
  );
}
