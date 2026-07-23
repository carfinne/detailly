import { SetMetadata } from '@nestjs/common';

/** Reflector-Schluessel fuer die 2FA-Erzwingungs-Ausnahme (siehe JwtAuthGuard). */
export const MFA_SETUP_EXEMPT_KEY = 'mfaSetupExempt';

/**
 * Markiert einen Endpunkt als AUSGENOMMEN von der serverseitigen 2FA-Erzwingung
 * (JwtAuthGuard). Nur fuer die wenigen Routen, die ein Nutzer OHNE eingerichtetes
 * 2FA zwingend erreichen muss, um die Pflicht zu ERFUELLEN:
 *   - GET  /auth/me            (Profil inkl. mfaPflicht-Flag laden)
 *   - POST /auth/mfa/setup     (Secret/QR erzeugen)
 *   - POST /auth/mfa/aktivieren (Code bestaetigen -> 2FA aktiv)
 *
 * BEWUSST eng: alle anderen geschuetzten Endpunkte bleiben gesperrt, bis 2FA
 * eingerichtet ist. Diese Ausnahmen oeffnen KEINE fachlichen Daten (nur das
 * eigene Profil + der 2FA-Einrichtungs-Handshake).
 */
export const MfaSetupExempt = () => SetMetadata(MFA_SETUP_EXEMPT_KEY, true);
