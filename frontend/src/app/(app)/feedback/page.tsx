'use client';

// Betreiber-Sicht des PRIVATEN Kunden-Feedbacks aus der Uebergabe-Mappe (Welle
// 2-C). Tenant-scoped (Backend). Tarif-Feature 'kundenerlebnis' (wie die Mappe).
// Beim Oeffnen werden ungelesene Eintraege serverseitig als gelesen markiert
// (die Glocke sinkt), waehrend ein "neu"-Badge aus dem Lade-Snapshot in dieser
// Sitzung erhalten bleibt.

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Loading, ErrorBox, Empty, Badge } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Feedback {
  id: string;
  orderId: string;
  auftragsnummer: string | null;
  sterne: number;
  kommentar: string | null;
  gelesen: boolean;
  createdAt: string;
}

function fmt(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Sterne({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${i <= n ? 'text-copper' : 'text-ink-600'}`}
          fill={i <= n ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const t = useT();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let aktiv = true;
    api
      .get<Feedback[]>('/feedback')
      .then((list) => {
        if (!aktiv) return;
        setItems(list);
        // Ungelesene serverseitig als gelesen markieren (Glocke sinkt). Das lokale
        // "neu"-Badge bleibt (Snapshot in items.gelesen wird NICHT ueberschrieben).
        for (const f of list.filter((x) => !x.gelesen)) {
          api.patch(`/feedback/${f.id}/gelesen`).catch(() => undefined);
        }
      })
      .catch(() => aktiv && setError(t('feedback.loadError')))
      .finally(() => aktiv && setLoading(false));
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title={t('feedback.title')} subtitle={t('feedback.subtitle')} />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : items.length === 0 ? (
        <Empty text={t('feedback.empty')} />
      ) : (
        <ul className="space-y-3">
          {items.map((f) => (
            <li key={f.id} className="card animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Sterne n={f.sterne} />
                  <span className="text-sm font-medium text-chrome-200">
                    {t('feedback.stars', { n: f.sterne })}
                  </span>
                  {!f.gelesen && <Badge className="bg-copper/15 text-copper">{t('feedback.new')}</Badge>}
                </div>
                <span className="text-xs text-chrome-500">{fmt(f.createdAt)}</span>
              </div>

              {f.kommentar && (
                <p className="mt-2.5 whitespace-pre-line text-sm text-chrome-200">{f.kommentar}</p>
              )}

              {f.auftragsnummer && (
                <p className="mt-2 text-xs text-chrome-500">
                  {t('feedback.order')}{' '}
                  <span className="font-mono text-chrome-400">{f.auftragsnummer}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
