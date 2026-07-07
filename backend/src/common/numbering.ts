import { Like, Repository, ObjectLiteral } from 'typeorm';

/**
 * Erzeugt eine fortlaufende Nummer je Tenant im Format `<PREFIX>-<JAHR>-<LFD>`.
 *
 * Standard (ohne `nummerFeld`): zaehlt ALLE Datensaetze des Tenants +1 – passt
 * fuer Entitaeten mit nur EINEM Praefix (Auftraege 'AU', Bestellungen 'BE').
 *
 * Mit `nummerFeld` (Rechnungen): zaehlt NUR Datensaetze mit demselben Praefix
 * UND Jahr ueber dieses Feld -> getrennte, je lueckenlose Nummernkreise (AN/RE).
 * Belege OHNE gesetzte Nummer (Rechnungs-Entwuerfe) zaehlen NICHT mit, damit
 * verworfene Entwuerfe keine Rechnungsnummer "verbrauchen" (GoBD: lueckenlos).
 *
 * Hinweis: count-basiert -> bei echter Nebenlaeufigkeit theoretisch doppelte
 * Nummer moeglich. Deshalb ist (tenantId, nummer) bzw. (tenantId, auftragsnummer)
 * jetzt als UNIQUE-Index abgesichert (Invoice/Order/PurchaseOrder) und die Vergabe
 * wird an den Aufrufstellen per withUniqueRetry serialisiert: bei Kollision zieht
 * count() nach dem Commit der Konkurrenz die naechste freie Nummer.
 *
 * Prod-Hinweis (C1): ein Dubletten-Check auf bereits vorhandene Bestandsnummern
 * VOR dem Anlegen des Unique-Index gehoert in die P3-8-Baseline-Migration, nicht
 * hierher (Dev legt die Indizes ueber synchronize beim Reseed an).
 */
export async function nextSequentialNumber<T extends ObjectLiteral>(
  repo: Repository<T>,
  tenantId: string,
  prefix: string,
  opts?: { nummerFeld?: string },
): Promise<string> {
  const year = new Date().getFullYear();
  const where: Record<string, unknown> = { tenantId };
  if (opts?.nummerFeld) {
    where[opts.nummerFeld] = Like(`${prefix}-${year}-%`);
  }
  const count = await repo.count({ where: where as any });
  const laufend = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${laufend}`;
}
