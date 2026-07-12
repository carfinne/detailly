'use client';

// ---------------------------------------------------------------------------
// Anfragen-Seitenpanel der Plantafel: aufklappbares Slide-over (rechts) mit den
// offenen Online-Buchungsanfragen. Annehmen laeuft direkt hier – MIT sichtbarem
// Kalenderkontext (Belegung des Zieltags), optionaler Mitarbeiter-Zuweisung und
// dem Konflikt-Dialog des Doppelbuchungs-Schutzes. So plant die Leitung Anfragen
// in die Plantafel ein, ohne die Seite zu verlassen.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { toLocalInput } from '@/lib/format';
import type { Appointment, Employee, TerminKonflikt } from '@/lib/types';
import { ErrorBox, Modal, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fmtZeit, initialen, startOfDay, addDays } from './plantafel-lib';
import { KonfliktDialog } from './KonfliktDialog';

interface BookingRequest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  serviceName: string | null;
  fahrzeug: string | null;
  wunschtermin: string | null;
  nachricht: string | null;
  status: 'neu' | 'angenommen' | 'abgelehnt';
  reference: string;
  createdAt: string;
}

function fmtDatum(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AnfragenPanel({
  open,
  onClose,
  employees,
  empMap,
  konfliktverhalten,
  zeitformat,
  onAccepted,
}: {
  open: boolean;
  onClose: () => void;
  /** Aktive Mitarbeiter fuer die Zuweisung; leer = Zuweisungs-UI ausblenden. */
  employees: Employee[];
  empMap: Record<string, Employee>;
  konfliktverhalten: 'warnen' | 'blockieren';
  zeitformat: '24h' | '12h';
  /** Nach erfolgreicher Annahme: Board + Badge aktualisieren. */
  onAccepted: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [sichtbar, setSichtbar] = useState(false);
  const [items, setItems] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState('');

  // Annehmen-Modal
  const [accepting, setAccepting] = useState<BookingRequest | null>(null);
  const [titel, setTitel] = useState('');
  const [start, setStart] = useState('');
  const [ende, setEnde] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [kundeAnlegen, setKundeAnlegen] = useState(true);
  const [auftragAnlegen, setAuftragAnlegen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [konflikte, setKonflikte] = useState<TerminKonflikt[] | null>(null);

  // Kalenderkontext: Belegung des Zieltags (zum gewaehlten Beginn).
  const [tagesTermine, setTagesTermine] = useState<Appointment[] | null>(null);
  const kontextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.get<BookingRequest[]>('/booking-requests');
      setItems(data.filter((r) => r.status === 'neu'));
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : t('plantafel.error.load'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slide-in-Animation + Escape + Scroll-Lock (Muster: Marktplatz-Slide-over).
  useEffect(() => {
    if (!open) return;
    setItems(null);
    void load();
    const raf = requestAnimationFrame(() => setSichtbar(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      setSichtbar(false);
    };
  }, [open, load, onClose]);

  // Belegung des Zieltags nachladen, sobald sich der gewaehlte Beginn aendert
  // (entprellt; eigener API-Call, da der Tag ausserhalb des Board-Zeitraums liegen kann).
  useEffect(() => {
    if (!accepting || !start) { setTagesTermine(null); return; }
    if (kontextTimer.current) clearTimeout(kontextTimer.current);
    kontextTimer.current = setTimeout(async () => {
      try {
        const tag = startOfDay(new Date(start));
        if (Number.isNaN(tag.getTime())) return;
        const liste = await api.get<Appointment[]>(
          `/appointments?from=${tag.toISOString()}&to=${addDays(tag, 1).toISOString()}`,
        );
        setTagesTermine(liste.filter((a) => a.status !== 'abgesagt'));
      } catch {
        setTagesTermine(null); // Kontext ist ein Bonus – Fehler hier nie blockierend.
      }
    }, 300);
    return () => { if (kontextTimer.current) clearTimeout(kontextTimer.current); };
  }, [accepting, start]);

  function openAccept(req: BookingRequest) {
    const startDate = req.wunschtermin ? new Date(req.wunschtermin) : new Date();
    setAccepting(req);
    setTitel(`${req.serviceName ? req.serviceName + ': ' : ''}${req.name}`);
    setStart(toLocalInput(startDate));
    setEnde(toLocalInput(new Date(startDate.getTime() + 60 * 60 * 1000)));
    setAssignedUserId('');
    setKundeAnlegen(true);
    setAuftragAnlegen(true);
    setModalError('');
    setKonflikte(null);
  }

  async function accept(konfliktBestaetigt: boolean) {
    if (!accepting) return;
    setBusy(true);
    setModalError('');
    try {
      await api.post(`/booking-requests/${accepting.id}/accept`, {
        titel: titel.trim() || undefined,
        start: start ? new Date(start).toISOString() : undefined,
        ende: ende ? new Date(ende).toISOString() : undefined,
        kundeAnlegen,
        auftragAnlegen: kundeAnlegen && auftragAnlegen,
        // Zuweisung nur mitsenden, wenn gewaehlt ('' wuerde das DTO mit 400 ablehnen).
        ...(assignedUserId ? { assignedUserId } : {}),
        ...(konfliktBestaetigt ? { konfliktBestaetigt: true } : {}),
      });
      setKonflikte(null);
      setAccepting(null);
      toast(t('plantafel.anfragen.angenommen'), { variant: 'positive' });
      await load();
      onAccepted();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === 'APPOINTMENT_OVERLAP') {
        const data = e.data as { konflikte?: TerminKonflikt[] } | undefined;
        setKonflikte(data?.konflikte ?? []);
      } else {
        setKonflikte(null);
        setModalError(e instanceof Error ? e.message : t('plantafel.anfragen.error'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t('plantafel.anfragen.title')}>
      <div
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-220 ease-emphasized ${sichtbar ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col border-l border-ink-700 bg-ink-850 shadow-pop transition-transform duration-220 ease-emphasized ${sichtbar ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Kopf */}
        <div className="flex items-center gap-3 border-b border-ink-700/70 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-chrome-50">{t('plantafel.anfragen.title')}</h2>
            <p className="text-xs text-chrome-500">{t('plantafel.anfragen.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-ink-750 hover:text-chrome-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/50"
            aria-label={t('common.close')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto p-5">
          {items === null ? (
            // Animiertes Lade-Skeleton (nie totes "Laedt...").
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-ink-700/60 p-3.5">
                  <div className="skeleton mb-2 h-4 w-2/3" />
                  <div className="skeleton mb-1.5 h-3 w-1/2" />
                  <div className="skeleton h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorBox message={error} />
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-ink-700/60 bg-ink-900/40 px-4 py-6 text-center text-sm text-chrome-500">
              {t('plantafel.anfragen.leer')}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((req) => (
                <div key={req.id} className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-chrome-100">{req.name}</h3>
                    <span className="badge-caution shrink-0">{t('plantafel.anfragen.neu')}</span>
                  </div>
                  <dl className="space-y-0.5 text-xs text-chrome-400">
                    {req.serviceName && <div>{t('plantafel.anfragen.leistung')}: <span className="text-chrome-200">{req.serviceName}</span></div>}
                    {req.fahrzeug && <div>{t('plantafel.anfragen.fahrzeug')}: <span className="text-chrome-200">{req.fahrzeug}</span></div>}
                    {req.wunschtermin && <div>{t('plantafel.anfragen.wunschtermin')}: <span className="text-chrome-200">{fmtDatum(req.wunschtermin)}</span></div>}
                  </dl>
                  {req.nachricht && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-chrome-500">{req.nachricht}</p>
                  )}
                  <div className="mt-2.5 flex justify-end">
                    <button className="btn-primary btn-sm" onClick={() => openAccept(req)}>
                      {t('plantafel.anfragen.annehmen')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fuss: Link zur vollen Anfragen-Seite (inkl. Ablehnen/Historie). */}
        <div className="border-t border-ink-700/70 p-4">
          <Link href="/anfragen/" className="link-action text-sm">{t('plantafel.anfragen.alle')} →</Link>
        </div>
      </div>

      {/* Annehmen-Modal (mit Kalenderkontext + Mitarbeiter-Zuweisung) */}
      <Modal open={!!accepting} onClose={() => (busy ? undefined : setAccepting(null))} title={t('plantafel.anfragen.acceptTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-chrome-400">{t('plantafel.anfragen.acceptHint')}</p>
          <div className="field">
            <label className="label" htmlFor="ap-titel">{t('plantafel.form.titel')}</label>
            <input id="ap-titel" type="text" className="input" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={150} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field">
              <label className="label" htmlFor="ap-start">{t('plantafel.form.start')}</label>
              <input id="ap-start" type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="ap-ende">{t('plantafel.form.ende')}</label>
              <input id="ap-ende" type="datetime-local" className="input" value={ende} onChange={(e) => setEnde(e.target.value)} />
            </div>
          </div>
          {employees.length > 0 && (
            <div className="field">
              <label className="label" htmlFor="ap-mitarbeiter">{t('plantafel.form.mitarbeiter')}</label>
              <select id="ap-mitarbeiter" className="select" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
                <option value="">{t('plantafel.form.optional')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sichtbarer Kalenderkontext: Belegung des Zieltags. */}
          {start && (
            <div className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
              <p className="kpi-label mb-2">
                {t('plantafel.anfragen.kontext', {
                  datum: new Date(start).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                })}
              </p>
              {tagesTermine === null ? (
                <div className="space-y-1.5">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ) : tagesTermine.length === 0 ? (
                <p className="text-xs text-chrome-500">{t('plantafel.anfragen.kontextLeer')}</p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto">
                  {tagesTermine.map((a) => {
                    const emp = a.assignedUserId ? empMap[a.assignedUserId] : undefined;
                    return (
                      <li key={a.id} className="flex items-center gap-2 text-xs text-chrome-300">
                        <span className="tabular-nums text-chrome-500">{fmtZeit(a.start, zeitformat)}–{fmtZeit(a.ende, zeitformat)}</span>
                        <span className="min-w-0 flex-1 truncate">{a.titel || t('plantafel.ohneTitel')}</span>
                        {emp && (
                          <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-ink-750 px-0.5 text-[8px] font-bold text-chrome-300">
                            {initialen(emp)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm text-chrome-300">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40" checked={kundeAnlegen} onChange={(e) => setKundeAnlegen(e.target.checked)} />
            {t('plantafel.anfragen.kundeAnlegen')}
          </label>
          <label className={`flex items-center gap-2.5 text-sm ${kundeAnlegen ? 'text-chrome-300' : 'text-chrome-600'}`}>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-600 bg-ink-800 text-copper focus:ring-copper/40"
              checked={kundeAnlegen && auftragAnlegen}
              disabled={!kundeAnlegen}
              onChange={(e) => setAuftragAnlegen(e.target.checked)}
            />
            {t('plantafel.anfragen.auftragAnlegen')}
          </label>

          {modalError && <ErrorBox message={modalError} />}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setAccepting(null)} disabled={busy}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={() => void accept(false)} disabled={busy}>
              {busy && <span className="spinner" />}
              {t('plantafel.anfragen.terminAnlegen')}
            </button>
          </div>
        </div>
      </Modal>

      <KonfliktDialog
        konflikte={konflikte}
        blockiert={konfliktverhalten === 'blockieren'}
        busy={busy}
        empMap={empMap}
        onConfirm={() => void accept(true)}
        onCancel={() => setKonflikte(null)}
      />
    </div>
  );
}
