'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Loading, ErrorBox, Empty, SectionCard, Modal } from '@/components/ui';

type Status = 'neu' | 'angenommen' | 'abgelehnt';

interface BookingRequest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  serviceName: string | null;
  fahrzeug: string | null;
  wunschtermin: string | null;
  nachricht: string | null;
  status: Status;
  reference: string;
  createdAt: string;
}

const STATUS_BADGE: Record<Status, { cls: string; label: string }> = {
  neu: { cls: 'badge-caution', label: 'Neu' },
  angenommen: { cls: 'badge-positive', label: 'Angenommen' },
  abgelehnt: { cls: 'badge-neutral', label: 'Abgelehnt' },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Date -> Wert fuer <input type="datetime-local"> (lokale Zeit, ohne Sekunden).
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AnfragenPage() {
  const [items, setItems] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'offen' | 'alle'>('offen');

  // Annehmen-Modal
  const [accepting, setAccepting] = useState<BookingRequest | null>(null);
  const [titel, setTitel] = useState('');
  const [start, setStart] = useState('');
  const [ende, setEnde] = useState('');
  const [kundeAnlegen, setKundeAnlegen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<BookingRequest[]>('/booking-requests');
      setItems(data);
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAccept(req: BookingRequest) {
    const startDate = req.wunschtermin ? new Date(req.wunschtermin) : new Date();
    const endeDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    setAccepting(req);
    setTitel(`Online-Anfrage: ${req.name}`);
    setStart(toLocalInput(startDate));
    setEnde(toLocalInput(endeDate));
    setKundeAnlegen(true);
    setModalError('');
  }

  async function confirmAccept() {
    if (!accepting) return;
    setBusy(true);
    setModalError('');
    try {
      await api.post(`/booking-requests/${accepting.id}/accept`, {
        titel: titel.trim() || undefined,
        start: start ? new Date(start).toISOString() : undefined,
        ende: ende ? new Date(ende).toISOString() : undefined,
        kundeAnlegen,
      });
      setAccepting(null);
      await load();
    } catch (e) {
      setModalError(e instanceof ApiError || e instanceof Error ? e.message : 'Annehmen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function reject(req: BookingRequest) {
    if (!window.confirm(`Anfrage von ${req.name} ablehnen?`)) return;
    try {
      await api.post(`/booking-requests/${req.id}/reject`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Ablehnen fehlgeschlagen');
    }
  }

  const sichtbar = filter === 'offen' ? items.filter((i) => i.status === 'neu') : items;
  const neuCount = items.filter((i) => i.status === 'neu').length;

  return (
    <>
      <PageHeader
        title="Anfragen"
        subtitle="Online-Terminanfragen Ihrer Kunden – annehmen erzeugt einen Termin (und optional einen Kunden)."
        action={
          <div className="flex rounded-xl border border-ink-700 bg-ink-850 p-1">
            {(['offen', 'alle'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f ? 'bg-copper-soft text-copper' : 'text-chrome-400 hover:text-chrome-100'
                }`}
              >
                {f === 'offen' ? `Offen${neuCount ? ` (${neuCount})` : ''}` : 'Alle'}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} />
      ) : sichtbar.length === 0 ? (
        <Empty
          text={
            filter === 'offen'
              ? 'Keine offenen Anfragen. Neue Online-Anfragen erscheinen hier.'
              : 'Noch keine Anfragen eingegangen.'
          }
        />
      ) : (
        <div className="space-y-4">
          {sichtbar.map((req) => (
            <SectionCard key={req.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-base font-semibold text-chrome-50">{req.name}</h3>
                    <span className={STATUS_BADGE[req.status].cls}>{STATUS_BADGE[req.status].label}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-chrome-400">
                    {req.email && (
                      <a href={`mailto:${req.email}`} className="hover:text-copper-200">{req.email}</a>
                    )}
                    {req.phone && (
                      <a href={`tel:${req.phone}`} className="hover:text-copper-200">{req.phone}</a>
                    )}
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {req.serviceName && (
                      <div><dt className="inline text-chrome-500">Leistung: </dt><dd className="inline text-chrome-200">{req.serviceName}</dd></div>
                    )}
                    {req.fahrzeug && (
                      <div><dt className="inline text-chrome-500">Fahrzeug: </dt><dd className="inline text-chrome-200">{req.fahrzeug}</dd></div>
                    )}
                    {req.wunschtermin && (
                      <div><dt className="inline text-chrome-500">Wunschtermin: </dt><dd className="inline text-chrome-200">{fmtDateTime(req.wunschtermin)}</dd></div>
                    )}
                    <div><dt className="inline text-chrome-500">Eingegangen: </dt><dd className="inline text-chrome-200">{fmtDateTime(req.createdAt)}</dd></div>
                  </dl>
                  {req.nachricht && (
                    <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-ink-700/60 bg-ink-800/40 px-3 py-2 text-sm text-chrome-300">
                      {req.nachricht}
                    </p>
                  )}
                  <p className="text-xs text-chrome-600">Referenz {req.reference}</p>
                </div>

                {req.status === 'neu' && (
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => openAccept(req)} className="btn-primary">Annehmen</button>
                    <button onClick={() => reject(req)} className="btn-ghost">Ablehnen</button>
                  </div>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <Modal open={!!accepting} onClose={() => (busy ? undefined : setAccepting(null))} title="Anfrage annehmen">
        <div className="space-y-4">
          <p className="text-sm text-chrome-400">
            Es wird ein bestätigter Termin angelegt{kundeAnlegen ? ' und ein Kunde aus den Kontaktdaten erstellt' : ''}.
          </p>
          <div className="field">
            <label className="label" htmlFor="m-titel">Titel</label>
            <input id="m-titel" type="text" className="input" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={150} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="m-start">Beginn</label>
              <input id="m-start" type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="m-ende">Ende</label>
              <input id="m-ende" type="datetime-local" className="input" value={ende} onChange={(e) => setEnde(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-chrome-300">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40" checked={kundeAnlegen} onChange={(e) => setKundeAnlegen(e.target.checked)} />
            Kunde aus den Kontaktdaten anlegen
          </label>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setAccepting(null)} disabled={busy}>Abbrechen</button>
            <button className="btn-primary" onClick={confirmAccept} disabled={busy}>
              {busy ? 'Wird angelegt…' : 'Termin anlegen'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
