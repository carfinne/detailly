'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Order } from '@/lib/types';
import { SectionCard, Empty } from '@/components/ui';
import AuthedImage from '@/components/AuthedImage';
import { useT } from '@/lib/i18n';

// Wandelt eine Datei in eine Data-URL (Base64) um. Der Fehlertext wird
// übergeben, weil hier (Modul-Scope) kein t() zur Verfügung steht.
function dateiZuDataUrl(datei: File, fehlerText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(fehlerText));
    reader.readAsDataURL(datei);
  });
}

function Galerie({ orderId, titel, bilder }: { orderId: string; titel: string; bilder: string[] }) {
  const t = useT();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-chrome-400">{titel}</p>
      {bilder.length === 0 ? (
        <div className="grid h-28 place-items-center rounded-xl border border-dashed border-ink-700 text-xs text-chrome-600">
          {t('auftraege.foto.noImages')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {bilder.map((b, i) => (
            // Fotos werden NUR guard-geschuetzt + tenant-scoped ausgeliefert
            // (kein oeffentlicher /uploads-Mount mehr). Nur der Dateiname ist
            // gespeichert; .split('/').pop() faengt evtl. Altpfade ab.
            <AuthedImage
              key={i}
              path={`/orders/${orderId}/fotos/${b.split('/').pop()}`}
              alt={`${titel} ${i + 1}`}
              className="aspect-video w-full rounded-lg border border-ink-700 object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FotoBereich({
  order,
  onChange,
}: {
  order: Order;
  onChange: (order: Order) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<'vorher' | 'nachher' | null>(null);
  const [fehler, setFehler] = useState('');

  async function upload(phase: 'vorher' | 'nachher', dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return;
    setBusy(phase);
    setFehler('');
    try {
      const bilder = await Promise.all(
        Array.from(dateien).map((d) => dateiZuDataUrl(d, t('auftraege.foto.readError'))),
      );
      const aktualisiert = await api.post<Order>(`/orders/${order.id}/fotos`, { phase, bilder });
      onChange(aktualisiert);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('auftraege.foto.uploadError'));
    } finally {
      setBusy(null);
    }
  }

  const vorher = order.bilderVorher ?? [];
  const nachher = order.bilderNachher ?? [];

  return (
    <SectionCard title={t('auftraege.foto.title')} subtitle={t('auftraege.foto.subtitle')}>
      {fehler && <p className="mb-3 text-sm text-danger">{fehler}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <label className="btn-subtle btn-sm cursor-pointer">
          {busy === 'vorher' ? t('common.loadingEllipsis') : t('auftraege.foto.addBefore')}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => upload('vorher', e.target.files)}
          />
        </label>
        <label className="btn-subtle btn-sm cursor-pointer">
          {busy === 'nachher' ? t('common.loadingEllipsis') : t('auftraege.foto.addAfter')}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => upload('nachher', e.target.files)}
          />
        </label>
      </div>

      {vorher.length === 0 && nachher.length === 0 ? (
        <Empty text={t('auftraege.foto.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Galerie orderId={order.id} titel={t('auftraege.foto.before')} bilder={vorher} />
          <Galerie orderId={order.id} titel={t('auftraege.foto.after')} bilder={nachher} />
        </div>
      )}
    </SectionCard>
  );
}
