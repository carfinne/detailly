/**
 * Widerrufsbelehrung + Muster-Widerrufsformular fuer die oeffentliche
 * Buchungsseite im VERBINDLICHEN Modus (Fernabsatz, §312g/§355 BGB).
 *
 * WICHTIG: amtlicher MUSTERTEXT (Anlage 1/2 zu Art. 246a §1 Abs. 2 EGBGB) mit
 * eingesetzten Betriebsdaten – KEINE Rechtsberatung. Der Text bleibt DEUTSCH und
 * wird NICHT uebersetzt (nur die UI-Chrome ist i18n). Er MUSS wortgleich zum
 * Backend bleiben (backend/src/common/booking/widerruf.ts) – dieselbe Quelle
 * speist dort die §312f-Bestaetigungs-Mail.
 */

/** Widerrufsfrist bei Fernabsatzvertraegen (§355 Abs. 2 BGB). */
export const WIDERRUFSFRIST_TAGE = 14;

export interface WiderrufBetrieb {
  name: string;
  strasse: string;
  plzOrt: string;
  land: string;
  telefon: string;
  email: string;
}

/**
 * Beginnt die Leistung VOR Ablauf der Widerrufsfrist (Termin < jetzt + 14 Tage)?
 * Dann braucht es die §356-Abs.-4-Zustimmung. Ohne Termin: false.
 */
export function istInnerhalbWiderrufsfrist(termin: Date | null | undefined): boolean {
  if (!termin) return false;
  const t = termin instanceof Date ? termin : new Date(termin);
  if (Number.isNaN(t.getTime())) return false;
  const fristEnde = Date.now() + WIDERRUFSFRIST_TAGE * 24 * 60 * 60 * 1000;
  return t.getTime() < fristEnde;
}

function anschriftZeile(b: WiderrufBetrieb): string {
  return [b.name, b.strasse, b.plzOrt, b.land].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
}

function kontaktZusatz(b: WiderrufBetrieb): string {
  const teile: string[] = [];
  if (b.telefon?.trim()) teile.push(`Telefon: ${b.telefon.trim()}`);
  if (b.email?.trim()) teile.push(`E-Mail: ${b.email.trim()}`);
  return teile.join(', ');
}

/** Amtliche Widerrufsbelehrung (Muster Anlage 1) – Absaetze als string[]. */
export function baueWiderrufsbelehrung(b: WiderrufBetrieb): string[] {
  const empfaenger = [anschriftZeile(b), kontaktZusatz(b)].filter(Boolean).join(', ');
  return [
    'Widerrufsbelehrung',
    'Widerrufsrecht',
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
    `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${empfaenger}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
    'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
    'Folgen des Widerrufs',
    'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
    'Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.',
    'Ihr Widerrufsrecht erlischt vorzeitig, wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche Zustimmung gegeben haben und gleichzeitig Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren.',
  ];
}

/** Amtliches Muster-Widerrufsformular (Anlage 2) – Zeilen als string[]. */
export function baueMusterWiderrufsformular(b: WiderrufBetrieb): string[] {
  const empfaenger = [anschriftZeile(b), kontaktZusatz(b)].filter(Boolean).join(', ');
  return [
    'Muster-Widerrufsformular',
    '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
    `An: ${empfaenger}`,
    'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:',
    '_______________________________________________',
    'Bestellt am (*)/erhalten am (*): _______________',
    'Name des/der Verbraucher(s): ___________________',
    'Anschrift des/der Verbraucher(s): ______________',
    'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________',
    'Datum: _______________',
    '(*) Unzutreffendes streichen.',
  ];
}
