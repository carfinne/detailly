/**
 * Textbausteine der Sicherheits-Benachrichtigungen an den Nutzer (Paket 1).
 *
 * Reine, dependency-freie Text-Builder (kein I/O) -> direkt unit-testbar.
 *
 * Sprache: fest verdrahtetes Deutsch – bewusst KEIN i18n. Grund: die bestehenden
 * Konto-/Plattform-Mails im Projekt (Passwort-Reset + E-Mail-Bestaetigung in
 * auth.service.ts, Status-Mails in orders.service.ts) sind ebenfalls fest deutsch
 * verdrahtet; es gibt keinen Mail-i18n-Mechanismus im Backend. Wir folgen dem
 * vorhandenen Muster, statt einen neuen zu erfinden (s. Auftrag). Anrede in der
 * „Sie"-Form (formaler, ernster Ton fuer Sicherheitshinweise; deckt sich mit dem
 * vom Auftrag vorgegebenen Standardsatz).
 *
 * WICHTIG (Anti-Phishing): Diese Mails enthalten NIEMALS einen Link. Der Nutzer
 * wird angewiesen, Detailly selbst aufzurufen. Zusaetzlich der Standardsatz, dass
 * Detailly nie per E-Mail nach dem Passwort fragt.
 */

/** Sicherheitsrelevante Konto-Ereignisse mit fester Empfaenger-Adresse (der Nutzer). */
export type AccountSecurityEvent =
  | 'passwort_geaendert'
  | 'mfa_aktiviert'
  | 'mfa_deaktiviert'
  | 'ueberall_abgemeldet';

export interface AccountSecurityMail {
  subject: string;
  text: string;
}

/**
 * Deterministische, ICU-freie deutsche Zeitangabe „TT.MM.JJJJ um HH:MM Uhr"
 * (lokale Serverzeit). Bewusst manuell formatiert, damit die Ausgabe nicht von
 * der (in CI evtl. abgespeckten) Intl/ICU-Datenlage abhaengt.
 */
export function formatZeitpunkt(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return (
    `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()} ` +
    `um ${z(d.getHours())}:${z(d.getMinutes())} Uhr`
  );
}

/** Gemeinsamer Anti-Phishing-Fuss (kein Link, „fragt nie nach dem Passwort"). */
const PHISHING_HINWEIS =
  'Zu Ihrer Sicherheit: Detailly fragt Sie NIE per E-Mail nach Ihrem Passwort ' +
  'und schickt Ihnen in dieser Nachricht bewusst KEINEN Link. Klicken Sie nie ' +
  'auf Passwort-Links in unerwarteten E-Mails.';

/** Standard-Handlungsanweisung, falls der Nutzer das Ereignis NICHT selbst war. */
const WENN_NICHT_SIE =
  'Falls Sie das NICHT waren:\n' +
  '- Oeffnen Sie Detailly selbst (Adresse von Hand eintippen oder Ihr Lesezeichen ' +
  'nutzen) und setzen Sie Ihr Passwort sofort neu.\n' +
  '- Wenden Sie sich anschliessend an Ihren Betrieb oder an den Support.';

const GRUSS = 'Viele Gruesse\nIhr Detailly-Team';

function hallo(firstName?: string | null): string {
  const name = (firstName ?? '').trim();
  return name ? `Hallo ${name},` : 'Hallo,';
}

function rahmen(firstName: string | null | undefined, kern: string): string {
  return `${hallo(firstName)}\n\n${kern}\n\n${WENN_NICHT_SIE}\n\n${PHISHING_HINWEIS}\n\n${GRUSS}`;
}

/**
 * Baut Betreff + Text der Sicherheits-Benachrichtigung fuer die Ereignisse mit
 * genau einem Empfaenger (der Nutzer selbst). E-Mail-Aenderung -> eigener Builder
 * (zwei Empfaenger), s. buildEmailChangedMail.
 */
export function buildAccountSecurityMail(
  event: AccountSecurityEvent,
  ctx: { firstName?: string | null; when: Date },
): AccountSecurityMail {
  const wann = formatZeitpunkt(ctx.when);
  switch (event) {
    case 'passwort_geaendert':
      return {
        subject: 'Sicherheitshinweis: Ihr Passwort wurde geaendert',
        text: rahmen(
          ctx.firstName,
          `am ${wann} wurde das Passwort Ihres Detailly-Kontos geaendert.\n\n` +
            'Wenn Sie das selbst waren, ist alles in Ordnung – Sie muessen nichts weiter tun.',
        ),
      };
    case 'mfa_aktiviert':
      return {
        subject: 'Sicherheitshinweis: Zwei-Faktor-Schutz aktiviert',
        text: rahmen(
          ctx.firstName,
          `am ${wann} wurde die Zwei-Faktor-Sicherung (zusaetzlicher Code beim ` +
            'Anmelden) fuer Ihr Detailly-Konto aktiviert.\n\n' +
            'Wenn Sie das selbst eingerichtet haben, ist alles in Ordnung.',
        ),
      };
    case 'mfa_deaktiviert':
      return {
        subject: 'Sicherheitshinweis: Zwei-Faktor-Schutz deaktiviert',
        text: rahmen(
          ctx.firstName,
          `am ${wann} wurde die Zwei-Faktor-Sicherung fuer Ihr Detailly-Konto ` +
            'deaktiviert. Ihr Konto ist damit nur noch durch Ihr Passwort geschuetzt.\n\n' +
            'Wenn Sie das selbst ausgeloest haben, ist alles in Ordnung.',
        ),
      };
    case 'ueberall_abgemeldet':
      return {
        subject: 'Sicherheitshinweis: Auf allen Geraeten abgemeldet',
        text: rahmen(
          ctx.firstName,
          `am ${wann} wurden alle Anmeldungen Ihres Detailly-Kontos beendet – auf ` +
            'allen Geraeten. Beim naechsten Mal muessen Sie sich neu anmelden.\n\n' +
            'Wenn Sie das selbst ausgeloest haben, ist alles in Ordnung.',
        ),
      };
  }
}

/**
 * Baut die Benachrichtigung fuer eine E-Mail-Adressaenderung. Wird fuer BEIDE
 * Adressen erzeugt (`ziel: 'alt' | 'neu'`), damit ein Opfer auch dann gewarnt
 * wird, wenn ein Angreifer die Adresse uebernimmt: die alte Adresse erfaehrt vom
 * Wechsel, die neue bestaetigt ihn.
 */
export function buildEmailChangedMail(ctx: {
  firstName?: string | null;
  when: Date;
  altEmail: string;
  neuEmail: string;
  ziel: 'alt' | 'neu';
}): AccountSecurityMail {
  const wann = formatZeitpunkt(ctx.when);
  const kern =
    ctx.ziel === 'alt'
      ? `am ${wann} wurde die E-Mail-Adresse Ihres Detailly-Kontos von ${ctx.altEmail} ` +
        `auf ${ctx.neuEmail} geaendert. Diese Nachricht geht an Ihre BISHERIGE Adresse.\n\n` +
        'Wenn Sie das selbst veranlasst haben, ist alles in Ordnung.'
      : `am ${wann} wurde diese Adresse (${ctx.neuEmail}) als neue Anmelde-Adresse fuer ` +
        `Ihr Detailly-Konto hinterlegt (bisher: ${ctx.altEmail}).\n\n` +
        'Wenn Sie das selbst veranlasst haben, ist alles in Ordnung.';
  return {
    subject: 'Sicherheitshinweis: E-Mail-Adresse Ihres Kontos geaendert',
    text: rahmen(ctx.firstName, kern),
  };
}
