import { istFestgesetzt, statuswechselErlaubt } from './invoice-rules';
import { InvoiceKind, InvoiceStatus } from './entities/invoice.entity';

const R = InvoiceKind.RECHNUNG;
const A = InvoiceKind.ANGEBOT;
const { ENTWURF, OFFEN, BEZAHLT, STORNIERT } = InvoiceStatus;

describe('GoBD-Regeln · istFestgesetzt', () => {
  it('Rechnung im Entwurf ist NICHT festgesetzt (aenderbar)', () => {
    expect(istFestgesetzt(R, ENTWURF)).toBe(false);
  });
  it('gestellte/bezahlte/stornierte Rechnung ist festgesetzt (unveraenderlich)', () => {
    expect(istFestgesetzt(R, OFFEN)).toBe(true);
    expect(istFestgesetzt(R, BEZAHLT)).toBe(true);
    expect(istFestgesetzt(R, STORNIERT)).toBe(true);
  });
  it('Angebote sind nie festgesetzt (frei aenderbar)', () => {
    expect(istFestgesetzt(A, OFFEN)).toBe(false);
    expect(istFestgesetzt(A, BEZAHLT)).toBe(false);
  });
});

describe('GoBD-Regeln · statuswechselErlaubt', () => {
  it('Angebote: jeder Wechsel erlaubt', () => {
    expect(statuswechselErlaubt(A, ENTWURF, BEZAHLT)).toBe(true);
    expect(statuswechselErlaubt(A, BEZAHLT, ENTWURF)).toBe(true);
  });

  it('Rechnung: erlaubte Vorwaerts-Wege', () => {
    expect(statuswechselErlaubt(R, ENTWURF, OFFEN)).toBe(true); // festsetzen
    expect(statuswechselErlaubt(R, ENTWURF, STORNIERT)).toBe(true); // Entwurf verwerfen
    expect(statuswechselErlaubt(R, OFFEN, BEZAHLT)).toBe(true);
    expect(statuswechselErlaubt(R, OFFEN, STORNIERT)).toBe(true);
    expect(statuswechselErlaubt(R, BEZAHLT, STORNIERT)).toBe(true); // Storno
  });

  it('Rechnung: verbotene Rueckwaerts-/Sprung-Wege', () => {
    expect(statuswechselErlaubt(R, ENTWURF, BEZAHLT)).toBe(false); // ohne Festsetzung
    expect(statuswechselErlaubt(R, OFFEN, ENTWURF)).toBe(false); // kein Zurueck
    expect(statuswechselErlaubt(R, BEZAHLT, OFFEN)).toBe(false);
    expect(statuswechselErlaubt(R, BEZAHLT, ENTWURF)).toBe(false);
    expect(statuswechselErlaubt(R, STORNIERT, OFFEN)).toBe(false); // terminal
  });

  it('idempotenter Wechsel auf denselben Status ist erlaubt', () => {
    expect(statuswechselErlaubt(R, OFFEN, OFFEN)).toBe(true);
  });
});
