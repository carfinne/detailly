'use client';

// CSV-Import-Dialog (T-007): Kunden und Fahrzeuge aus Bestandsdaten uebernehmen.
// Zwei Schritte, gefuehrt: Datei waehlen -> VORSCHAU (Server prueft, schreibt
// nichts) -> "Importieren" schreibt. Fehlerzeilen werden je Zeile erklaert.

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Modal } from '@/components/ui';
import { useT } from '@/lib/i18n';

type ImportTyp = 'kunden' | 'fahrzeuge';
type ZeilenStatus = 'neu' | 'aktualisiert' | 'uebersprungen' | 'fehler';

interface ImportZeile {
  zeile: number;
  name: string;
  status: ZeilenStatus;
  hinweis?: string;
}

interface ImportBericht {
  modus: 'preview' | 'commit';
  encoding: string;
  trennzeichen: string;
  gesamt: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  fehler: number;
  ignorierteSpalten: string[];
  limit?: { max: number | null; aktiv: number; frei: number | null; ueberschritten: boolean };
  zeilen: ImportZeile[];
}

const ENDPUNKT: Record<ImportTyp, string> = {
  kunden: '/customers/import',
  fahrzeuge: '/vehicles/import',
};

// CSV-Vorlagen (Semikolon + BOM, damit Excel/DE sie direkt sauber oeffnet).
const VORLAGEN: Record<ImportTyp, { datei: string; inhalt: string }> = {
  kunden: {
    datei: 'kunden-vorlage.csv',
    inhalt:
      'Vorname;Nachname;Firma;E-Mail;Telefon;Mobil;Strasse;PLZ;Ort;Typ;Notiz\n' +
      'Max;Muster;;max@muster.de;0221 123456;;Musterweg 1;50667;Köln;privat;\n' +
      ';;Glanzwerk GmbH;info@glanzwerk.de;0221 654321;;Industriestr. 5;50859;Köln;firma;Stammkunde\n',
  },
  fahrzeuge: {
    datei: 'fahrzeuge-vorlage.csv',
    inhalt:
      'KundeEmail;Marke;Modell;Kennzeichen;VIN;Baujahr;Farbe;Notiz\n' +
      'max@muster.de;BMW;M3;K-AB 123;;2019;Schwarz;\n' +
      'info@glanzwerk.de;VW;Crafter;K-GW 77;;2021;Weiß;Firmenwagen\n',
  },
};

// Nur die Farb-Klasse bleibt hier (sprachneutral). Das Label wird pro Render
// aus dem i18n-Wörterbuch aufgelöst (t() ist ein Hook, nicht im Modul-Scope).
const STATUS_ANZEIGE: Record<ZeilenStatus, { labelKey: string; klasse: string }> = {
  neu: { labelKey: 'ui.import.status.neu', klasse: 'text-positive' },
  aktualisiert: { labelKey: 'ui.import.status.aktualisiert', klasse: 'text-info' },
  uebersprungen: { labelKey: 'ui.import.status.uebersprungen', klasse: 'text-chrome-500' },
  fehler: { labelKey: 'ui.import.status.fehler', klasse: 'text-danger' },
};

const MAX_ANZEIGE_ZEILEN = 300;

