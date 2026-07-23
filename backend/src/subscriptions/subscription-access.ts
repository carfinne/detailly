import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

/** Zugriffsstufe, die sich aus dem Abo-Status ergibt. */
export type AccessLevel = 'full' | 'warn' | 'blocked';

export interface AccessResult {
  /** `full` = freier Zugriff, `warn` = Zugriff mit Hinweis, `blocked` = gesperrt. */
  access: AccessLevel;
  status: SubscriptionStatus | 'none';
  /** Kurzer, anzeigbarer Grund (Deutsch). */
  reason: string;
}

/**
 * Status mit generellem VOLLZUGRIFF auf ALLE Module – unabhaengig vom zugewiesenen
 * Tarif: Testphase (`trial`) und Pilotbetrieb (`pilot`). Genutzt von der
 * Feature-Aufloesung (Trial/Pilot = alles offen), damit auch ein auf `pro`
 * gehaengter Pilotbetrieb die à-la-carte Add-ons (z. B. `folierung_ppf`) sieht,
 * obwohl der Add-on-Key bewusst in KEINEM Tarif steht. Rein (keine DB/`this`).
 */
export function isVollzugriffStatus(status: SubscriptionStatus | null | undefined): boolean {
  return status === SubscriptionStatus.TRIAL || status === SubscriptionStatus.PILOT;
}

/**
 * VOLLZUGRIFF fuer die Feature-Aufloesung: Trial/Pilot-Status, ABER nur solange
 * der Zugang nicht abgelaufen ist (`evaluateSubscription` != `blocked`). Ein
 * ABGELAUFENES Trial (`trialEndsAt` in der Vergangenheit) zaehlt bewusst NICHT
 * als Vollzugriff – sonst gaeben die guard-losen OEFFENTLICHEN Flaechen
 * (`hasFeatureForTenant`: Schaufenster, Tracking-/Uebergabe-Link) ein Feature
 * frei, das weder der abgelaufene Test noch der (restriktive) Tarif deckt.
 * Pilot laeuft nie ab (evaluateSubscription = full) und bleibt daher offen.
 * Rein (keine DB/`this`), `now` injizierbar fuer Tests.
 */
export function hasVollzugriff(
  sub: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  return isVollzugriffStatus(sub?.status) && evaluateSubscription(sub, now).access !== 'blocked';
}

/**
 * Leitet aus einem Abo die Zugriffsstufe ab – die einzige Stelle, an der die
 * Abo-Regeln definiert sind. Bewusst **rein** (keine DB, kein `this`), damit der
 * `SubscriptionGuard`, die API-Anzeige und Tests dieselbe Logik verwenden.
 *
 * FAIL-CLOSED (T-020, Umsatzsicherung): Betriebe OHNE Abo-Datensatz werden
 * gesperrt. Jeder Anlagepfad erzeugt heute ein Abo mit (Self-Signup: Trial,
 * Seed: aktiv, Billing-Backstop: ensureSubscription) – ein fehlender Datensatz
 * ist ein Datenfehler und darf keine unbemerkte Gratisnutzung bedeuten.
 * Login, /subscriptions/me und Billing bleiben erreichbar (deren Controller
 * stehen bewusst NICHT hinter dem SubscriptionGuard), damit ein gesperrter
 * Betrieb die Sperrseite sieht und sich per Zahlung selbst entsperren kann.
 */
export function evaluateSubscription(
  sub: Subscription | null | undefined,
  now: Date = new Date(),
): AccessResult {
  if (!sub) {
    return { access: 'blocked', status: 'none', reason: 'Kein Abo hinterlegt' };
  }

  const ms = (d: Date | null | undefined) => (d ? new Date(d).getTime() : null);
  const jetzt = now.getTime();

  switch (sub.status) {
    case SubscriptionStatus.ACTIVE:
      return { access: 'full', status: sub.status, reason: 'Abo aktiv' };

    case SubscriptionStatus.PILOT:
      // Pilotbetrieb: UNBEFRISTETER Vollzugriff. Sperrt bewusst NIE automatisch
      // (kein Datumsvergleich) – ein Pilotbetrieb faellt nicht mitten im Test raus.
      // Ende ausschliesslich durch den Betreiber (Statuswechsel im Cockpit).
      return { access: 'full', status: sub.status, reason: 'Pilotbetrieb' };

    case SubscriptionStatus.TRIAL: {
      const ende = ms(sub.trialEndsAt);
      if (ende !== null && jetzt > ende) {
        return { access: 'blocked', status: sub.status, reason: 'Testphase abgelaufen' };
      }
      return { access: 'full', status: sub.status, reason: 'Testphase aktiv' };
    }

    case SubscriptionStatus.PAST_DUE:
      return { access: 'warn', status: sub.status, reason: 'Zahlung offen' };

    case SubscriptionStatus.CANCELED: {
      // Kuendigung zum Laufzeitende: bis zum Periodenende bleibt der Zugriff bestehen.
      const ende = ms(sub.currentPeriodEnd);
      if (sub.cancelAtPeriodEnd && ende !== null && jetzt < ende) {
        return { access: 'warn', status: sub.status, reason: 'Gekuendigt – Zugang bis Laufzeitende' };
      }
      return { access: 'blocked', status: sub.status, reason: 'Abo gekuendigt' };
    }

    case SubscriptionStatus.SUSPENDED:
      return { access: 'blocked', status: sub.status, reason: 'Abo gesperrt' };

    default:
      // Unbekannter Status: bewusst NICHT aussperren. Ueber die API unerreichbar
      // (DTO-Enum-Validierung + DB-Default 'trial'); schuetzt nur im Deploy-
      // Fenster einer kuenftigen Enum-Erweiterung vor Fehlsperrungen.
      return { access: 'full', status: 'none', reason: 'Unbekannter Status' };
  }
}
