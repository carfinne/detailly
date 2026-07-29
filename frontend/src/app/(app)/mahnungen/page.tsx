'use client';

// Mahn-Cockpit (Paket C1-A): fokussierte Ansicht der ueberfaelligen offenen
// Rechnungen. Nutzt AUSSCHLIESSLICH bestehende Backend-Endpunkte:
//   - GET  /invoices/mahnliste   -> ueberfaellige Rechnungen inkl. tageUeberfaellig
//   - POST /invoices/:id/mahnen  -> Mahnstufe erhoehen + Mahn-PDF per E-Mail
// Keine neue Backend-Logik. Pro Zeile "Jetzt mahnen" (mit Bestaetigung) sowie
// eine Bulk-Aktion "Alle mahnen".

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { eur, datum, kundenName } from '@/lib/format';
import type { Invoice, Customer } from '@/lib/types';
import {
  PageHeader,
  Loading,
  ErrorBox,
  UpgradeHinweis,
  Empty,
  Badge,
  StatCard,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useT } from '@/lib/i18n';

// Backend-Antwort der Mahnliste: Rechnung + berechnete Ueberfaelligkeit in Tagen.
type MahnRechnung = Invoice & { tageUeberfaellig: number };

// Anzeige der NAECHSTEN Mahnung je aktueller Mahnstufe (Backend erhoeht +1, max 3).
// Enum->i18n-Key; die Aufloesung erfolgt via t() in der Komponente.
const MAHN_STUFE_KEY: Record<number, string> = {
  0: 'mahnungen.stufe.0',
  1: 'mahnungen.stufe.1',
  2: 'mahnungen.stufe.2',
  3: 'mahnungen.stufe.3',
};

/** i18n-Key der Mahnung, die beim naechsten Mahnen versendet wird. */
function naechsteStufeKey(mahnstufe?: number): string {
  const next = Math.min((mahnstufe ?? 0) + 1, 3);
  return MAHN_STUFE_KEY[next];
}

