'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { SectionCard, ErrorBox, useToast } from '@/components/ui';
import { QrCode, Ecc } from '@/lib/qrcodegen';

/** otpauth-URL als scharfes SVG (gevendorte QR-Bibliothek, ECC M). */
function QrSvg({ data }: { data: string }) {
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
      return null;
    }
  }, [data]);

  if (!svg) return null;
  return (
    <svg
      viewBox={`0 0 ${svg.gesamt} ${svg.gesamt}`}
      className="h-44 w-44 rounded-xl bg-white p-2"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR-Code"
    >
      <path d={svg.pfad} fill="#0a0a0a" />
    </svg>
  );
}

interface SetupData {
  otpauthUrl: string;
  secretBase32: string;
}

/**
 * Selbstbedienungs-Sektion zur Zwei-Faktor-Authentifizierung (TOTP) im Profil.
 * Zustaende: aus -> Einrichtung (QR + Secret + Code) -> Recovery-Codes einmalig
 * -> aktiv (mit Deaktivierung). Nach Aktivierung/Deaktivierung wird das Profil
 * (useAuth().refresh) neu geladen, damit Banner/Status app-weit stimmen.
 */
export function MfaSection() {
  const { user, refresh } = useAuth();
  const t = useT();
  const toast = useToast();

  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);

  // Deaktivierung.
  const [deactOpen, setDeactOpen] = useState(false);
  const [deactMode, setDeactMode] = useState<'code' | 'passwort'>('code');
  const [deactValue, setDeactValue] = useState('');

  const enabled = user?.mfaEnabled === true;

  async function startSetup() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<SetupData>('/auth/mfa/setup');
      setSetup(res);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ recoveryCodes: string[] }>('/auth/mfa/aktivieren', {
        code: code.trim(),
      });
      setRecoveryCodes(res.recoveryCodes);
      setSetup(null);
      setCode('');
      await refresh();
      toast(t('mfa.toast.activated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.generic'));
    } finally {
      setBusy(false);
    }
  }

  function cancelSetup() {
    setSetup(null);
    setCode('');
    setError('');
  }

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secretBase32);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyRecovery() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setRecoveryCopied(true);
      setTimeout(() => setRecoveryCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function downloadRecovery() {
    if (!recoveryCodes) return;
    const text = `Detailly – Recovery-Codes\n\n${recoveryCodes.join('\n')}\n`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detailly-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function finishRecovery() {
    setRecoveryCodes(null);
    await refresh();
  }

  async function deactivate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/mfa/deaktivieren', { [deactMode]: deactValue });
      setDeactOpen(false);
      setDeactValue('');
      await refresh();
      toast(t('mfa.toast.deactivated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mfa.error.generic'));
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // Recovery-Codes (einmalige Anzeige nach Aktivierung)
  // -------------------------------------------------------------------------
  if (recoveryCodes) {
    return (
      <SectionCard title={t('mfa.recovery.title')} subtitle={t('mfa.recovery.desc')}>
        <div className="flex items-start gap-2 rounded-xl border border-copper/30 bg-copper-soft px-3 py-2.5 text-sm text-chrome-200">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {t('mfa.recovery.warn')}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4 font-mono text-sm">
          {recoveryCodes.map((c) => (
            <div key={c} className="tabular-nums tracking-wide text-chrome-100">{c}</div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={copyRecovery}>
            {recoveryCopied ? t('mfa.recovery.copied') : t('mfa.recovery.copy')}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={downloadRecovery}>
            {t('mfa.recovery.download')}
          </button>
          <button type="button" className="btn-primary btn-sm ml-auto" onClick={finishRecovery}>
            {t('mfa.recovery.done')}
          </button>
        </div>
      </SectionCard>
    );
  }

  // -------------------------------------------------------------------------
  // Aktiv: Status + Deaktivierung
  // -------------------------------------------------------------------------
  if (enabled) {
    return (
      <SectionCard title={t('mfa.title')} subtitle={t('mfa.subtitle')}>
        <div className="flex items-center gap-2 rounded-xl border border-positive/30 bg-positive-soft px-3 py-2.5 text-sm text-positive">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {t('mfa.enabled.status')}
        </div>

        {!deactOpen ? (
          <div className="mt-4">
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setDeactOpen(true); setError(''); }}>
              {t('mfa.enabled.deactivate')}
            </button>
          </div>
        ) : (
          <form onSubmit={deactivate} className="mt-4 space-y-3 rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
            <p className="text-sm text-chrome-300">{t('mfa.deact.title')}</p>
            {error && <ErrorBox message={error} />}
            <div className="field">
              <label className="label" htmlFor="deactValue">
                {deactMode === 'code' ? t('mfa.deact.codeLabel') : t('mfa.deact.passwordLabel')}
              </label>
              <input
                id="deactValue"
                type={deactMode === 'code' ? 'text' : 'password'}
                inputMode={deactMode === 'code' ? 'numeric' : undefined}
                autoComplete={deactMode === 'code' ? 'one-time-code' : 'current-password'}
                className="input font-mono"
                value={deactValue}
                onChange={(e) => setDeactValue(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-danger btn-sm" disabled={busy || !deactValue.trim()}>
                {busy ? <><span className="spinner" />{t('common.loadingEllipsis')}</> : t('mfa.deact.confirm')}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setDeactOpen(false); setDeactValue(''); setError(''); }}>
                {t('mfa.deact.cancel')}
              </button>
              <button
                type="button"
                className="ml-auto text-sm font-medium text-copper-300 hover:text-copper-200"
                onClick={() => { setDeactMode((m) => (m === 'code' ? 'passwort' : 'code')); setDeactValue(''); }}
              >
                {deactMode === 'code' ? t('mfa.deact.usePassword') : t('mfa.deact.useCode')}
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    );
  }

  // -------------------------------------------------------------------------
  // Einrichtung laeuft: QR + Secret + Code
  // -------------------------------------------------------------------------
  if (setup) {
    return (
      <SectionCard title={t('mfa.title')} subtitle={t('mfa.subtitle')}>
        <div className="grid gap-5 sm:grid-cols-[auto,1fr]">
          <div className="flex flex-col items-center gap-2">
            <QrSvg data={setup.otpauthUrl} />
            <p className="text-xs text-chrome-500">{t('mfa.setup.step1')}</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">{t('mfa.setup.secretLabel')}</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={setup.secretBase32}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input flex-1 font-mono text-xs"
                />
                <button type="button" className="btn-ghost btn-sm shrink-0" onClick={copySecret}>
                  {secretCopied ? t('mfa.setup.secretCopied') : t('mfa.setup.copySecret')}
                </button>
              </div>
              <p className="help mt-1">{t('mfa.setup.step2')}</p>
            </div>

            <form onSubmit={activate} className="space-y-3">
              {error && <ErrorBox message={error} />}
              <div className="field">
                <label className="label" htmlFor="mfaSetupCode">{t('mfa.setup.codeLabel')}</label>
                <input
                  id="mfaSetupCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="input text-center font-mono text-lg tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                />
                <p className="help mt-1">{t('mfa.setup.codeHint')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" className="btn-primary btn-sm" disabled={busy || code.length !== 6}>
                  {busy ? <><span className="spinner" />{t('common.loadingEllipsis')}</> : t('mfa.setup.activate')}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={cancelSetup}>
                  {t('mfa.setup.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </SectionCard>
    );
  }

  // -------------------------------------------------------------------------
  // Aus: Einrichtung anbieten
  // -------------------------------------------------------------------------
  return (
    <SectionCard title={t('mfa.title')} subtitle={t('mfa.subtitle')}>
      {user?.mfaPflicht && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {t('mfa.required.note')}
        </div>
      )}
      {!user?.mfaPflicht && user?.mfaEmpfohlen && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-copper/30 bg-copper-soft px-3 py-2.5 text-sm text-chrome-200">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-copper" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          {t('mfa.recommended.note')}
        </div>
      )}
      <p className="text-sm text-chrome-400">{t('mfa.idle.desc')}</p>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      <div className="mt-4">
        <button type="button" className="btn-primary btn-sm" onClick={startSetup} disabled={busy}>
          {busy ? <><span className="spinner" />{t('common.loadingEllipsis')}</> : t('mfa.idle.setupCta')}
        </button>
      </div>
    </SectionCard>
  );
}
