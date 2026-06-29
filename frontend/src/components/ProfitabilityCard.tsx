'use client';

// Wirtschaftlichkeit (Deckungsbeitrag) je Auftrag: Netto - Lohn - Material = Marge.
// NUR fuer die Leitung (Backend ist @Roles-geschuetzt); fuer andere Rollen wird
// gar nichts gerendert/geladen.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { eur } from '@/lib/format';
import { useAuth } from '@/lib/auth';

const LEITUNG = ['super_admin', 'franchise_owner', 'manager'];

interface Wirtschaftlichkeit {
  netto: number;
  lohnkosten: number;
  materialkosten: number;
  marge: number;
  margeProzent: number | null;
}

export function ProfitabilityCard({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const istLeitung = !!user && LEITUNG.includes(user.role);

  const [data, setData] = useState<Wirtschaftlichkeit | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!istLeitung) return;
    let aktiv = true;
    api
      .get<Wirtschaftlichkeit>(`/profitability/${orderId}`)
      .then((r) => aktiv && setData(r))
      .catch((e) => aktiv && setError(e instanceof Error ? e.message : 'Auswertung nicht verfügbar'));
    return () => {
      aktiv = false;
    };
  }, [istLeitung, orderId]);

  if (!istLeitung) return null;

  const positiv = (data?.marge ?? 0) >= 0;

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Wirtschaftlichkeit</h2>
        <span className="text-xs text-chrome-500">Deckungsbeitrag</span>
      </div>

      {error ? (
        <p className="text-sm text-chrome-500">{error}</p>
      ) : !data ? (
        <p className="text-sm text-chrome-500">Lädt…</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          <Row k="Auftragswert (netto)" v={eur(data.netto)} />
          <Row k="− Lohnkosten" v={eur(data.lohnkosten)} muted />
          <Row k="− Materialkosten" v={eur(data.materialkosten)} muted />
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink-700 pt-2.5">
            <dt className="font-semibold text-chrome-100">Marge</dt>
            <dd className="flex items-baseline gap-2">
              <span className={`font-display text-xl font-bold ${positiv ? 'text-copper' : 'text-danger'}`}>
                {eur(data.marge)}
              </span>
              {data.margeProzent !== null && (
                <span className="text-xs text-chrome-500">{data.margeProzent} %</span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-chrome-400' : 'text-chrome-300'}>{k}</dt>
      <dd className="tabular-nums text-chrome-100">{v}</dd>
    </div>
  );
}
