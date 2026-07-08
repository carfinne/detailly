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

// Backend-Antwort der Mahnliste: Rechnung + berechnete Ueberfaelligkeit in Tagen.
type MahnRechnung = Invoice & { tageUeberfaellig: number };

// Anzeige der NAECHSTEN Mahnung je aktueller Mahnstufe (Backend erhoeht +1, max 3).
const MAHN_STUFE_LABEL: Record<number, string> = {
  0: 'noch nicht gemahnt',
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
};

/** Label der Mahnung, die beim naechsten Mahnen versendet wird. */
function naechsteStufeLabel(mahnstufe?: number): string {
  const next = Math.min((mahnstufe ?? 0) + 1, 3);
  return MAHN_STUFE_LABEL[next];
}

export default function MahnungenPage() {
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
      setError(e instanceof Error ? e.message : 'Mahnliste konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast(`Mahnung an ${kunde(inv)} versendet.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mahnung fehlgeschlagen');
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
      toast(`${ok} Mahnung${ok === 1 ? '' : 'en'} versendet.`);
    }
    if (fehler > 0) {
      setError(`${fehler} Mahnung${fehler === 1 ? '' : 'en'} konnte${fehler === 1 ? '' : 'n'} nicht versendet werden.`);
    }
    await load();
  }

  const aktionenGesperrt = bulkBusy || mahnBusy !== null;

  return (
    <div>
      <PageHeader
        title="Mahnungen"
        subtitle="Überfällige Rechnungen im Blick behalten und anmahnen"
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
                  Mahnt …
                </>
              ) : (
                'Alle mahnen'
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
          <Empty text="Keine überfälligen Rechnungen. Alle offenen Rechnungen sind innerhalb der Frist." />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Überfällige Rechnungen"
              value={items.length}
              icon={ICON_PATHS.mahnung}
            />
            <StatCard
              label="Offener Betrag"
              value={eur(summe)}
              accent
              hint="Summe brutto"
            />
            <StatCard
              label="Noch nicht gemahnt"
              value={ohneMahnung}
              hint={ohneMahnung === 1 ? 'Rechnung ohne Mahnung' : 'Rechnungen ohne Mahnung'}
            />
          </div>

          <div className="card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nummer</th>
                    <th>Kunde</th>
                    <th>Fällig seit</th>
                    <th>Mahnstufe</th>
                    <th className="text-right">Brutto</th>
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
                          {inv.tageUeberfaellig} {inv.tageUeberfaellig === 1 ? 'Tag' : 'Tage'}
                        </Badge>
                        {inv.faelligkeitsdatum && (
                          <span className="ml-2 text-xs text-chrome-500">
                            fällig {datum(inv.faelligkeitsdatum)}
                          </span>
                        )}
                      </td>
                      <td>
                        {inv.mahnstufe ? (
                          <Badge className="badge-danger">
                            {MAHN_STUFE_LABEL[inv.mahnstufe] ?? `Stufe ${inv.mahnstufe}`}
                          </Badge>
                        ) : (
                          <Badge className="badge-neutral">Noch nicht gemahnt</Badge>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{eur(inv.brutto)}</td>
                      <td className="text-right">
                        <button
                          className="link-action text-xs disabled:opacity-50"
                          disabled={aktionenGesperrt}
                          onClick={() => setConfirmOne(inv)}
                        >
                          {mahnBusy === inv.id
                            ? 'Mahnt …'
                            : inv.mahnstufe
                              ? 'Erneut mahnen'
                              : 'Jetzt mahnen'}
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
        title="Rechnung mahnen"
        variant="neutral"
        confirmLabel="Mahnung senden"
        busy={mahnBusy !== null}
        message={
          confirmOne
            ? `Rechnung ${confirmOne.nummer ?? ''} an ${kunde(confirmOne)} mahnen? Der Kunde erhält eine ${naechsteStufeLabel(confirmOne.mahnstufe)} per E-Mail, die Mahnstufe wird erhöht.`
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
        title="Alle mahnen"
        variant="neutral"
        confirmLabel="Alle mahnen"
        busy={bulkBusy}
        message={`Alle ${items.length} überfälligen Rechnungen jetzt mahnen? An jeden betroffenen Kunden wird eine Mahnung per E-Mail versendet und die Mahnstufe erhöht.`}
        onConfirm={async () => {
          await mahnenAlle();
          setConfirmBulk(false);
        }}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
