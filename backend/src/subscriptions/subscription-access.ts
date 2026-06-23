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
 * Leitet aus einem Abo die Zugriffsstufe ab – die einzige Stelle, an der die
 * Abo-Regeln definiert sind. Bewusst **rein** (keine DB, kein `this`), damit der
 * `SubscriptionGuard`, die API-Anzeige und Tests dieselbe Logik verwenden.
 *
 * Fail-open: Betriebe ohne Abo-Datensatz werden NICHT gesperrt. So bricht die
 * Migration auf das Abo-Modell keinen bestehenden Betrieb; die Sperre greift
 * nur bei ausdruecklich gekuendigten/gesperrten/abgelaufenen Abos.
 */
export function evaluateSubscription(
  sub: Subscription | null | undefined,
  now: Date = new Date(),
): AccessResult {
  if (!sub) {
    return { access: 'full', status: 'none', reason: 'Kein Abo hinterlegt' };
  }

  const ms = (d: Date | null | undefined) => (d ? new Date(d).getTime() : null);
  const jetzt = now.getTime();

  switch (sub.status) {
    case SubscriptionStatus.ACTIVE:
      return { access: 'full', status: sub.status, reason: 'Abo aktiv' };

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
      // Unbekannter Status: defensiv nicht aussperren.
      return { access: 'full', status: 'none', reason: 'Unbekannter Status' };
  }
}
