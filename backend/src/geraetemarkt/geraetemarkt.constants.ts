/**
 * Code-Konstanten des Geraete-Gebrauchtmarkts.
 *
 * BEWUSST KEINE DB-Enums: Alle Wertelisten sind reine Code-Konstanten +
 * varchar-Spalten. Neue Werte erfordern so KEINE Enum-Schema-Migration und
 * KEINEN Dev-Reseed (die "Reseed-Falle" bei Enum-Wert-Aenderungen, vgl.
 * EMPLOYEE_FUNKTIONEN in user.entity.ts). Die Validierung uebernehmen die DTOs
 * (@IsIn(...)), NICHT die Datenbank.
 */

/**
 * Zugelassene Geraete-Kategorien. BEWUSST NUR Ausruestung/Werkzeug – KEINE
 * Chemie-/Verbrauchsstoff-Kategorie (rechtlich heikler Weiterverkauf von
 * Gefahrstoffen wird auf dem Marktplatz nicht angeboten).
 */
export const GERAETE_KATEGORIEN = [
  'poliermaschine',
  'sauger_extraktor',
  'plotter',
  'ir_kurzwellen_trockner',
  'hebebuehne',
  'folier_werkzeug',
  'druckluft_kompressor',
  'dampfreiniger',
  'messtechnik',
  'sonstiges_geraet',
] as const;
export type GeraeteKategorie = (typeof GERAETE_KATEGORIEN)[number];

/** Zustand des Geraets. */
export const INSERAT_ZUSTAND = ['neu', 'gebraucht', 'defekt'] as const;
export type InseratZustand = (typeof INSERAT_ZUSTAND)[number];

/** Preis-Modus: fester Preis, Verhandlungsbasis oder Preis auf Anfrage. */
export const PREIS_MODUS = ['fest', 'vb', 'anfrage'] as const;
export type PreisModus = (typeof PREIS_MODUS)[number];

/** Lebenszyklus eines Inserats (vom Verkaeufer gesteuert). */
export const INSERAT_STATUS = ['aktiv', 'reserviert', 'verkauft', 'entfernt'] as const;
export type InseratStatus = (typeof INSERAT_STATUS)[number];

/** Moderations-Status (vom Betreiber gesteuert – Melde-Logik folgt in PR3). */
export const MODERATION_STATUS = ['ok', 'verborgen', 'entfernt'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

/** Melde-Gruende (Whitelist fuer POST .../melden, inkl. Chemie-Verdacht). */
export const MELDUNG_GRUND = ['chemie_verboten', 'spam', 'betrug', 'unangemessen', 'sonstiges'] as const;
export type MeldungGrund = (typeof MELDUNG_GRUND)[number];

/**
 * Sentinel-„Melder" fuer System-Meldungen (Chemie-Heuristik). Belegt die Spalten
 * melderTenantId/melderUserId, ohne einem echten Betrieb/Nutzer zu gehoeren; die
 * UNIQUE(inseratId, melderTenantId) macht die Heuristik dadurch idempotent
 * (genau EINE System-Meldung je Inserat).
 */
export const SYSTEM_MELDER_ID = 'system';

/** Bearbeitungs-Status einer Meldung. */
export const MELDUNG_STATUS = ['offen', 'erledigt', 'verworfen'] as const;
export type MeldungStatus = (typeof MELDUNG_STATUS)[number];

/** Nur diese Status gelten cross-tenant als sichtbar (Browse/Detail). */
export const SICHTBARE_STATUS: readonly InseratStatus[] = ['aktiv', 'reserviert'];

/** Standard-Laufzeit eines Inserats in Tagen (danach automatisch nicht mehr sichtbar). */
export const INSERAT_LAUFZEIT_TAGE = 90;

/** Obergrenze fuer den Preis (fit fuer numeric(10,2); Tippfehler-Schutz). */
export const MAX_INSERAT_PREIS = 1_000_000;
