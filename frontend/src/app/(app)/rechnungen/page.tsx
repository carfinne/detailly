'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, authedFileUrl, downloadAuthed, appPath } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import { INVOICE_STATUS_COLOR } from '@/lib/labels';
import type { Invoice, Customer, Paginated } from '@/lib/types';
import { PageHeader, Loading, ErrorBox, Empty, Badge, ConfirmDialog, useToast } from '@/components/ui';
import { ActionMenu, type ActionMenuItem } from '@/components/ActionMenu';
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
  bezahlt: ['storniert'], // Storno einer bezahlten Rechnung (Gutschrift/Refund)
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
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bezahlt'>('alle');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ alle: 0, offen: 0, bezahlt: 0 });

  // Storno-Bestätigung (Pending-State): Übergang nach 'storniert' ist destruktiv
  // (nicht umkehrbar, siehe NEXT-Mapping) – normale Vorwärts-Übergänge fragen nicht nach.
  const [confirmStorno, setConfirmStorno] = useState<Invoice | null>(null);

  // Vorbelegung aus der globalen Suche (?q=). Nur clientseitig lesen (useEffect),
  // damit KEIN Suspense-Boundary noetig ist – analog zur Kundenliste.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  // Server-getrieben: Seite, Status-Reiter und Suche (Nummer ODER Kundenname)
  // laufen in der DB – die Liste bleibt konstant schnell, egal wie viele Belege.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(SEITENGROESSE) });
      if (filter !== 'alle') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const [inv, c] = await Promise.all([
        api.get<BelegListe>(`/invoices?${params.toString()}`),
        api.get<Customer[]>('/customers/select'),
      ]);
      setItems(inv.data);
      setTotal(inv.total);
      setCounts(inv.counts);
      setCustomers(c);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, filter, search, t]);

  // Entprellt (250ms): faengt schnelles Tippen in der Suche ab.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

  const TABS: { key: typeof filter; labelKey: string }[] = [
    { key: 'alle', labelKey: 'rechnungen.tab.alle' },
    { key: 'offen', labelKey: 'rechnungen.status.offen' },
    { key: 'bezahlt', labelKey: 'rechnungen.status.bezahlt' },
  ];

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

  return (
    <div>
      <PageHeader title={t('rechnungen.title')} subtitle={t('rechnungen.subtitle')} />
      {error && <ErrorBox message={error} />}
      {!loading && (counts.alle > 0 || search.trim() !== '') && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder={t('rechnungen.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
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
                <span className="text-xs tabular-nums opacity-70">{counts[tab.key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          counts.alle === 0 && search.trim() === '' ? (
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
                  <th className="text-right">{t('rechnungen.col.brutto')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium">
                      {inv.nummer ?? <span className="text-chrome-500">{t('rechnungen.status.entwurf')}</span>}
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
                      <Badge className={INVOICE_STATUS_COLOR[inv.status]}>
                        {STATUS_KEY[inv.status] ? t(STATUS_KEY[inv.status]) : inv.status}
                      </Badge>
                      {inv.status === 'offen' && inv.art === 'rechnung' && (() => {
                        const tage = tageBis(inv);
                        if (tage === null) return null;
                        return tage < 0 ? (
                          <Badge className="badge-danger ml-1">
                            {t('rechnungen.overdue', { tage: Math.abs(tage) })}
                          </Badge>
                        ) : (
                          <Badge className="badge-caution ml-1">{t('rechnungen.dueIn', { tage })}</Badge>
                        );
                      })()}
                      {inv.versendetAm && (
                        <span className="ml-1" title={t('rechnungen.sentOn', { datum: datum(inv.versendetAm) })}>
                          <Badge className="badge-copper">{t('rechnungen.sent')}</Badge>
                        </span>
                      )}
                      {inv.mahnstufe ? (
                        <Badge className="badge-danger ml-1">
                          {inv.mahnstufe <= 3
                            ? t(`rechnungen.mahn.stufe${inv.mahnstufe}`)
                            : t('rechnungen.mahn.generic', { stufe: inv.mahnstufe })}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-right">{eur(inv.brutto)}</td>
                    <td className="text-right">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pager page={page} total={total} limit={SEITENGROESSE} onPage={setPage} />

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
    </div>
  );
}
