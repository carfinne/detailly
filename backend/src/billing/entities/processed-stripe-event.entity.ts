import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Idempotenz-Speicher fuer Stripe-Webhooks: jede Stripe-`event.id` wird genau
 * EINMAL verarbeitet. Stripe sendet Events bei Timeouts/Retries mehrfach; ohne
 * diesen Schutz koennte ein (gueltig signiertes) Event erneut eingespielt werden
 * (Replay) und Seiteneffekte doppelt ausloesen.
 */
@Entity('processed_stripe_events')
export class ProcessedStripeEvent {
  /** Die Stripe-Event-ID (evt_...). Primaerschluessel -> garantiert Einmaligkeit. */
  @PrimaryColumn() id: string;

  /** Event-Typ (z. B. customer.subscription.updated) – nur zur Nachvollziehbarkeit. */
  @Column({ nullable: true }) type: string;

  @CreateDateColumn() processedAt: Date;
}
