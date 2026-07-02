import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Ein Klick auf "Zum Haendler" (Affiliate-Auswertung). tenantId = welcher
 * Betrieb geklickt hat – NUR fuer die interne Plattform-Statistik, wird nie an
 * Haendler oder andere Betriebe herausgegeben.
 */
@Index(['productId', 'createdAt'])
@Entity('marketplace_clicks')
export class MarketplaceClick {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() productId: string;

  @Index()
  @Column() dealerId: string;

  @Column() tenantId: string;

  @CreateDateColumn() createdAt: Date;
}