export default function MahnungenPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<MahnRechnung[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Tarif-403 (Mahnwesen erst ab Basic) zeigt den Upgrade-Weg statt Sackgasse.
  const [upgrade, setUpgrade] = useState(false);

  const [mahnBusy, setMahnBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmOne, setConfirmOne] = useState<MahnRechnung | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [liste, c] = await Promise.all([
        api.get<MahnRechnung[]>('/invoices/mahnliste'),
        api.get<Customer[]>('/customers/select'),
      ]);
      setItems(Array.isArray(liste) ? liste : []);
      setCustomers(Array.isArray(c) ? c : []);
      setError('');
      setUpgrade(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_FEATURE_MISSING') setUpgrade(true);
      setError(e instanceof Error ? e.message : t('mahnungen.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const kunde = (inv: Invoice) => kundenName(custMap[inv.customerId]);

  // Kennzahlen fuer die Kopf-Karten.
  const summe = items.reduce((s, inv) => s + Number(inv.brutto ?? 0), 0);
  const ohneMahnung = items.filter((inv) => !inv.mahnstufe).length;

  // Eine Rechnung mahnen (POST /invoices/:id/mahnen). Backend erhoeht die Stufe
  // und versendet das Mahn-/Erinnerungs-PDF per E-Mail. Danach Liste neu laden.
  async function mahnenEine(inv: MahnRechnung) {
    setMahnBusy(inv.id);
    try {
      await api.post(`/invoices/${inv.id}/mahnen`);
      toast(t('mahnungen.toast.sentOne', { kunde: kunde(inv) }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mahnungen.error.mahn'));
    } finally {
      setMahnBusy(null);
    }
  }

  // Alle ueberfaelligen Rechnungen mahnen. Sequenziell, um den Mailversand nicht
  // zu ueberlasten; Teilfehler werden gezaehlt und gemeldet.
  async function mahnenAlle() {
    setBulkBusy(true);
    setError('');
    const liste = [...items];
    let ok = 0;
    let fehler = 0;
    for (const inv of liste) {
      try {
        await api.post(`/invoices/${inv.id}/mahnen`);
        ok += 1;
      } catch {
        fehler += 1;
      }
    }
    setBulkBusy(false);
    if (ok > 0) {
      toast(t(ok === 1 ? 'mahnungen.toast.sentBulkOne' : 'mahnungen.toast.sentBulkMany', { count: ok }));
    }
    if (fehler > 0) {
      setError(t(fehler === 1 ? 'mahnungen.error.bulkOne' : 'mahnungen.error.bulkMany', { count: fehler }));
    }
    await load();
  }

  const aktionenGesperrt = bulkBusy || mahnBusy !== null;

  return (
    <div>
      <PageHeader
        title={t('mahnungen.title')}
        subtitle={t('mahnungen.subtitle')}
        action={
          items.length > 0 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={aktionenGesperrt}
              onClick={() => setConfirmBulk(true)}
            >
              {bulkBusy ? (
                <>
                  <span className="spinner" />
                  {t('mahnungen.mahnt')}
                </>
              ) : (
                t('mahnungen.alleMahnen')
              )}
            </button>
          ) : undefined
        }
      />

      {error &&
        (upgrade ? (
          <UpgradeHinweis message={error} className="mb-4" />
        ) : (
          <ErrorBox message={error} className="mb-4" />
        ))}

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card">
          <Empty text={t('mahnungen.empty')} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={t('mahnungen.stat.ueberfaellig')}
              value={items.length}
              icon={ICON_PATHS.mahnung}
            />
            <StatCard
              label={t('mahnungen.stat.offenerBetrag')}
              value={eur(summe)}
              accent
              hint={t('mahnungen.stat.summeBrutto')}
            />
            <StatCard
              label={t('mahnungen.notYetReminded')}
              value={ohneMahnung}
              hint={t(ohneMahnung === 1 ? 'mahnungen.stat.ohneMahnungHintOne' : 'mahnungen.stat.ohneMahnungHintMany')}
            />
          </div>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('mahnungen.col.nummer')}</th>
                    <th>{t('mahnungen.col.kunde')}</th>
                    <th>{t('mahnungen.col.faelligSeit')}</th>
                    <th>{t('mahnungen.col.mahnstufe')}</th>
                    <th className="text-end">{t('mahnungen.col.brutto')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.nummer ?? '–'}</td>
                      <td>
                        {inv.customerId ? (
                          <Link href={`/kunden/detail/?id=${inv.customerId}`} className="link-row">
                            {kunde(inv)}
                          </Link>
                        ) : (
                          kunde(inv)
                        )}
                      </td>
                      <td>
                        <Badge className={inv.tageUeberfaellig > 30 ? 'badge-danger' : 'badge-caution'}>
                          {inv.tageUeberfaellig} {t(inv.tageUeberfaellig === 1 ? 'mahnungen.tag' : 'mahnungen.tage')}
                        </Badge>
                        {inv.faelligkeitsdatum && (
                          <span className="ms-2 text-xs text-chrome-500">
                            {t('mahnungen.faelligAm', { datum: datum(inv.faelligkeitsdatum) })}
                          </span>
                        )}
                      </td>
                      <td>
                        {inv.mahnstufe ? (
                          <Badge className="badge-danger">
                            {MAHN_STUFE_KEY[inv.mahnstufe] ? t(MAHN_STUFE_KEY[inv.mahnstufe]) : `Stufe ${inv.mahnstufe}`}
                          </Badge>
                        ) : (
                          <Badge className="badge-neutral">{t('mahnungen.notYetReminded')}</Badge>
                        )}
                      </td>
                      <td className="text-end tabular-nums">{eur(inv.brutto)}</td>
                      <td className="text-end">
                        <button
                          className="link-action text-xs disabled:opacity-50"
                          disabled={aktionenGesperrt}
                          onClick={() => setConfirmOne(inv)}
                        >
                          {mahnBusy === inv.id
                            ? t('mahnungen.mahnt')
                            : inv.mahnstufe
                              ? t('mahnungen.erneutMahnen')
                              : t('mahnungen.jetztMahnen')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Einzel-Mahnung bestaetigen (versendet eine echte E-Mail an den Kunden). */}
      <ConfirmDialog
        open={!!confirmOne}
        title={t('mahnungen.confirmOne.title')}
        variant="neutral"
        confirmLabel={t('mahnungen.confirmOne.confirm')}
        busy={mahnBusy !== null}
        message={
          confirmOne
            ? t('mahnungen.confirmOne.msg', {
                nummer: confirmOne.nummer ?? '',
                kunde: kunde(confirmOne),
                stufe: t(naechsteStufeKey(confirmOne.mahnstufe)),
              })
            : ''
        }
        onConfirm={async () => {
          if (confirmOne) await mahnenEine(confirmOne);
          setConfirmOne(null);
        }}
        onCancel={() => setConfirmOne(null)}
      />

      {/* Bulk-Mahnung bestaetigen. */}
      <ConfirmDialog
        open={confirmBulk}
        title={t('mahnungen.alleMahnen')}
        variant="neutral"
        confirmLabel={t('mahnungen.alleMahnen')}
        busy={bulkBusy}
        message={t('mahnungen.confirmBulk.msg', { count: items.length })}
        onConfirm={async () => {
          await mahnenAlle();
          setConfirmBulk(false);
        }}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