export function ImportModal({
  open, onClose, onImported,
}: {
  open: boolean;
  onClose: () => void;
  /** Nach erfolgreichem Import (Liste neu laden). */
  onImported: () => void;
}) {
  const t = useT();
  const [typ, setTyp] = useState<ImportTyp>('kunden');
  const [file, setFile] = useState<File | null>(null);
  const [duplikate, setDuplikate] = useState<'skip' | 'update'>('skip');
  const [bericht, setBericht] = useState<ImportBericht | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Beim Oeffnen/Typwechsel zuruecksetzen.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setBericht(null);
    setError('');
    setDuplikate('skip');
    if (fileInput.current) fileInput.current.value = '';
  }, [open, typ]);

  async function sende(datei: File, mode: 'preview' | 'commit', dup: 'skip' | 'update') {
    setLaeuft(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', datei);
      form.append('mode', mode);
      if (typ === 'kunden') form.append('duplikate', dup);
      const res = await api.postForm<ImportBericht>(ENDPUNKT[typ], form);
      setBericht(res);
      if (res.modus === 'commit') onImported();
    } catch (err) {
      setBericht(null);
      setError(err instanceof ApiError ? err.message : t('ui.import.error'));
    } finally {
      setLaeuft(false);
    }
  }

  function dateiGewaehlt(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setBericht(null);
    if (f) void sende(f, 'preview', duplikate);
  }

  function duplikateAendern(wert: 'skip' | 'update') {
    setDuplikate(wert);
    // Geaenderte Strategie -> Vorschau neu rechnen (nie nach einem Commit).
    if (file && bericht?.modus !== 'commit') void sende(file, 'preview', wert);
  }

  function vorlageLaden() {
    const vorlage = VORLAGEN[typ];
    // BOM, damit Excel/DE Umlaute korrekt oeffnet.
    const blob = new Blob(['\uFEFF' + vorlage.inhalt], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = vorlage.datei;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const fertigImportiert = bericht?.modus === 'commit';
  const importierbar = bericht ? bericht.neu + bericht.aktualisiert : 0;
  const limitBlockiert = Boolean(bericht?.limit?.ueberschritten);

  return (
    <Modal open={open} onClose={onClose} title={t('ui.import.title')} size="lg">
      <div className="space-y-4">
        {/* Typ-Umschalter */}
        <div className="flex gap-2">
          {(['kunden', 'fahrzeuge'] as const).map((typOpt) => (
            <button
              key={typOpt}
              type="button"
              onClick={() => setTyp(typOpt)}
              className={
                typOpt === typ
                  ? 'rounded-xl bg-copper-soft px-4 py-2 text-sm font-medium text-copper-300 ring-1 ring-copper-400/40'
                  : 'rounded-xl border border-ink-700 px-4 py-2 text-sm text-chrome-400 hover:text-chrome-200'
              }
            >
              {typOpt === 'kunden' ? t('ui.import.typKunden') : t('ui.import.typFahrzeuge')}
            </button>
          ))}
        </div>

        <p className="text-sm text-chrome-500">
          {typ === 'kunden' ? t('ui.import.descKunden') : t('ui.import.descFahrzeuge')}
          {' '}
          <button type="button" className="link-action" onClick={vorlageLaden}>
            {t('ui.import.downloadTemplate')}
          </button>
        </p>

        {/* Datei-Auswahl */}
        <div>
          <label className="label">{t('ui.import.fileLabel')}</label>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="input"
            onChange={dateiGewaehlt}
            disabled={laeuft}
          />
        </div>

        {/* Duplikat-Strategie (nur Kunden) */}
        {typ === 'kunden' && !fertigImportiert && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-chrome-300">
            <span className="text-chrome-500">{t('ui.import.duplicatesLabel')}</span>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="duplikate"
                checked={duplikate === 'skip'}
                onChange={() => duplikateAendern('skip')}
              />
              {t('ui.import.dupSkip')}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="duplikate"
                checked={duplikate === 'update'}
                onChange={() => duplikateAendern('update')}
              />
              {t('ui.import.dupUpdate')}
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        {laeuft && <p className="text-sm text-chrome-400">{t('ui.import.checking')}</p>}

        {/* Bericht (Vorschau ODER Ergebnis) */}
        {bericht && !laeuft && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-ink-850 px-2.5 py-1 text-chrome-300">
                {t('ui.import.badge.rows', { n: bericht.gesamt })}
              </span>
              <span className="rounded-lg bg-ink-850 px-2.5 py-1 text-positive">
                {t('ui.import.badge.new', { n: bericht.neu })}
              </span>
              {bericht.aktualisiert > 0 && (
                <span className="rounded-lg bg-ink-850 px-2.5 py-1 text-info">
                  {t('ui.import.badge.updated', { n: bericht.aktualisiert })}
                </span>
              )}
              {bericht.uebersprungen > 0 && (
                <span className="rounded-lg bg-ink-850 px-2.5 py-1 text-chrome-500">
                  {t('ui.import.badge.skipped', { n: bericht.uebersprungen })}
                </span>
              )}
              {bericht.fehler > 0 && (
                <span className="rounded-lg bg-ink-850 px-2.5 py-1 text-danger">
                  {t('ui.import.badge.errors', { n: bericht.fehler })}
                </span>
              )}
            </div>

            {bericht.ignorierteSpalten.length > 0 && (
              <p className="text-xs text-chrome-500">
                {t('ui.import.ignoredColumns', { cols: bericht.ignorierteSpalten.join(', ') })}
              </p>
            )}

            {limitBlockiert && bericht.limit && (
              <div className="rounded-xl border border-caution/30 bg-caution-soft px-3 py-2 text-sm text-caution">
                {t('ui.import.limitBlocked', {
                  frei: bericht.limit.frei ?? 0,
                  max: bericht.limit.max ?? 0,
                  neu: bericht.neu,
                })}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-700">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-16">{t('ui.import.col.zeile')}</th>
                    <th>{t('ui.import.col.name')}</th>
                    <th className="w-32">{t('ui.import.col.status')}</th>
                    <th>{t('ui.import.col.hinweis')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bericht.zeilen.slice(0, MAX_ANZEIGE_ZEILEN).map((z) => (
                    <tr key={z.zeile}>
                      <td className="text-chrome-500">{z.zeile}</td>
                      <td className="font-medium">{z.name}</td>
                      <td className={STATUS_ANZEIGE[z.status].klasse}>
                        {t(STATUS_ANZEIGE[z.status].labelKey)}
                      </td>
                      <td className="text-chrome-500">{z.hinweis || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bericht.zeilen.length > MAX_ANZEIGE_ZEILEN && (
                <p className="px-3 py-2 text-xs text-chrome-500">
                  {t('ui.import.moreRows', { n: bericht.zeilen.length - MAX_ANZEIGE_ZEILEN })}
                </p>
              )}
            </div>

            {fertigImportiert && (
              <div className="rounded-xl border border-positive/30 bg-positive-soft px-3 py-2 text-sm text-positive">
                {t('ui.import.done.base', { neu: bericht.neu })}
                {bericht.aktualisiert > 0 ? t('ui.import.done.updated', { n: bericht.aktualisiert }) : ''}
                {bericht.uebersprungen > 0 ? t('ui.import.done.skipped', { n: bericht.uebersprungen }) : ''}
                {bericht.fehler > 0 ? t('ui.import.done.errors', { n: bericht.fehler }) : ''}.
              </div>
            )}
          </div>
        )}

        {/* Aktionen */}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {fertigImportiert ? t('common.close') : t('common.cancel')}
          </button>
          {!fertigImportiert && (
            <button
              type="button"
              className="btn-primary"
              disabled={!file || laeuft || !bericht || importierbar === 0 || limitBlockiert}
              onClick={() => file && sende(file, 'commit', duplikate)}
            >
              {laeuft
                ? t('ui.import.running')
                : t('ui.import.commit', {
                    count: importierbar || '',
                    typ: typ === 'kunden' ? t('ui.import.typKunden') : t('ui.import.typFahrzeuge'),
                  }).replace(/\s+/g, ' ').trim()}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
