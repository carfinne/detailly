'use client';

import { useState } from 'react';
import Link from 'next/link';
import { downloadAuthed, ApiError } from '@/lib/api';
import { PageHeader, ErrorBox, UpgradeHinweis, SectionCard, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Erster und letzter Tag des aktuellen Monats (Default-Zeitraum).
function monatsRange() {
  const now = new Date();
  return {
    von: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    bis: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function FormatCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? 'border-copper/60 bg-copper-soft' : 'border-ink-700/70 bg-ink-800/40 hover:border-ink-600'
      }`}
    >
      <div className="font-display text-sm font-semibold text-chrome-50">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-chrome-400">{desc}</div>
    </button>
  );
}

export default function BuchhaltungPage() {
  const init = monatsRange();
  const t = useT();
  const toast = useToast();
  const [von, setVon] = useState(init.von);
  const [bis, setBis] = useState(init.bis);
  const [format, setFormat] = useState<'csv' | 'datev'>('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Tarif-403 (Buchhaltungs-Export erst ab Basic) zeigt den Upgrade-Weg.
  const [upgrade, setUpgrade] = useState(false);
  const [zeitBusy, setZeitBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    setError('');
    setUpgrade(false);
    try {
      const name =
        format === 'datev'
          ? `EXTF_Buchungsstapel_${von}_${bis}.csv`
          : `Buchhaltung_${von}_${bis}.csv`;
      await downloadAuthed(`/invoices/export?format=${format}&von=${von}&bis=${bis}`, name);
      toast(t('buchhaltung.toast.exportStarted'), { variant: 'copper' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('buchhaltung.error.export'));
    } finally {
      setBusy(false);
    }
  }

  async function onExportZeiten() {
    setZeitBusy(true);
    setError('');
    setUpgrade(false);
    try {
      await downloadAuthed(`/order-times/export?von=${von}&bis=${bis}`, `Arbeitszeiten_${von}_${bis}.csv`);
      toast(t('buchhaltung.toast.exportStarted'), { variant: 'copper' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('buchhaltung.error.export'));
    } finally {
      setZeitBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('buchhaltung.title')}
        subtitle={t('buchhaltung.subtitle')}
      />
      <div className="max-w-2xl space-y-5">
        {error && (upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />)}

        <SectionCard title={t('buchhaltung.zeitraum.title')} subtitle={t('buchhaltung.zeitraum.subtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="von">{t('buchhaltung.von')}</label>
              <input
                id="von"
                type="date"
                className="input"
                value={von}
                onChange={(e) => setVon(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="bis">{t('buchhaltung.bis')}</label>
              <input
                id="bis"
                type="date"
                className="input"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
          </div>
          <p className="help mt-2">{t('buchhaltung.zeitraum.help')}</p>
        </SectionCard>

        <SectionCard title={t('buchhaltung.format.title')} subtitle={t('buchhaltung.format.subtitle')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormatCard
              active={format === 'csv'}
              onClick={() => setFormat('csv')}
              title={t('buchhaltung.format.csv.title')}
              desc={t('buchhaltung.format.csv.desc')}
            />
            <FormatCard
              active={format === 'datev'}
              onClick={() => setFormat('datev')}
              title={t('buchhaltung.format.datev.title')}
              desc={t('buchhaltung.format.datev.desc')}
            />
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={onExport} disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" />
                {t('buchhaltung.exporting')}
              </>
            ) : (
              t('buchhaltung.export')
            )}
          </button>
          {format === 'datev' && (
            <Link href="/einstellungen" className="link-action text-sm">
              {t('buchhaltung.datevStammdaten')}
            </Link>
          )}
        </div>

        <p className="text-xs leading-relaxed text-chrome-500">
          {t('buchhaltung.datevHinweis')}
        </p>

        <SectionCard
          title={t('buchhaltung.zeiten.title')}
          subtitle={t('buchhaltung.zeiten.subtitle')}
        >
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={onExportZeiten} disabled={zeitBusy}>
              {zeitBusy ? (
                <>
                  <span className="spinner" />
                  {t('buchhaltung.exporting')}
                </>
              ) : (
                t('buchhaltung.zeiten.export')
              )}
            </button>
          </div>
          <p className="help mt-3">{t('buchhaltung.zeiten.help')}</p>
        </SectionCard>
      </div>
    </>
  );
}
