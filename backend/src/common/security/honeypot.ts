import type { SecurityEventService } from '../../security/security-event.service';

/**
 * Gemeinsamer Honeypot-Baustein fuer die OEFFENTLICHEN, unauthentifizierten
 * Schreib-Formulare (Terminanfrage, Newsletter-Anmeldung, Haendler-Bewerbung,
 * Betriebs-Selbstregistrierung).
 *
 * Verhalten (extrahiert aus tenants.controller / public-booking.service /
 * public-newsletter.controller / marketplace.service – dort war das Muster bis
 * hierher vierfach dupliziert):
 *  - Ein per CSS verstecktes Feld `website`. Menschen lassen es leer; viele Bots
 *    fuellen JEDES Feld -> ein gefuelltes Feld ist ein starkes Bot-Signal.
 *  - Dem Bot gegenueber wird ERFOLG vorgetaeuscht (kein Fehler, keine abweichende
 *    Antwort-Form), damit er nicht lernt, erkannt worden zu sein, und seine
 *    Payload nicht variiert. Es wird NICHTS gespeichert und NICHTS versendet.
 *  - Jeder Treffer wird als Sicherheits-Ereignis (`honeypot`) protokolliert, damit
 *    die Bedrohungserkennung und das Betreiber-Cockpit ihn sehen. Das Logging ist
 *    fire-and-forget (der SecurityEventService faengt jeden Fehler selbst ab) und
 *    darf den Request NIE blockieren oder werfen.
 *
 * ZEITFALLE (Formulare, die in < ~2s abgeschickt werden = Bot): BEWUSST NICHT
 * umgesetzt. Sie braucht einen serverseitig ausgestellten Zeitstempel, den der
 * Client beim Absenden zuruecksenden muss. Die drei Zielformulare haben aber
 * keinen gemeinsamen "Formular-Laden"-Endpunkt, ueber den ein solcher Stempel
 * sauber ausgegeben werden koennte (Newsletter/Bewerbung haben gar kein GET;
 * das Buchungs-GET muesste den Stempel durch drei verschiedene Frontend-
 * Oberflaechen zurueckgereicht bekommen). Das verkompliziert das statisch
 * exportierte Next.js-Frontend deutlich, waehrend der Nutzen neben Honeypot +
 * @Throttle + LoginGuard + ThreatDetection gering ist. Daher weggelassen und
 * hier dokumentiert (statt eine ungenutzte, nur scheinbar wirksame Mechanik
 * einzubauen).
 */

/** Einheitlicher Feldname des versteckten Honeypot-Felds ueber ALLE Formulare. */
export const HONEYPOT_FELD = 'website' as const;

/**
 * Quelle eines Honeypot-Treffers – nicht-sensibler Kontext fuer das
 * Security-Event (NIE Body-Inhalte/E-Mail/Name). Erlaubt dem Betreiber-Cockpit,
 * Bot-Traffic je Formular zu unterscheiden.
 */
export type HoneypotQuelle =
  | 'public_booking'
  | 'public_newsletter'
  | 'haendler_bewerbung'
  | 'tenant_register';

/**
 * Prueft, ob das versteckte Honeypot-Feld gefuellt ist (Bot-Signal). REIN (ohne
 * I/O) -> direkt testbar. Nicht-Strings und reiner Whitespace gelten als leer,
 * damit ein legitimes (leeres) Absenden nie faelschlich als Bot gewertet wird.
 */
export function istHoneypotGefuellt(wert: unknown): boolean {
  return typeof wert === 'string' && wert.trim().length > 0;
}

/**
 * Protokolliert einen Honeypot-Treffer als Sicherheits-Ereignis (fire-and-forget).
 * Traegt NUR nicht-sensiblen Kontext (`quelle`) + die IP (personenbezogen ->
 * Auto-Purge des SecurityEventService greift; Rechtsgrundlage Art. 6 Abs. 1 lit. f
 * DSGVO, IT-Sicherheit). NIE Body-Inhalte, E-Mail-Klartext, Namen oder Tokens.
 *
 * `events` ist optional: fehlt der Dienst (z. B. in einem reinen Unit-Test, der
 * ihn nicht injiziert), passiert nichts – die Abwehr selbst (Erfolg vortaeuschen,
 * nichts anlegen) bleibt davon unberuehrt.
 */
export function protokolliereHoneypotTreffer(
  events: SecurityEventService | undefined | null,
  quelle: HoneypotQuelle,
  ip?: string | null,
): void {
  events?.record({
    type: 'honeypot',
    severity: 'warn',
    ip: ip ?? null,
    details: { quelle },
  });
}
