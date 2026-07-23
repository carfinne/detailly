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
