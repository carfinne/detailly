'use client';

import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, authedFileUrl, downloadAuthed, appPath } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_COLOR, ANGEBOT_STATUS_KEY, ANGEBOT_STATUS_COLOR } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, Modal, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
import { AnzahlungDialog } from '@/components/AnzahlungDialog';
import { BelegBearbeitenModal, istBelegGesperrt } from '@/components/BelegBearbeitenModal';
import { Pager } from '@/components/Pager';
import { useT } from '@/lib/i18n';

const SEITENGROESSE = 50;

/** Paginierte Beleg-Antwort inkl. Status-Zaehlern fuer die Filter-Reiter. */
type BelegListe = Paginated<Invoice> & { counts: { alle: number; offen: number; bezahlt: number } };

const NEXT: Record<string, string[]> = {
  entwurf: ['offen', 'storniert'],
  // 'bezahlt' bewusst NICHT hier: Zahlung laeuft ueber den 'Als bezahlt'-Button
  // (POST /:id/bezahlt), damit immer das Zahldatum gesetzt wird.
  offen: ['storniert'],
  bezahlt: ['storniert'], // Storno einer bezahlten Rechnung (Stornorechnung/Refund)
  storniert: [],
};

// Enum-Wert -> i18n-Key (technisch, nicht angezeigt). Fallback auf den Rohwert
// bleibt im JSX erhalten, falls das Backend einen unbekannten Wert liefert.
const KIND_KEY: Record<string, string> = {
  angebot: 'rechnungen.kind.angebot',
  rechnung: 'rechnungen.kind.rechnung',
};
const STATUS_KEY: Record<string, string> = {
  entwurf: 'rechnungen.status.entwurf',
  offen: 'rechnungen.status.offen',
  bezahlt: 'rechnungen.status.bezahlt',
  storniert: 'rechnungen.status.storniert',
};

// Ganze Tage bis zur effektiven Faelligkeit (negativ = ueberfaellig). Effektive
// Faelligkeit = gespeichertes faelligkeitsdatum, sonst aus datum + zahlungsziel
// (Default 14) abgeleitet – analog zur Backend-Mahnliste, damit auch Rechnungen
// ohne explizites Faelligkeitsdatum korrekt als ueberfaellig erkannt werden.
function tageBis(inv: Invoice): number | null {
  const tag = 24 * 60 * 60 * 1000;
  let faelligMs: number | null = null;
  if (inv.faelligkeitsdatum) {
    const d = new Date(inv.faelligkeitsdatum);
    if (!Number.isNaN(d.getTime())) faelligMs = d.getTime();
  } else if (inv.datum) {
    const d = new Date(inv.datum);
    if (!Number.isNaN(d.getTime())) faelligMs = d.getTime() + (inv.zahlungsziel ?? 14) * tag;
  }
  if (faelligMs == null) return null;
  return Math.ceil((faelligMs - Date.now()) / tag);
}

