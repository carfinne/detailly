import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Passwort-Policy (Sicherheitsaudit Welle 1, Finding A3).
 *
 * Gilt fuer alle Stellen, an denen ein NEUES Passwort gesetzt wird
 * (Registrierung, Passwort-Reset, Mitarbeiter-Anlage, Passwort setzen):
 * - Mindestlaenge 10 (vorher 8),
 * - keine Trivial-Passwoerter aus der Blocklist (case-insensitive).
 *
 * BEWUSST NICHT auf dem Login-DTO: Bestandskonten mit 8-9-Zeichen-Passwort
 * muessen sich weiter einloggen koennen; die Policy greift erst beim naechsten
 * Passwort-Wechsel.
 */
export const PASSWORT_MIN_LAENGE = 10;

export const PASSWORT_POLICY_FEHLER =
  'Dieses Passwort ist zu leicht zu erraten – bitte ein anderes waehlen.';

/**
 * Kleine, dependency-freie Blocklist der gaengigsten Trivial-Passwoerter
 * (alle Eintraege lowercase; Vergleich case-insensitive). Kuerzere Klassiker
 * (password, 123456, ...) scheitern bereits an der Mindestlaenge 10 und
 * stehen deshalb nicht hier. Das Dev-Seed-Passwort 'Detailly2026!' ist
 * ausdruecklich NICHT enthalten (erfuellt die Policy).
 */
export const PASSWORT_BLOCKLIST: ReadonlySet<string> = new Set([
  // "password"/"passwort" + Ziffern-Anhaengsel
  'password12',
  'password123',
  'password1234',
  'password12345',
  'password123!',
  'passwort12',
  'passwort123',
  'passwort1234',
  'passwort12345',
  'passwort123!',
  // reine Ziffernfolgen
  '1234567890',
  '12345678910',
  '0123456789',
  '1234512345',
  '0987654321',
  '1029384756',
  // Tastatur-Muster (QWERTY + deutsches QWERTZ)
  'qwertyuiop',
  'qwertzuiop',
  'qwertyuiop123',
  'qwertzuiop123',
  'qwerty1234',
  'qwerty12345',
  'qwertz1234',
  'qwertz12345',
  '1q2w3e4r5t',
  'q1w2e3r4t5',
  '1q2w3e4r5t6y',
  '1qaz2wsx3edc',
  // Admin-/Test-Klassiker
  'admin12345',
  'admin123456',
  'administrator',
  'root123456',
  'test123456',
  'testtest123',
  'geheim1234',
  'geheim12345',
  // deutsche Klassiker
  'willkommen',
  'willkommen1',
  'willkommen123',
  'sonnenschein',
  'hallo12345',
  'hallo123456',
  'hallohallo',
  'sommer2025',
  'sommer2026',
  'winter2025',
  'winter2026',
  'fussball123',
  'iloveyou123',
  // naheliegende Produkt-/Branchen-Passwoerter
  'detailly123',
  'detailly1234',
  'detailly2026',
  'werkstatt123',
  'autopflege123',
]);

/**
 * Custom-Validator: lehnt Passwoerter aus der Blocklist ab (case-insensitive).
 * Nicht-Strings lehnt der begleitende @IsString() ab; hier geben wir fuer
 * Nicht-Strings ebenfalls false zurueck (defensiv, keine Doppelmeldung noetig).
 */
export function IsKeinTrivialPasswort(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isKeinTrivialPasswort',
      target: object.constructor,
      propertyName,
      options: { message: PASSWORT_POLICY_FEHLER, ...validationOptions },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          return !PASSWORT_BLOCKLIST.has(value.toLowerCase());
        },
      },
    });
  };
}
