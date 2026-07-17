import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Produkt-Bewertung im B2B-Marktplatz. Bewertet wird von einem BETRIEB
 * (tenantId = bewertender Mandant, userId = handelnder Nutzer) – nicht von
 * Endkunden. Genau EINE Bewertung je (Produkt, Betrieb) ist zulaessig
 * (UNIQUE productId+tenantId): Nachbesserung = Update statt Zweit-Review.
 *
 * `verifiziert` markiert Bewertungen aus einer nachweisbaren In-App-Bestellung.
 * `aktiv` ist der Moderations-Schalter (Betreiber kann ausblenden, ohne zu
 * loeschen). Der denormalisierte Schnitt/Anzahl liegt am Produkt
 * (bewertungSchnitt/bewertungAnzahl) und wird in spaeteren PRs fortgeschrieben.
 */
@Index(['productId', 'aktiv'])
@Unique('UQ_marketplace_reviews_product_tenant', ['productId', 'tenantId'])
@Entity('marketplace_reviews')
export class MarketplaceReview {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() productId: string;

  /** Bewertender Betrieb (Mandant) – Basis der Ein-Bewertung-je-Betrieb-Regel. */
  @Column() tenantId: string;

  /** Nutzer, der die Bewertung abgegeben hat (Nachvollziehbarkeit). */
  @Column() userId: string;

  /** Sterne 1–5 (Wertebereich wird per DTO/@IsIn in spaeteren PRs erzwungen). */
  @Column({ type: 'int' }) sterne: number;

  @Column({ type: 'text', nullable: true }) text: string | null;

  /** Bewertung stammt aus einer nachgewiesenen In-App-Bestellung. */
  @Column({ default: false }) verifiziert: boolean;

  /** Moderation: false = ausgeblendet (nicht geloescht). */
  @Column({ default: true }) aktiv: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
