'use client';

import { useState } from 'react';
import { BETRIEBSTYP_META, type Betriebstyp } from '@/lib/branche';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [firmenname, setFirmenname] = useState('');
  const [betriebstyp, setBetriebstyp] = useState<Betriebstyp>('komplett');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    setLoading(true);
    try {
      await register({
        firmenname,
        firstName,
        lastName,
        email,
        password,
        phone: phone.trim() || undefined,
        betriebstyp,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
      {/* Atmosphärischer Hintergrund */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-copper-glow blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-copper-grad text-ink-950 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
              <path d="M5 11h14a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1M5 11a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1h1" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Betrieb <span className="text-gradient">registrieren</span>
          </h1>
          <p className="mt-2 text-sm text-chrome-400">
            14 Tage kostenlos testen — keine Zahlungsdaten nötig
          </p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div className="field">
            <label className="label" htmlFor="firmenname">Betriebsname</label>
            <input
              id="firmenname"
              type="text"
              className="input"
              value={firmenname}
              onChange={(e) => setFirmenname(e.target.value)}
              autoComplete="organization"
              placeholder="z. B. Muster Fahrzeugaufbereitung"
              required
            />
          </div>

          <div className="field">
            <span className="label">Womit arbeitet ihr hauptsächlich?</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BETRIEBSTYP_META) as Betriebstyp[]).map((typ) => {
                const meta = BETRIEBSTYP_META[typ];
                const aktiv = betriebstyp === typ;
                return (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => setBetriebstyp(typ)}
                    aria-pressed={aktiv}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                      aktiv
                        ? 'border-copper/60 bg-copper-soft text-copper'
                        : 'border-ink-700 bg-ink-800/40 text-chrome-300 hover:border-ink-600 hover:text-chrome-50'
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/15"
                      style={{ background: meta.akzent }}
                      aria-hidden
                    />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="help mt-1.5">Bestimmt Look & vorbereitete Kalkulation – später jederzeit änderbar.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label" htmlFor="firstName">Vorname</label>
              <input
                id="firstName"
                type="text"
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="lastName">Nachname</label>
              <input
                id="lastName"
                type="text"
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="email">E-Mail</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="phone">Telefon <span className="text-chrome-600">(optional)</span></label>
            <input
              id="phone"
              type="tel"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Passwort</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                className="input pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-chrome-400 hover:text-chrome-50"
                aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.3M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 4.5-1.2M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-chrome-600">Mindestens 8 Zeichen.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-950/40 border-t-ink-950" />
                Konto wird erstellt…
              </>
            ) : (
              'Kostenlos starten'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-chrome-400">
          Schon ein Konto?{' '}
          <Link href="/login" className="font-medium text-copper-300 hover:text-copper-200">
            Jetzt anmelden
          </Link>
        </p>
      </div>
    </main>
  );
}
