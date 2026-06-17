import { Repository, ObjectLiteral } from 'typeorm';

/**
 * Erzeugt eine fortlaufende Nummer je Tenant im Format `<PREFIX>-<JAHR>-<LFD>`.
 * Zaehlt die vorhandenen Datensaetze des Tenants und haengt +1 an. Fuer eine
 * Demo ausreichend; in Produktion sollte hier eine Sequenz-Tabelle/Transaktion
 * mit Sperre verwendet werden, um Race-Conditions zu vermeiden.
 */
export async function nextSequentialNumber<T extends ObjectLiteral>(
  repo: Repository<T>,
  tenantId: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await repo.count({ where: { tenantId } as any });
  const laufend = String(count + 1).padStart(4, '0');
  return `${prefix}-${year}-${laufend}`;
}
