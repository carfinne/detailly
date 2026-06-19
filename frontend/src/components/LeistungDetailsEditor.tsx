'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { LeistungDetails } from '@/lib/types';
import { SectionCard } from '@/components/ui';

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
      setFehler(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  if (!zeigePpf && !zeigeFolierung && !zeigeKeramik) {
    return null;
  }

  return (
    <SectionCard
      title="Leistungsdetails"
      action={
        <button className="btn-primary btn-sm" disabled={busy} onClick={speichern}>
          Speichern
        </button>
      }
    >
      {fehler && <p className="mb-3 text-sm text-danger">{fehler}</p>}
      {gespeichert && <p className="mb-3 text-sm text-positive">Gespeichert.</p>}

      {zeigePpf && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Feld label="Folie">
            <input
              className="input"
              value={details.ppf?.folie ?? ''}
              onChange={(e) => setPpf({ folie: e.target.value })}
              placeholder="z.B. XPEL Ultimate Plus"
            />
          </Feld>
          <Feld label="Hersteller">
            <input
              className="input"
              value={details.ppf?.hersteller ?? ''}
              onChange={(e) => setPpf({ hersteller: e.target.value })}
            />
          </Feld>
          <Feld label="Fläche (m²)">
            <input
              className="input"
              type="number"
              min={0}
              value={details.ppf?.qm ?? ''}
              onChange={(e) => setPpf({ qm: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Feld>
          <Feld label="Garantie (Jahre)">
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
          <Feld label="Produkt">
            <input
              className="input"
              value={details.keramik?.produkt ?? ''}
              onChange={(e) => setKeramik({ produkt: e.target.value })}
              placeholder="z.B. Gtechniq Crystal Serum"
            />
          </Feld>
          <Feld label="Schichten">
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
          <Feld label="Garantie (Jahre)">
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
          <Feld label="Farbe / Design">
            <input
              className="input"
              value={details.folierung?.farbe ?? ''}
              onChange={(e) => setFolierung({ farbe: e.target.value })}
              placeholder="z.B. Mattschwarz"
            />
          </Feld>
          <Feld label="Hersteller">
            <input
              className="input"
              value={details.folierung?.hersteller ?? ''}
              onChange={(e) => setFolierung({ hersteller: e.target.value })}
            />
          </Feld>
          <Feld label="Fläche (m²)">
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
          <Feld label="Teilfolierung">
            <label className="mt-2 flex items-center gap-2 text-sm text-chrome-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-copper"
                checked={!!details.folierung?.teilfolierung}
                onChange={(e) => setFolierung({ teilfolierung: e.target.checked })}
              />
              Nur Teilbereiche foliert
            </label>
          </Feld>
        </div>
      )}
    </SectionCard>
  );
}
