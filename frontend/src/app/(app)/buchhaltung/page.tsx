'use client';

import { useState } from 'react';
import Link from 'next/link';
import { downloadAuthed, ApiError } from '@/lib/api';
import { PageHeader, ErrorBox, UpgradeHinweis, SectionCard, useToast } from '@/components/ui';

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
      toast('Export gestartet', { variant: 'copper' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Export fehlgeschlagen');
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
      toast('Export gestartet', { variant: 'copper' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Export fehlgeschlagen');
    } finally {
      setZeitBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Buchhaltung"
        subtitle="Daten für den Steuerberater exportieren – Rechnungen (CSV/DATEV) und Arbeitszeiten fürs Lohnbüro."
      />
      <div className="max-w-2xl space-y-5">
        {error && (upgrade ? <UpgradeHinweis message={error} /> : <ErrorBox message={error} />)}

        <SectionCard title="Zeitraum" subtitle="Gilt für beide Exporte (Rechnungen und Arbeitszeiten).">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="von">Von</label>
              <input
                id="von"
                type="date"
                className="input"
                value={von}
                onChange={(e) => setVon(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="bis">Bis</label>
              <input
                id="bis"
                type="date"
                className="input"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
          </div>
          <p className="help mt-2">
            Rechnungen: gestellte (offen &amp; bezahlt) im Zeitraum · Arbeitszeiten: alle Buchungen im Zeitraum.
          </p>
        </SectionCard>

        <SectionCard title="Format" subtitle="Universelles CSV oder DATEV-Buchungsstapel.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormatCard
              active={format === 'csv'}
              onClick={() => setFormat('csv')}
              title="CSV (universell)"
              desc="Semikolon-getrennt, für jeden Steuerberater – auch ohne DATEV. Belegnummer, Datum, Beträge, MwSt, Status."
            />
            <FormatCard
              active={format === 'datev'}
              onClick={() => setFormat('datev')}
              title="DATEV-Buchungsstapel"
              desc="EXTF-Format zum direkten Import in DATEV. Benötigt Berater-/Mandantennummer (Einstellungen)."
            />
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={onExport} disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" />
                Exportiere…
              </>
            ) : (
              'Exportieren'
            )}
          </button>
          {format === 'datev' && (
            <Link href="/einstellungen" className="link-action text-sm">
              DATEV-Stammdaten pflegen →
            </Link>
          )}
        </div>

        <p className="text-xs leading-relaxed text-chrome-500">
          Hinweis: Der DATEV-Export folgt der gängigen EXTF-Spezifikation. Bitte vor dem ersten echten
          Import einmal mit dem Steuerberater bzw. dem kostenlosen DATEV-Prüfprogramm gegenprüfen.
        </p>

        <SectionCard
          title="Arbeitszeiten fürs Lohnbüro"
          subtitle="Erfasste Auftragszeiten je Mitarbeiter im Zeitraum (mit Lohnkosten) als CSV – für die Lohnabrechnung."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={onExportZeiten} disabled={zeitBusy}>
              {zeitBusy ? (
                <>
                  <span className="spinner" />
                  Exportiere…
                </>
              ) : (
                'Arbeitszeiten exportieren'
              )}
            </button>
          </div>
          <p className="help mt-3">
            Detailzeilen je Buchung + Summe je Mitarbeiter. Lohnkosten basieren auf dem aktuell hinterlegten
            Stundenlohn. Enthält Gehaltsdaten – nur für die Leitung.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