// Ein Angebot gilt clientseitig als abgelaufen, wenn gueltigBis in der
// Vergangenheit liegt und es noch offen ist (angenommen/abgelehnt haben Vorrang).
function istAbgelaufen(inv: Invoice): boolean {
  const status = inv.angebotStatus ?? 'offen';
  if (status !== 'offen') return false;
  if (!inv.gueltigBis) return false;
  const d = new Date(inv.gueltigBis);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

// Effektiver Angebots-Status (mit clientseitigem 'abgelaufen'-Override).
function effektiverAngebotStatus(inv: Invoice): string {
  return istAbgelaufen(inv) ? 'abgelaufen' : inv.angebotStatus ?? 'offen';
}

// Bündelt benachbarte Zeilen mit gleicher varianteGruppeId. Da ein Set gemeinsam
// erzeugt wird (gleiche createdAt-Reihenfolge), liegen die Varianten in der Liste
// direkt beieinander. Der Grenzfall „Set über Seitengrenze geteilt" wird bewusst
// nicht abgefangen (dann erscheinen die Reste als Einzelzeilen).
function gruppenInfo(items: Invoice[]): { isStart: boolean; size: number; grouped: boolean }[] {
  return items.map((inv, i) => {
    const gid = inv.varianteGruppeId;
    if (!gid) return { isStart: false, size: 1, grouped: false };
    let size = 1;
    // rückwärts prüfen, ob wir mitten in einer Gruppe stehen
    let start = i;
    while (start > 0 && items[start - 1].varianteGruppeId === gid) start--;
    // Gesamtlänge des Laufs
    let end = i;
    while (end + 1 < items.length && items[end + 1].varianteGruppeId === gid) end++;
    size = end - start + 1;
    return { isStart: start === i, size, grouped: size >= 2 };
  });
}

// PDF tenant-sicher per Bearer-Token laden (<a download> sendet keinen
// Authorization-Header) und programmatisch herunterladen.
async function downloadPdf(id: string, nummer: string) {
  const url = await authedFileUrl(`/invoices/${id}/pdf`);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nummer}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Object-URL NICHT synchron freigeben: der Browser startet den Download async,
  // ein zu fruehes revoke bricht ihn (v.a. Firefox/Safari) ab.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function RechnungenPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [xmlBusy, setXmlBusy] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [mahnBusy, setMahnBusy] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt' | 'nachfass'>('alle');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ alle: 0, offen: 0, bezahlt: 0 });
  // Welle 2-B (Teil 1): Nachfass-Vorschlagsliste (offene Angebote seit X Tagen,
  // nicht abgelaufen) – eigene Quelle (/invoices/nachfass-liste), unpaginiert.
  const [nachfassItems, setNachfassItems] = useState<Invoice[]>([]);
  const [nachfassCount, setNachfassCount] = useState(0);
  // Monoton steigende Request-ID: bei schnellen Pager-Klicks/entprellter Suche
  // darf nur die juengste Antwort den State setzen (Muster aus auftraege/page.tsx).
  const reqId = useRef(0);

  // Storno-Bestätigung (Pending-State): Übergang nach 'storniert' ist destruktiv
  // (nicht umkehrbar, siehe NEXT-Mapping) – normale Vorwärts-Übergänge fragen nicht nach.
  const [confirmStorno, setConfirmStorno] = useState<Invoice | null>(null);

  // Welle 1 (Angebote): Annehmen-Bestätigung, Freigabe-Link-Dialog, Anzahlung.
  const [acceptTarget, setAcceptTarget] = useState<Invoice | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [anzahlungTarget, setAnzahlungTarget] = useState<Invoice | null>(null);

  // Beleg-Positionen bearbeiten/ansehen (Entwurf-Rechnung + offenes Angebot
  // aenderbar; Festgeschriebenes nur lesen). Der volle Beleg wird im Modal frisch
  // geladen (die Listen-Projektion enthaelt keine Positionen).
  const [editId, setEditId] = useState<string | null>(null);

  // Vorbelegung aus der globalen Suche (?q=). Nur clientseitig lesen (useEffect),
  // damit KEIN Suspense-Boundary noetig ist – analog zur Kundenliste.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  // Server-getrieben: Seite, Status-Reiter und Suche (Nummer ODER Kundenname)
  // laufen in der DB – die Liste bleibt konstant schnell, egal wie viele Belege.
  // HEISSER PFAD: NUR /invoices. Die Kunden-Namensmap wird einmalig beim Mount
  // geladen (Effekt unten) – nicht bei jedem Seitenwechsel/Filter/Suchtreffer.
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      // Welle 2-B: der Nachfass-Reiter hat eine eigene Quelle (Schwelle X Tage
      // liegt tenant-konfigurierbar im Backend) – unpaginiert, kein Status-Filter.
      if (filter === 'nachfass') {
        const liste = await api.get<Invoice[]>('/invoices/nachfass-liste');
        if (id !== reqId.current) return;
        setNachfassItems(liste);
        setNachfassCount(liste.length);
        setError('');
        return;
      }
      const params = new URLSearchParams({ page: String(page), limit: String(SEITENGROESSE) });
      if (filter !== 'alle') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const inv = await api.get<BelegListe>(`/invoices?${params.toString()}`);
      // Nur die juengste Anfrage darf den State setzen.
      if (id !== reqId.current) return;
      setItems(inv.data);
      setTotal(inv.total);
      setCounts(inv.counts);
      setError('');
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, filter, search, t]);

  // Entprellt (250ms): faengt schnelles Tippen in der Suche ab.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  // Kunden-Namensmap fuer die Beleg-Zeilen: EINMALIG beim Mount. Rein dekorativ
  // (Fallback kundenName(undefined) -> "–"), daher best-effort ohne die Liste zu
  // blockieren, falls dieser Nebenabruf mal scheitert.
  useEffect(() => {
    let aktiv = true;
    api.get<Customer[]>('/customers/select')
      .then((c) => { if (aktiv) setCustomers(c); })
      .catch(() => { /* Namensmap optional – Belege bleiben nutzbar */ });
    return () => { aktiv = false; };
  }, []);

  // Welle 2-B: Nachfass-Zaehler EINMALIG fuer den Reiter-Badge (best-effort;
  // Techniker/aeltere Backends -> 403/404 still ignoriert, Reiter bleibt aus).
  // ?nachfass=1 (aus der Glocke) aktiviert den Reiter direkt.
  useEffect(() => {
    const wantNachfass = new URLSearchParams(window.location.search).get('nachfass') === '1';
    let aktiv = true;
    api.get<Invoice[]>('/invoices/nachfass-liste')
      .then((liste) => {
        if (!aktiv) return;
        setNachfassItems(liste);
        setNachfassCount(liste.length);
        if (wantNachfass) setFilter('nachfass');
      })
      .catch(() => { /* Reiter bleibt aus */ });
    return () => { aktiv = false; };
  }, []);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  // Welle 2-B: im Nachfass-Reiter die eigene Liste zeigen (sonst die Server-Liste).
  const displayItems = filter === 'nachfass' ? nachfassItems : items;
  const groups = gruppenInfo(displayItems);

  const TABS: { key: typeof filter; labelKey: string }[] = [
    { key: 'alle', labelKey: 'rechnungen.tab.alle' },
    { key: 'offen', labelKey: 'rechnungen.status.offen' },
    { key: 'bezahlt', labelKey: 'rechnungen.status.bezahlt' },
    // Nachfass-Reiter nur zeigen, wenn es etwas nachzufassen gibt (oder aktiv).
    ...(nachfassCount > 0 || filter === 'nachfass'
      ? [{ key: 'nachfass' as const, labelKey: 'rechnungen.tab.nachfass' }]
      : []),
  ];
  // Zaehler je Reiter (Nachfass hat einen eigenen Zaehler ausserhalb von counts).
  const tabCount = (k: typeof filter): number =>
    k === 'nachfass' ? nachfassCount : counts[k as 'alle' | 'offen' | 'bezahlt'];

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await api.patch(`/invoices/${id}/status`, { status });
      await load();
      toast(status === 'storniert' ? t('rechnungen.toast.storniert') : t('rechnungen.toast.statusUpdated'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.statusChange'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(id: string, nummer: string) {
    setPdfBusy(id);
    try {
      await downloadPdf(id, nummer);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.pdf'));
    } finally {
      setPdfBusy(null);
    }
  }

  // XRechnung (UBL-XML) tenant-sicher laden und herunterladen. Reicht die
  // konkrete Backend-Meldung durch (z. B. 422 mit fehlenden §14-/Kundenfeldern),
  // damit der Betrieb sofort sieht, was er in den Einstellungen ergaenzen muss.
  async function handleXRechnung(id: string, nummer: string) {
    setXmlBusy(id);
    try {
      await downloadAuthed(`/invoices/${id}/xrechnung`, `xrechnung-${nummer}.xml`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.xrechnung'));
    } finally {
      setXmlBusy(null);
    }
  }

  async function markPaid(id: string) {
    setBusy(true);
    try {
      await api.post(`/invoices/${id}/bezahlt`);
      await load();
      toast(t('rechnungen.toast.paid'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.paid'));
    } finally {
      setBusy(false);
    }
  }

  // Beleg-PDF per E-Mail an den Kunden senden (Backend setzt versendetAm).
  async function sendEmail(id: string) {
    setSendBusy(id);
    try {
      await api.post(`/invoices/${id}/senden`);
      await load();
      toast(t('rechnungen.toast.sent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.send'));
    } finally {
      setSendBusy(null);
    }
  }

  // Öffentlichen Download-Link erzeugen (nur offen/bezahlt) und in die
  // Zwischenablage kopieren – ideal zum Weitergeben an den Kunden.
  async function copyDownloadLink(id: string) {
    setLinkBusy(id);
    try {
      const { token } = await api.post<{ token: string }>(`/invoices/${id}/download-token`);
      const url = `${window.location.origin}${appPath('/rechnung/')}?t=${encodeURIComponent(token)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast(t('rechnungen.toast.linkCopied'), { variant: 'copper' });
      } catch {
        window.prompt(t('rechnungen.linkPrompt'), url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.link'));
    } finally {
      setLinkBusy(null);
    }
  }

  // Offene Rechnung mahnen: Stufe erhöhen + Mahn-PDF per E-Mail (Backend).
  async function mahnen(id: string) {
    setMahnBusy(id);
    try {
      await api.post(`/invoices/${id}/mahnen`);
      await load();
      toast(t('rechnungen.toast.mahnSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.mahn'));
    } finally {
      setMahnBusy(null);
    }
  }

  // Angebots-Variante annehmen -> Backend erzeugt einen Auftrag und lehnt die
  // Geschwister ab. Fehler 409 (andere Variante schon angenommen) / 410
  // (abgelaufen) werden als konkrete Backend-Meldung inline durchgereicht.
  async function acceptAngebot() {
    if (!acceptTarget) return;
    setAcceptBusy(true);
    try {
      await api.post(`/invoices/${acceptTarget.id}/annehmen`);
      setAcceptTarget(null);
      await load();
      toast(t('rechnungen.toast.accepted'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.accept'));
      setAcceptTarget(null);
    } finally {
      setAcceptBusy(false);
    }
  }

  // Öffentlichen Freigabe-Link für die Angebots-Gruppe erzeugen (nur Link, KEIN
  // Versand) und im Dialog mit Kopieren-Button anzeigen.
  async function createShareLink(id: string) {
    setShareBusy(id);
    try {
      const { token } = await api.post<{ token: string }>(`/invoices/${id}/angebot-token`);
      const url = `${window.location.origin}${appPath('/angebot/')}?t=${encodeURIComponent(token)}`;
      setShareCopied(false);
      setShareUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rechnungen.error.share'));
    } finally {
      setShareBusy(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* Zwischenablage gesperrt – der Link steht sichtbar im Feld zum manuellen Kopieren. */
    }
  }

  return (
    <div>
      <PageHeader title={t('rechnungen.title')} subtitle={t('rechnungen.subtitle')} />
      {error && <ErrorBox message={error} />}
      {!loading && (counts.alle > 0 || search.trim() !== '' || nachfassCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {filter !== 'nachfass' && (
            <input
              className="input max-w-xs"
              placeholder={t('rechnungen.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          )}
          <div className="seg-group">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); setPage(1); }}
                className={`flex items-center gap-1.5 seg ${
                  filter === tab.key ? 'seg-active' : ''
                }`}
              >
                {t(tab.labelKey)}
                <span className="text-xs tabular-nums opacity-70">{tabCount(tab.key)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {loading ? (
          <Loading />
        ) : displayItems.length === 0 ? (
          filter === 'nachfass' ? (
            <Empty text={t('rechnungen.empty.nachfass')} />
          ) : counts.alle === 0 && search.trim() === '' ? (
            <Empty text={t('rechnungen.empty.none')} />
          ) : (
            <Empty text={t('rechnungen.empty.filtered')} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('rechnungen.col.nummer')}</th>
                  <th>{t('rechnungen.col.art')}</th>
                  <th>{t('rechnungen.col.kunde')}</th>
                  <th>{t('rechnungen.col.datum')}</th>
                  <th>{t('rechnungen.col.status')}</th>
                  <th className="text-end">{t('rechnungen.col.brutto')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((inv, i) => {
                  const gi = groups[i];
                  const accent = gi.grouped ? 'border-s-2 border-copper/40' : '';
                  return (
                  <Fragment key={inv.id}>
                  {gi.isStart && gi.grouped && (
                    <tr className="bg-ink-800/40">
                      <td colSpan={7} className="border-s-2 border-copper/60 py-2 text-xs font-semibold uppercase tracking-wider text-copper-300">
                        {t('rechnungen.group.title')} · {t('rechnungen.group.count', { n: gi.size })}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className={`font-medium ${accent}`}>
                      <div>{inv.nummer ?? <span className="text-chrome-500">{t('rechnungen.status.entwurf')}</span>}</div>
                      {inv.varianteLabel && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-chrome-400">
                          {inv.istGewaehlt && (
                            <svg viewBox="0 0 24 24" className="h-3 w-3 text-positive" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                          {inv.varianteLabel}
                        </div>
                      )}
                    </td>
                    <td>{KIND_KEY[inv.art] ? t(KIND_KEY[inv.art]) : inv.art}</td>
                    <td>
                      {inv.customerId ? (
                        <Link href={`/kunden/detail/?id=${inv.customerId}`} className="link-row">
                          {kundenName(custMap[inv.customerId])}
                        </Link>
                      ) : (
                        kundenName(custMap[inv.customerId])
                      )}
                    </td>
                    <td>{datum(inv.datum)}</td>
                    <td>
                      {inv.art === 'angebot' ? (() => {
                        const as = effektiverAngebotStatus(inv);
                        return (
                          <Badge className={ANGEBOT_STATUS_COLOR[as] ?? 'badge-neutral'}>
                            {t(ANGEBOT_STATUS_KEY[as] ?? as)}
                          </Badge>
                        );
                      })() : (
                        <Badge className={INVOICE_STATUS_COLOR[inv.status]}>
                          {STATUS_KEY[inv.status] ? t(STATUS_KEY[inv.status]) : inv.status}
                        </Badge>
                      )}
                      {inv.istAnzahlung && (
                        <Badge className="badge-copper ms-1">{t('rechnungen.anzahlung')}</Badge>
                      )}
                      {inv.status === 'offen' && inv.art === 'rechnung' && (() => {
                        const tage = tageBis(inv);
                        if (tage === null) return null;
                        return tage < 0 ? (
                          <Badge className="badge-danger ms-1">
                            {t('rechnungen.overdue', { tage: Math.abs(tage) })}
                          </Badge>
                        ) : (
                          <Badge className="badge-caution ms-1">{t('rechnungen.dueIn', { tage })}</Badge>
                        );
                      })()}
                      {inv.versendetAm && (
                        <span className="ms-1" title={t('rechnungen.sentOn', { datum: datum(inv.versendetAm) })}>
                          <Badge className="badge-copper">{t('rechnungen.sent')}</Badge>
                        </span>
                      )}
                      {/* Welle 2-B: "seit X Tagen offen" (nur im Nachfass-Reiter). */}
                      {filter === 'nachfass' && inv.tageOffen != null && (
                        <Badge className="badge-caution ms-1">
                          {t('rechnungen.nachfass.tageOffen', { tage: inv.tageOffen })}
                        </Badge>
                      )}
                      {inv.mahnstufe ? (
                        <Badge className="badge-danger ms-1">
                          {inv.mahnstufe <= 3
                            ? t(`rechnungen.mahn.stufe${inv.mahnstufe}`)
                            : t('rechnungen.mahn.generic', { stufe: inv.mahnstufe })}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-end">{eur(inv.brutto)}</td>
                    <td className="text-end">
                      <div className="flex justify-end">
                        {(() => {
                          const tage = tageBis(inv);
                          const menu: ActionMenuItem[] = [
                            {
                              key: 'pdf',
                              label: t('rechnungen.action.pdf'),
                              disabled: pdfBusy === inv.id,
                              onSelect: () => handlePdf(inv.id, inv.nummer ?? t('rechnungen.status.entwurf')),
                            },
                          ];
                          // Positionen bearbeiten (aenderbar) bzw. ansehen (festgeschrieben).
                          // Beide oeffnen dasselbe Modal; die Sperre setzt der Server durch.
                          menu.push({
                            key: 'edit',
                            label: istBelegGesperrt(inv)
                              ? t('rechnungen.action.view')
                              : t('rechnungen.action.edit'),
                            onSelect: () => setEditId(inv.id),
                          });
                          // XRechnung (E-Rechnung) nur fuer echte Rechnungen mit
                          // Nummer – nicht fuer Angebote/Entwuerfe. Download, kein
                          // Auto-Versand (der Betrieb sendet selbst an B2B/Behoerde).
                          if (inv.art === 'rechnung' && inv.nummer) {
                            menu.push({
                              key: 'xrechnung',
                              label: t('rechnungen.action.xrechnung'),
                              disabled: xmlBusy === inv.id,
                              onSelect: () => handleXRechnung(inv.id, inv.nummer ?? 'rechnung'),
                            });
                          }
                          if (inv.nummer && inv.status !== 'storniert') {
                            menu.push({
                              key: 'send',
                              label: inv.versendetAm ? t('rechnungen.action.resend') : t('rechnungen.action.send'),
                              disabled: sendBusy === inv.id,
                              onSelect: () => sendEmail(inv.id),
                            });
                          }
                          // Angebote (Welle 1): annehmen + öffentlicher Kunden-Freigabe-Link.
                          if (inv.art === 'angebot' && effektiverAngebotStatus(inv) === 'offen') {
                            menu.push({
                              key: 'accept',
                              label: t('rechnungen.action.accept'),
                              disabled: acceptBusy,
                              onSelect: () => setAcceptTarget(inv),
                            });
                            menu.push({
                              key: 'share',
                              label: t('rechnungen.action.shareLink'),
                              disabled: shareBusy === inv.id,
                              onSelect: () => createShareLink(inv.id),
                            });
                          }
                          // Anzahlung: nur aus einer echten Rechnung (nicht aus einer Anzahlung selbst).
                          if (inv.art === 'rechnung' && inv.status !== 'storniert' && !inv.istAnzahlung) {
                            menu.push({
                              key: 'anzahlung',
                              label: t('rechnungen.action.createDeposit'),
                              onSelect: () => setAnzahlungTarget(inv),
                            });
                          }
                          if (inv.status === 'offen' && inv.art === 'rechnung') {
                            menu.push({
                              key: 'paid',
                              label: t('rechnungen.action.markPaid'),
                              disabled: busy,
                              onSelect: () => markPaid(inv.id),
                            });
                          }
                          if (inv.status === 'offen' || inv.status === 'bezahlt') {
                            menu.push({
                              key: 'link',
                              label: t('rechnungen.action.copyLink'),
                              disabled: linkBusy === inv.id,
                              onSelect: () => copyDownloadLink(inv.id),
                            });
                          }
                          if (inv.status === 'offen' && inv.art === 'rechnung' && tage !== null && tage < 0) {
                            menu.push({
                              key: 'mahnen',
                              label: t('rechnungen.action.mahnen'),
                              disabled: mahnBusy === inv.id,
                              onSelect: () => mahnen(inv.id),
                            });
                          }
                          for (const s of NEXT[inv.status] ?? []) {
                            if (s === 'storniert') {
                              menu.push({
                                key: 'storno',
                                label: t('rechnungen.action.storno'),
                                danger: true,
                                disabled: busy,
                                onSelect: () => setConfirmStorno(inv),
                              });
                            } else {
                              menu.push({
                                key: `to-${s}`,
                                label: t('rechnungen.action.setStatus', { status: STATUS_KEY[s] ? t(STATUS_KEY[s]) : s }),
                                disabled: busy,
                                onSelect: () => setStatus(inv.id, s),
                              });
                            }
                          }
                          return (
                            <ActionMenu label={t('rechnungen.actionsFor', { nummer: inv.nummer ?? t('rechnungen.status.entwurf') })} items={menu} />
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filter !== 'nachfass' && (
        <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />
      )}

      <ConfirmDialog
        open={!!confirmStorno}
        title={t('rechnungen.storno.title')}
        message={
          confirmStorno
            ? confirmStorno.status === 'bezahlt'
              ? t('rechnungen.storno.msgPaid', { nummer: confirmStorno.nummer ?? '' })
              : t('rechnungen.storno.msg', { nummer: confirmStorno.nummer ?? t('rechnungen.status.entwurf') })
            : ''
        }
        confirmLabel={t('rechnungen.action.storno')}
        busy={busy}
        onConfirm={async () => {
          if (!confirmStorno) return;
          await setStatus(confirmStorno.id, 'storniert');
          setConfirmStorno(null);
        }}
        onCancel={() => setConfirmStorno(null)}
      />

      <ConfirmDialog
        open={!!acceptTarget}
        variant="neutral"
        title={t('rechnungen.accept.title')}
        message={
          acceptTarget
            ? t('rechnungen.accept.msg', {
                label: acceptTarget.varianteLabel || acceptTarget.nummer || '',
              })
            : ''
        }
        confirmLabel={t('rechnungen.accept.confirm')}
        busy={acceptBusy}
        onConfirm={acceptAngebot}
        onCancel={() => setAcceptTarget(null)}
      />

      <Modal
        open={!!shareUrl}
        onClose={() => setShareUrl(null)}
        title={t('rechnungen.share.title')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-chrome-400">{t('rechnungen.share.intro')}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              aria-label={t('rechnungen.share.linkLabel')}
              value={shareUrl ?? ''}
              onClick={(e) => e.currentTarget.select()}
              className="input text-xs"
            />
            <button type="button" className="btn-primary shrink-0" onClick={copyShareUrl}>
              {shareCopied ? t('rechnungen.share.copied') : t('rechnungen.share.copy')}
            </button>
          </div>
          {shareUrl && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="link-action text-xs">
              {t('rechnungen.share.preview')}
            </a>
          )}
        </div>
      </Modal>

      <AnzahlungDialog
        open={!!anzahlungTarget}
        onClose={() => setAnzahlungTarget(null)}
        invoiceId={anzahlungTarget?.id}
        basisBrutto={anzahlungTarget ? Number(anzahlungTarget.brutto) || undefined : undefined}
        onCreated={() => {
          setAnzahlungTarget(null);
          load();
          toast(t('angebote.anzahlung.success'));
        }}
      />

      <BelegBearbeitenModal
        open={!!editId}
        belegId={editId}
        onClose={() => setEditId(null)}
        onSaved={(msg) => {
          setEditId(null);
          load();
          toast(msg);
        }}
        onRequestStorno={(beleg) => setConfirmStorno(beleg)}
      />
    </div>
  );
}
