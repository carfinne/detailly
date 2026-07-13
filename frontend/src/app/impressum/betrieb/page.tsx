'use client';

// Oeffentliches Impressum DES BETRIEBS (§ 5 DDG). Statischer Export -> kein
// dynamisches [slug]-Segment; der Betrieb wird clientseitig aus ?b=<slug> gelesen
// (gleiche Konvention wie /buchen). Die Angaben liefert der PII-freie Public-
// Endpoint /public/booking/:slug/impressum (strikte Whitelist).
//
// WICHTIG: Dies ist das Impressum des jeweiligen Betriebs, nicht von Detailly.
// Detailly stellt nur die technische Plattform (Hinweis am Seitenende).

import { useEffect, useState } from 'react';
import { api, ApiError, appPath } from '@/lib/api';
import { Abschnitt } from '@/components/legal';
import { LoadingCard, ErrorBox } from '@/components/ui';

interface Impressum {
  firmenname: string;
  rechtsformLabel: string;
  anschrift: { strasse: string; plzOrt: string; land: string };
  vertretungLabel: string;
  vertretungsberechtigte: string;
  telefon: string;
  email: string;
  registergericht: string;
  registernummer: string;
  ustId: string;
  berufshaftpflicht: string;
  aufsichtsbehoerde: string;
}

function readSlug(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('b')?.trim() ?? '';
}

export default function BetriebImpressumPage() {
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<Impressum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = readSlug();
    setSlug(s);
    if (!s) {
      setError('Kein Betrieb angegeben.');
      setLoading(false);
      return;
    }
    let aktiv = true;
    api
      .get<Impressum>(`/public/booking/${encodeURIComponent(s)}/impressum`)
      .then((d) => {
        if (aktiv) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (aktiv) setError(e instanceof ApiError ? e.message : 'Das Impressum konnte nicht geladen werden.');
      })
      .finally(() => {
        if (aktiv) setLoading(false);
      });
    return () => {
      aktiv = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-14">
        {slug && (
          <a
            href={`${appPath('/buchen/')}?b=${encodeURIComponent(slug)}`}
            className="link-muted inline-flex items-center gap-1.5 text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
            Zur Buchungsseite
          </a>
        )}

        <header className="mb-8 mt-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-chrome-50">Impressum</h1>
          {data?.firmenname && <p className="mt-2 text-sm text-chrome-400">{data.firmenname}</p>}
        </header>

        {loading ? (
          <LoadingCard label="Impressum wird geladen …" />
        ) : error ? (
          <ErrorBox message={error} />
        ) : data ? (
          <div className="space-y-7">
            <Abschnitt title="Angaben gemäß § 5 DDG">
              <p>
                {data.firmenname}
                {data.rechtsformLabel && (
                  <>
                    <br />
                    <span className="text-chrome-400">{data.rechtsformLabel}</span>
                  </>
                )}
              </p>
              <p>
                {data.anschrift.strasse && (
                  <>
                    {data.anschrift.strasse}
                    <br />
                  </>
                )}
                {data.anschrift.plzOrt && (
                  <>
                    {data.anschrift.plzOrt}
                    <br />
                  </>
                )}
                {data.anschrift.land}
              </p>
              {data.vertretungsberechtigte && (
                <p>
                  <span className="text-chrome-500">{data.vertretungLabel}: </span>
                  {data.vertretungsberechtigte}
                </p>
              )}
            </Abschnitt>

            {(data.telefon || data.email) && (
              <Abschnitt title="Kontakt">
                <p>
                  {data.telefon && (
                    <>
                      Telefon: {data.telefon}
                      <br />
                    </>
                  )}
                  {data.email && (
                    <>
                      E-Mail:{' '}
                      <a href={`mailto:${data.email}`} className="link-action">
                        {data.email}
                      </a>
                    </>
                  )}
                </p>
              </Abschnitt>
            )}

            {(data.registergericht || data.registernummer) && (
              <Abschnitt title="Registereintrag">
                <p>
                  {data.registergericht && (
                    <>
                      Registergericht: {data.registergericht}
                      <br />
                    </>
                  )}
                  {data.registernummer && <>Registernummer: {data.registernummer}</>}
                </p>
              </Abschnitt>
            )}

            {data.ustId && (
              <Abschnitt title="Umsatzsteuer-Identifikationsnummer">
                <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {data.ustId}</p>
              </Abschnitt>
            )}

            {data.berufshaftpflicht && (
              <Abschnitt title="Berufshaftpflichtversicherung">
                <p>{data.berufshaftpflicht}</p>
              </Abschnitt>
            )}

            {data.aufsichtsbehoerde && (
              <Abschnitt title="Aufsichtsbehörde">
                <p>{data.aufsichtsbehoerde}</p>
              </Abschnitt>
            )}

            <Abschnitt title="Verbraucherstreitbeilegung">
              <p>
                Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </Abschnitt>

            <p className="border-t border-ink-700/50 pt-6 text-xs text-chrome-600">
              Dieses Impressum wird vom genannten Betrieb bereitgestellt und verantwortet. Detailly stellt
              lediglich die technische Plattform bereit.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
