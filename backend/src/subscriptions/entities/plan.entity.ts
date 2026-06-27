import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { jsonColumnType } from '../../common/database.types';

/**
 * Grenzwerte eines Tarifs. `null`/fehlend bedeutet "unbegrenzt".
 * Wird (vorerst) informativ im Tarif gespeichert; die serverseitige
 * Durchsetzung der Limits ist ein separater, spaeterer Schritt.
 */
export interface PlanLimits {
  maxUsers?: number | null;
  maxLocations?: number | null;
  maxCustomers?: number | null;
}

/**
 * Tarif-Definition (Preisstufe des SaaS-Angebots).
 * Tarife werden vom Detailly-Betreiber (super_admin) gepflegt und einem
 * Betrieb ueber eine `Subscription` zugewiesen.
 */
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Stabiler technischer Schluessel (z. B. `basic`, `pro`, `enterprise`). */
  @Column({ unique: true }) slug: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  /** Monatlicher Preis. Decimal kommt als String aus der DB (wie ueberall im Projekt). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) preisMonatlich: number;

  /** Jaehrlicher Preis (Anzeige). Idee: ~2 Monate gratis = preisMonatlich * 10. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) preisJaehrlich: number;

  @Column({ default: 'EUR' }) waehrung: string;

  /** Freigeschaltete Modul-Schluessel (z. B. ['zeiterfassung','shop']). */
  @Column({ type: jsonColumnType(), nullable: true }) features: string[];

  @Column({ type: jsonColumnType(), nullable: true }) limits: PlanLimits;

  /**
   * Stripe-Price-ID dieses Tarifs (z. B. `price_123…`). Vom Betreiber im
   * Tarif-Editor gepflegt; der Preis selbst lebt in Stripe. Ohne diese ID ist
   * der Tarif nicht per Self-Service buchbar.
   */
  @Column({ nullable: true }) stripePriceId: string;

  /** Stripe-Price-ID fuer die jaehrliche Zahlweise (optional). */
  @Column({ nullable: true }) stripePriceIdYearly: string;

  /** Wird der Tarif noch zur Neuvergabe angeboten? */
  @Column({ default: true }) istAktiv: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
