'use client';

// FahrzeugWechselDialog: wiederverwendbarer Dialog zum Wechseln des Fahrzeugs.
// Zeigt die Fahrzeuge DES Kunden (tenant-scoped via /vehicles?customerId=...),
// laesst eines auswaehlen und meldet die Wahl an den Aufrufer (onConfirm), der
// das eigentliche PATCH ausfuehrt. Genutzt im Auftrags-Detail (Auftrag/Angebot)
// und in der Schadenserfassung (aktive Inspektion).
//
// Der Aufrufer steuert `open`; bei Erfolg schliesst er selbst. Wirft onConfirm,
// bleibt der Dialog offen und zeigt den Fehler INLINE (Hausregel: Modal-Fehler
// im Modal, nicht als Toast hinter dem Overlay).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Modal, Loading, ErrorBox } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { Vehicle } from '@/lib/types';

function fahrzeugLabel(v: Vehicle): string {
  const name = [v.make, v.model].filter(Boolean).join(' ');
  return v.licensePlate ? `${name} · ${v.licensePlate}` : name || v.id.slice(0, 8);
}

export function FahrzeugWechselDialog({
  open,
  onClose,
  customerId,
  currentVehicleId,
  onConfirm,
  note,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  currentVehicleId?: string;
  /** Fuehrt das PATCH aus. Wirft bei Fehler -> Dialog zeigt ihn inline. */
  onConfirm: (vehicleId: string) => Promise<void>;
  /** Optionaler, ehrlicher Hinweistext (z. B. was NICHT mitwandert). */
  note?: React.ReactNode;
  confirmLabel?: string;
}) {
  const t = useT();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string>(currentVehicleId ?? '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const list = await api.get<Vehicle[]>(`/vehicles?customerId=${encodeURIComponent(customerId)}`);
      setVehicles(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('fahrzeugwechsel.error.laden'));
    } finally {
      setLoading(false);
    }
  }, [customerId, t]);

  useEffect(() => {
    if (open) {
      setSelected(currentVehicleId ?? '');
      setError('');
      load();
    }
  }, [open, currentVehicleId, load]);

  async function bestaetigen() {
    if (!selected || selected === currentVehicleId) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(selected);
      // Erfolg: der Aufrufer schliesst den Dialog (open -> false).
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('fahrzeugwechsel.error.speichern'));
    } finally {
      setSaving(false);
    }
  }

  const keineFahrzeuge = !loading && vehicles.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={t('fahrzeugwechsel.title')}>
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}

        {loading ? (
          <Loading />
        ) : keineFahrzeuge ? (
          <p className="text-sm text-chrome-400">{t('fahrzeugwechsel.empty')}</p>
        ) : (
          <div>
            <label className="label" htmlFor="fahrzeugwechsel-select">
              {t('fahrzeugwechsel.label')}
            </label>
            <select
              id="fahrzeugwechsel-select"
              className="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={saving}
            >
              <option value="">{t('fahrzeugwechsel.placeholder')}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {fahrzeugLabel(v)}
                  {v.id === currentVehicleId ? ` · ${t('fahrzeugwechsel.aktuell')}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Ehrlicher Hinweis (z. B. Belege/Fotos wandern nicht mit). */}
        {note && (
          <div className="rounded-xl border border-ink-700/70 bg-ink-800/60 px-3.5 py-2.5 text-xs leading-relaxed text-chrome-400">
            {note}
          </div>
        )}

        {/* Weg zum Anlegen eines neuen Fahrzeugs in der Kundenakte. */}
        {customerId && (
          <Link
            href={`/kunden/detail/?id=${customerId}`}
            className="link-action inline-flex items-center gap-1 text-xs"
          >
            {t('fahrzeugwechsel.neuesFahrzeug')}
            <span aria-hidden>→</span>
          </Link>
        )}

        <div className="flex justify-end gap-2 border-t border-ink-700/60 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={bestaetigen}
            disabled={saving || loading || !selected || selected === currentVehicleId}
          >
            {saving && <span className="spinner" />}
            {saving ? t('fahrzeugwechsel.speichern') : confirmLabel ?? t('fahrzeugwechsel.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
