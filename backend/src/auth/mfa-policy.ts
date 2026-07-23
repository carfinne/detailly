import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { UserRole, PLATTFORM_ROLLEN } from '../users/entities/user.entity';

/**
 * Maschinenlesbarer Fehlercode, den der JwtAuthGuard an einem geschuetzten
 * Endpunkt wirft, solange ein 2FA-pflichtiger Nutzer 2FA noch NICHT eingerichtet
 * hat. Das Frontend erkennt ihn (wie SUBSCRIPTION_INACTIVE) und lenkt auf die
 * 2FA-Einrichtung, statt den Nutzer hart auszuloggen.
 */
export const MFA_SETUP_REQUIRED_CODE = 'MFA_SETUP_REQUIRED';

/** Generische, nicht-enumerierende Meldung fuer den Erzwingungs-403. */
export const MFA_SETUP_REQUIRED_MESSAGE =
  'Zwei-Faktor-Authentifizierung ist fuer dieses Konto verpflichtend. Bitte richte sie zuerst ein.';

/**
 * Liest das Tenant-Setting `mfaPflicht` ('1' = an). Ohne Repo/tenantId (z. B. in
 * Unit-Tests, die die Strategie ohne Tenant-Repo konstruieren) -> false.
 */
export async function tenantMfaPflicht(
  tenantRepo: Repository<Tenant> | undefined,
  tenantId: string | null | undefined,
): Promise<boolean> {
  if (!tenantRepo || !tenantId) return false;
  const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
  return (tenant?.settings as Record<string, unknown> | null)?.mfaPflicht === '1';
}

/**
 * ZENTRALE Richtlinie (eine Quelle der Wahrheit fuer Login-Flags UND die
 * serverseitige Erzwingung im JwtAuthGuard): MUSS dieser Nutzer 2FA einrichten,
 * bevor er geschuetzte Endpunkte nutzen darf?
 *
 * true, wenn 2FA NICHT aktiv ist UND
 *   - der Nutzer eine PLATTFORM-Rolle hat (hart verpflichtend, UNABHAENGIG vom
 *     Tenant-Setting – Plattform-Personal = hoechstes Risiko), ODER
 *   - sein Tenant `mfaPflicht=true` gesetzt hat.
 *
 * Haendler (tenantId=null, keine Plattform-Rolle) und Betriebe ohne Pflicht sind
 * nicht betroffen. Ist 2FA bereits aktiv, gilt die Pflicht als erfuellt.
 */
export async function istMfaEinrichtungErzwungen(
  user: { role: UserRole; tenantId?: string | null; totpEnabled?: boolean },
  tenantRepo?: Repository<Tenant>,
): Promise<boolean> {
  if (user.totpEnabled) return false;
  if (PLATTFORM_ROLLEN.includes(user.role)) return true;
  return tenantMfaPflicht(tenantRepo, user.tenantId ?? null);
}
