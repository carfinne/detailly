'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { LeistungDetails } from '@/lib/types';
import { ErrorBox, SectionCard } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Kontextabhaengiger Editor fuer branchenspezifische Leistungsdetails.
// Zeigt je nach serviceType nur die relevanten Felder (PPF / Keramik / Folierung).

function Feld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function LeistungDetailsEditor({
  orderId,
  serviceType,
  initial,
}: {
  orderId: string;
  serviceType: string;
  initial?: LeistungDetails;
}) {
  const t = useT();
  const [details, setDetails] = useState<LeistungDetails>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState('');

  // serviceType -> relevanter Detail-Block. "aufbereitung" nutzt Keramik-Felder
  // (Keramikversiegelung ist Teil der Aufbereitung), "sonstiges" zeigt nichts.
  const zeigePpf = serviceType === 'ppf';
  const zeigeFolierung = serviceType === 'folierung';
  const zeigeKeramik = serviceType === 'aufbereitung';

  function setPpf(patch: Partial<NonNullable<LeistungDetails['ppf']>>) {
    setDetails((d) => ({ ...d, ppf: { ...d.ppf, ...patch } }));
  }
  function setKeramik(patch: Partial<NonNullable<LeistungDetails['keramik']>>) {
    setDetails((d) => ({ ...d, keramik: { ...d.keramik, ...patch } }));
  }
  function setFolierung(patch: Partial<NonNullable<LeistungDetails['folierung']>>) {
    setDetails((d) => ({ ...d, folierung: { ...d.folierung, ...patch } }));
  }

  async function speichern() {
    setBusy(true);
    setFehler('');
    setGespeichert(false);
    try {
      await api.patch(`/orders/${orderId}`, { leistungDetails: details });
      setGespeichert(true);
      setTimeout(() => setGespeichert(false), 2000);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('ui.leistungdetails.saveError'));
    } finally {
      setBusy(false);
    }
  }

  if (!zeigePpf && !zeigeFolierung && !zeigeKeramik) {
    return null;
  }

  return (
    <SectionCard
      title={t('ui.leistungdetails.title')}
      action={
        <button className="btn-primary btn-sm" disabled={busy} onClick={speichern}>
          {t('common.save')}
        </button>
      }
    >
      {fehler && <div className="mb-3"><ErrorBox message={fehler} /></div>}
      {gespeichert && <p className="mb-3 text-sm text-positive">{t('ui.leistungdetails.saved')}</p>}

      {zeigePpf && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld label={t('ui.leistungdetails.ppf.folie')}>
            <input
              className="input"
              value={details.ppf?.folie ?? ''}
              onChange={(e) => setPpf({ folie: e.target.value })}
              placeholder={t('ui.leistungdetails.ppf.foliePlaceholder')}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.hersteller')}>
            <input
              className="input"
              value={details.ppf?.hersteller ?? ''}
              onChange={(e) => setPpf({ hersteller: e.target.value })}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.flaeche')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.ppf?.qm ?? ''}
              onChange={(e) => setPpf({ qm: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.garantie')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.ppf?.garantieJahre ?? ''}
              onChange={(e) =>
                setPpf({ garantieJahre: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Feld>
        </div>
      )}

      {zeigeKeramik && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Feld label={t('ui.leistungdetails.keramik.produkt')}>
            <input
              className="input"
              value={details.keramik?.produkt ?? ''}
              onChange={(e) => setKeramik({ produkt: e.target.value })}
              placeholder={t('ui.leistungdetails.keramik.produktPlaceholder')}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.keramik.schichten')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.keramik?.schichten ?? ''}
              onChange={(e) =>
                setKeramik({ schichten: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.garantie')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.keramik?.garantieJahre ?? ''}
              onChange={(e) =>
                setKeramik({ garantieJahre: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Feld>
        </div>
      )}

      {zeigeFolierung && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld label={t('ui.leistungdetails.folierung.farbe')}>
            <input
              className="input"
              value={details.folierung?.farbe ?? ''}
              onChange={(e) => setFolierung({ farbe: e.target.value })}
              placeholder={t('ui.leistungdetails.folierung.farbePlaceholder')}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.hersteller')}>
            <input
              className="input"
              value={details.folierung?.hersteller ?? ''}
              onChange={(e) => setFolierung({ hersteller: e.target.value })}
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.flaeche')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.folierung?.qm ?? ''}
              onChange={(e) =>
                setFolierung({ qm: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.garantie')}>
            <input
              className="input"
              type="number"
              min={0}
              value={details.folierung?.garantieJahre ?? ''}
              onChange={(e) =>
                setFolierung({ garantieJahre: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </Feld>
          <Feld label={t('ui.leistungdetails.folierung.teil')}>
            <label className="mt-2 flex items-center gap-2 text-sm text-chrome-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-copper"
                checked={!!details.folierung?.teilfolierung}
                onChange={(e) => setFolierung({ teilfolierung: e.target.checked })}
              />
              {t('ui.leistungdetails.folierung.teilHint')}
            </label>
          </Feld>
          <div className="sm:col-span-2">
            <Feld label={t('ui.leistungdetails.folierung.pflege')}>
              <textarea
                className="input min-h-[72px]"
                value={details.folierung?.pflegehinweis ?? ''}
                onChange={(e) => setFolierung({ pflegehinweis: e.target.value })}
                placeholder={t('ui.leistungdetails.folierung.pflegePlaceholder')}
              />
            </Feld>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
