import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType, timestampColumnType, jsonColumnType } from '../../common/database.types';

/**
 * Lebenszyklus eines Abos.
 * - `trial`      Testphase (Zugriff bis `trialEndsAt`)
 * - `active`     bezahltes, laufendes Abo
 * - `past_due`   Zahlung offen -> Zugriff mit Warnung
 * - `canceled`   gekuendigt (ggf. noch bis Laufzeitende nutzbar)
 * - `suspended`  vom Betreiber gesperrt -> Zugriff geblockt
 * - `pilot`      Pilotbetrieb (Betreiber-freigeschaltet): UNBEFRISTETER
 *                Vollzugriff, sperrt NIE automatisch (ignoriert trialEndsAt) –
 *                laeuft, bis der Betreiber den Status aktiv beendet. Fuer echte
 *                Pilot-Betriebe, die nicht mitten im Test rausfliegen duerfen.
 */
export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended',
  PILOT = 'pilot',
}

/**
 * Abo-Status, die einen Betrieb OEFFENTLICH sichtbar machen (Betriebskarte,
 * Mitglieder-Verzeichnis, oeffentliche Suche). GENAU zwei Zustaende:
 *  - `active` – bezahltes, laufendes Abo.
 *  - `pilot`  – vom Betreiber freigeschalteter, ECHTER Pilotbetrieb (unbefristeter
 *               Vollzugriff). Waehrend des Pilotprogramms sind das reale Betriebe;
 *               ohne sie bliebe die Karte den ganzen Pilotbetrieb ueber leer.
 *
 * BEWUSST NICHT `trial`: die 14-Tage-Testphase ist zu fluechtig – ein Tester soll
 * nicht im oeffentlichen Verzeichnis auftauchen und nach Ablauf wieder verschwinden.
 * `past_due`/`canceled`/`suspended` sind ohnehin kein aktiver, vorzeigbarer Zustand.
 *
 * EINE Quelle der Wahrheit fuer Karte UND Liste UND Suche, damit alle drei exakt
 * dieselbe Betriebs-Menge zeigen. Opt-in (settings.mitgliedProfil.zeigen) bleibt
 * IMMER zusaetzliche Pflicht – dieser Filter ersetzt es nie.
 */
export const OEFFENTLICH_SICHTBARE_ABO_STATUS: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PILOT,
];

/**
 * Grobe Kategorie eines Kuendigungsgrundes (Selbstkuendigung). BEWUSST KEIN
 * DB-Enum, sondern eine Code-Konstante + varchar-Spalte (wie EMPLOYEE_FUNKTIONEN):
 * neue Werte erfordern so keine Enum-Schema-Migration und keinen Dev-Reseed. Die
 * Validierung uebernimmt das DTO (@IsIn). Der Grund ist FREIWILLIG – die Spalte
 * bleibt nullable, die Kuendigung funktioniert ohne jede Angabe.
 */
export const KUENDIGUNG_GRUND_KATEGORIEN = [
  'zu_teuer', // zu teuer / Preis-Leistung
  'funktion_fehlt', // benoetigte Funktion fehlt
  'zu_kompliziert', // zu kompliziert / Bedienung
  'betrieb_aufgegeben', // Betrieb eingestellt / kein Bedarf mehr
  'wechsel_wettbewerb', // Wechsel zu einem Wettbewerber
  'sonstiges', // sonstiger Grund (Freitext)
] as const;
export type KuendigungGrundKategorie = (typeof KUENDIGUNG_GRUND_KATEGORIEN)[number];

/**
 * Das Abo eines Betriebs (Tenant). Pro Tenant gibt es genau einen aktuellen
 * Datensatz; das Abo haengt bewusst am Tenant, nicht am Standort.
 */
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Welcher Betrieb. Genau ein Abo-Datensatz pro Tenant. */
  @Column({ unique: true }) tenantId: string;

  /** Zugewiesener Tarif (kann offen sein, solange noch keiner gewaehlt wurde). */
  @Column({ nullable: true }) planId: string;

  @Column({ type: enumColumnType(), enum: SubscriptionStatus, default: SubscriptionStatus.TRIAL })
  status: SubscriptionStatus;

  @Column({ nullable: true, type: timestampColumnType() }) trialEndsAt: Date;

  @Column({ nullable: true, type: timestampColumnType() }) currentPeriodStart: Date;

  @Column({ nullable: true, type: timestampColumnType() }) currentPeriodEnd: Date;

  @Column({ nullable: true, type: timestampColumnType() }) canceledAt: Date;

  /** Kuendigung zum Laufzeitende (bis dahin bleibt der Zugriff bestehen). */
  @Column({ default: false }) cancelAtPeriodEnd: boolean;

  /**
   * Zeitpunkt, zu dem der einmalige Gratismonat (Halte-Angebot) EINGELOEST wurde.
   * `null` = noch nie in Anspruch genommen -> Angebot wird beim Kuendigungsversuch
   * gezeigt; gesetzt = verbraucht -> Angebot erscheint nie wieder (nur noch die
   * Grund-Frage). Das Abo ist unique pro Tenant, also ist dieser Marker exakt
   * "einmal pro Betrieb". Race-sicher gesetzt per atomarem konditionalem UPDATE
   * (`... WHERE halteangebotGenutztAt IS NULL`), damit zwei gleichzeitige Klicks
   * NICHT zwei Monate gewaehren. Wird bei Tarifzuweisung/-wechsel BEWUSST nie
   * zurueckgesetzt (lebenslanger Einmal-Anspruch).
   */
  @Column({ nullable: true, type: timestampColumnType() }) halteangebotGenutztAt: Date;

  /**
   * FREIWILLIGE grobe Kategorie des Kuendigungsgrundes (siehe
   * KUENDIGUNG_GRUND_KATEGORIEN). varchar statt DB-Enum -> keine Enum-Migration/kein
   * Reseed bei neuen Werten. `null` = keine Angabe. Wird dem Betreiber in der
   * Plattform-Analyse ausgewertet (Kuendigungsgruende nach Kategorie).
   */
  @Column({ nullable: true }) kuendigungGrundKategorie: string;

  /**
   * FREIWILLIGER Freitext des Kuendigungsgrundes (Verbesserungsvorschlag). `null` =
   * keine Angabe. Wenn der Betrieb den Grund als loesbares Problem markiert, wird
   * zusaetzlich ein Support-Ticket erzeugt (bestehender Support-Kanal); dieser Text
   * bleibt hier fuer die Betreiber-Auswertung erhalten.
   */
  @Column({ type: 'text', nullable: true }) kuendigungGrundText: string;

  /** Interne Notiz des Betreibers (z. B. Grund einer Sperre). */
  @Column({ type: 'text', nullable: true }) notiz: string;

  /**
   * Gebuchte à-la-carte Add-on-Feature-Keys (z. B. ['folierung_ppf']). Werden zu
   * den Tarif-Features hinzu-gemergt (effektive Entitlements, siehe
   * `hasEffectiveFeature`). `null`/leer = keine Add-ons. Additiv – kein Basistarif
   * fuehrt diese Keys; sie werden separat verkauft (Preis: ADDON_CATALOG).
   */
  @Column({ type: jsonColumnType(), nullable: true }) addons: string[];

  /** Verknuepfung zu Stripe (gesetzt, sobald der Betrieb per Self-Service bucht). */
  @Column({ nullable: true }) stripeCustomerId: string;
  @Column({ nullable: true }) stripeSubscriptionId: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
