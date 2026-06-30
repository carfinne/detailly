import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Zentrale Helfer fuer die Mandantentrennung (Multi-Tenant-Isolation).
 *
 * Verbindliche Regeln (bei SaaS sicherheitskritisch):
 * - Jeder Zugriff auf mandantenbezogene Daten MUSS auf `user.tenantId` beschraenkt sein.
 * - `tenantId` wird beim Anlegen IMMER aus dem Nutzer gesetzt, nie aus dem Body.
 * - Verknuepfte Fremdschluessel (customerId, vehicleId, ...) MUESSEN tenant-validiert
 *   geladen werden (`assertRefInTenant`), sonst ist Cross-Tenant-Reference-Injection
 *   moeglich (ein Betrieb verknuepft seine Daten mit Datensaetzen eines fremden Betriebs).
 *
 * Hinweis platform_admin: Aktuell sind alle Zugriffe hart auf `user.tenantId` beschraenkt –
 * auch fuer `platform_admin`. Betriebsuebergreifender Zugriff ist ein separates, bewusst
 * spaeter umzusetzendes Feature und wird hier NICHT implizit geoeffnet.
 */

/** Setzt `tenantId` beim Anlegen aus dem Nutzer und ueberschreibt jeden Body-Wert. */
export function withTenant<T extends object>(user: AuthUser, data: T): T & { tenantId: string } {
  return { ...data, tenantId: user.tenantId };
}

/** Wirft, wenn die `tenantId` einer bereits geladenen Entity nicht zum Nutzer passt. */
export function assertSameTenant(user: AuthUser, entityTenantId: string | undefined | null): void {
  if (entityTenantId !== user.tenantId) {
    throw new NotFoundException('Datensatz nicht gefunden');
  }
}

/** Laedt eine Entity per `id` + `tenantId`; wirft NotFound bei Fremd-/Nichtexistenz. */
export async function findOneScoped<T extends ObjectLiteral>(
  repo: Repository<T>,
  user: AuthUser,
  id: string,
  notFoundMessage = 'Datensatz nicht gefunden',
): Promise<T> {
  const entity = await repo.findOne({ where: { id, tenantId: user.tenantId } as any });
  if (!entity) throw new NotFoundException(notFoundMessage);
  return entity;
}

/**
 * Validiert eine VERKNUEPFTE Fremd-ID (FK) gegen den Mandanten und liefert die Entity.
 * - `id` null/undefined/'' -> `null` (optionale FK, kein Fehler).
 * - `id` gehoert nicht zum eigenen Betrieb ODER existiert nicht -> BadRequest.
 *
 * Schuetzt vor Cross-Tenant-Reference-Injection und ist existenz-orakel-sicher
 * (gleiche Antwort fuer "fremder Betrieb" und "existiert nicht").
 */
export async function assertRefInTenant<T extends ObjectLiteral>(
  repo: Repository<T>,
  user: AuthUser,
  id: string | undefined | null,
  label = 'Referenz',
): Promise<T | null> {
  if (id === undefined || id === null || id === '') return null;
  const entity = await repo.findOne({ where: { id, tenantId: user.tenantId } as any });
  if (!entity) {
    throw new BadRequestException(`${label} gehoert nicht zum eigenen Betrieb oder existiert nicht`);
  }
  return entity;
}

/** QueryBuilder mit verpflichtendem `tenantId`-Filter als Basisbedingung. */
export function scopedQuery<T extends ObjectLiteral>(
  repo: Repository<T>,
  user: AuthUser,
  alias: string,
): SelectQueryBuilder<T> {
  return repo
    .createQueryBuilder(alias)
    .where(`${alias}.tenantId = :tenantId`, { tenantId: user.tenantId });
}
