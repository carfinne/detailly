'use client';

// Plattform-Newsletter (Detailly-Team, nur Platform-Admin): Abonnenten-Zahlen,
// Newsletter verfassen, Live-Vorschau (inkl. rechtlichem Footer) und – erst nach
// ausdrücklicher Bestätigung (Review-before-send) – Versand an alle bestätigten
// Abonnenten. Der Backend-Endpoint ist auf Platform-Admin begrenzt; die UI
// spiegelt das (Zugriffshinweis für andere Rollen).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorBox, Empty, Badge, StatCard, ConfirmDialog, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

type NewsletterStatus = 'pending' | 'confirmed' | 'unsubscribed';

interface Uebersicht {
  counts: { pending: number; confirmed: number; unsubscribed: number };
  letzte: { email: string; status: NewsletterStatus; angemeldetAm: string; bestaetigtAm: string | null }[];
}

interface VersandStatistik {
  empfaenger: number;
  gesendet: number;
  fehlgeschlagen: number;
}

const STATUS_BADGE: Record<NewsletterStatus, string> = {
  pending: 'badge-neutral',
  confirmed: 'badge-positive',
  unsubscribed: 'badge-danger',
};

export default function PlattformNewsletterPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();
  const istAdmin = user?.role === 'platform_admin';

  const zeit = useCallback(
    (v: string) => new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    [],
  );

  const [uebersicht, setUebersicht] = useState<Uebersicht | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [betreff, setBetreff] = useState('');
  const [inhalt, setInhalt] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUebersicht(await api.get<Uebersicht>('/newsletter/uebersicht'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('newsletter.admin.load.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (istAdmin) void load();
  }, [istAdmin, load]);

  const confirmedCount = uebersicht?.counts.confirmed ?? 0;
  const absaetze = useMemo(
    () => inhalt.trim().split(/\n{2,}/).filter((p) => p.trim().length > 0),
    [inhalt],
  );
  const formOk = betreff.trim().length > 0 && inhalt.trim().length > 0;
  const kannSenden = formOk && confirmedCount > 0 && !busy;

  async function senden() {
    setBusy(true);
    try {
      const stat = await api.post<VersandStatistik>('/newsletter/senden', {
        betreff: betreff.trim(),
        inhalt: inhalt.trim(),
      });
      setConfirmOpen(false);
      toast(
        t('newsletter.admin.sent', {
          gesendet: stat.gesendet,
          empfaenger: stat.empfaenger,
          fehlgeschlagen: stat.fehlgeschlagen,
        }),
        { variant: stat.fehlgeschlagen > 0 ? 'copper' : 'positive' },
      );
      setBetreff('');
      setInhalt('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('newsletter.admin.send.error'));
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  // Zugriffs-Gate: nur Platform-Admin. Andere Rollen sehen einen klaren Hinweis
  // (Backend erzwingt es ohnehin per RolesGuard -> 403).
  if (!istAdmin) {
    return (
      <div>
        <PageHeader title={t('newsletter.admin.title')} subtitle={t('newsletter.admin.subtitle')} />
        <ErrorBox message={t('newsletter.admin.onlyAdmin')} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('newsletter.admin.title')} subtitle={t('newsletter.admin.subtitle')} />
      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Abonnenten-Zahlen */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('newsletter.status.confirmed')} value={uebersicht?.counts.confirmed ?? 0} accent />
            <StatCard label={t('newsletter.status.pending')} value={uebersicht?.counts.pending ?? 0} />
            <StatCard label={t('newsletter.status.unsubscribed')} value={uebersicht?.counts.unsubscribed ?? 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Verfassen */}
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-chrome-50">{t('newsletter.admin.compose')}</h2>

              <div className="field">
                <label className="label" htmlFor="betreff">{t('newsletter.admin.betreff')}</label>
                <input
                  id="betreff"
                  className="input"
                  value={betreff}
                  onChange={(e) => setBetreff(e.target.value)}
                  maxLength={200}
                  placeholder={t('newsletter.admin.betreffPlaceholder')}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="inhalt">{t('newsletter.admin.inhalt')}</label>
                <textarea
                  id="inhalt"
                  className="input min-h-[220px] w-full resize-y"
                  value={inhalt}
                  onChange={(e) => setInhalt(e.target.value)}
                  maxLength={20000}
                  placeholder={t('newsletter.admin.inhaltPlaceholder')}
                />
                <p className="mt-1.5 text-xs text-chrome-600">{t('newsletter.admin.inhaltHint')}</p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-chrome-500">
                  {confirmedCount > 0 ? '' : t('newsletter.admin.sendEmpty')}
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!kannSenden}
                  onClick={() => (formOk ? setConfirmOpen(true) : setError(t('newsletter.admin.validation')))}
                >
                  {t('newsletter.admin.send', { n: confirmedCount })}
                </button>
              </div>
            </div>

            {/* Vorschau (gerendert wie die Mail inkl. Footer) */}
            <div>
              <h2 className="mb-2 font-display text-lg font-semibold text-chrome-50">{t('newsletter.admin.preview')}</h2>
              <p className="mb-3 text-xs text-chrome-500">{t('newsletter.admin.previewHint')}</p>
              {formOk ? (
                <div className="overflow-hidden rounded-2xl border border-ink-700 bg-white text-ink-900 shadow-card">
                  <div className="bg-[#12151c] px-6 py-4">
                    <span className="font-display text-base font-bold text-white">
                      Detail<span className="text-copper">ly</span>
                    </span>
                  </div>
                  <div className="px-6 py-6">
                    <h3 className="mb-4 text-lg font-semibold text-[#12151c]">{betreff.trim()}</h3>
                    <div className="space-y-3">
                      {absaetze.map((p, i) => (
                        <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1f2430]">{p}</p>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#e6e8ec] px-6 py-4 text-xs leading-relaxed text-[#6b7280]">
                    {t('newsletter.admin.previewConsent')}
                    <br />
                    <span className="text-copper">{t('newsletter.admin.previewUnsub')}</span> {t('newsletter.admin.previewUnsubHint')}
                    {' · '}{t('newsletter.admin.previewImprint')}{' · '}{t('newsletter.admin.previewPrivacy')}
                  </div>
                </div>
              ) : (
                <div className="card">
                  <Empty text={t('newsletter.admin.previewEmpty')} />
                </div>
              )}
            </div>
          </div>

          {/* Letzte Anmeldungen */}
          <div className="card">
            <h2 className="mb-3 font-display text-lg font-semibold text-chrome-50">{t('newsletter.admin.recent')}</h2>
            {!uebersicht || uebersicht.letzte.length === 0 ? (
              <Empty text={t('newsletter.admin.recent.empty')} />
            ) : (
              <ul className="divide-y divide-ink-700/50">
                {uebersicht.letzte.map((s) => (
                  <li key={s.email} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-chrome-100">{s.email}</span>
                    <span className="shrink-0 text-xs text-chrome-500">{zeit(s.angemeldetAm)}</span>
                    <Badge className={STATUS_BADGE[s.status]}>{t(`newsletter.status.${s.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('newsletter.admin.confirmTitle')}
        message={t('newsletter.admin.confirmMsg', { n: confirmedCount })}
        confirmLabel={t('newsletter.admin.confirmSend')}
        variant="neutral"
        busy={busy}
        onConfirm={senden}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
