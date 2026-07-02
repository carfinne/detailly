import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum MarketplaceSettlementStatus {
  OFFEN = 'offen',
  GESTELLT = 'gestellt',
  BEZAHLT = 'bezahlt',
}

/**
 * Provisionsabrechnung des Betreibers gegenueber EINEM Haendler fuer einen
 * Zeitraum. Erfasst werden ausschliesslich VERSENDETE, noch nicht abgerechnete
 * Bestellungen; die erfassten Belege bekommen abrechnungId gesetzt ->
 * Doppelabrechnung ist strukturell ausgeschlossen.
 *
 * Die eigentliche RECHNUNG an den Haendler entsteht bewusst NICHT hier
 * (Hoheit Buchhaltung/sevDesk) - diese Entity liefert nur die belastbaren
 * Zahlen (Snapshot) und den Abwicklungsstatus.
 */
@Index(['dealerId', 'status'])
@Entity('marketplace_settlements')
export class MarketplaceSettlement {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Fortlaufende Abrechnungsnummer MA-<Jahr>-<lfd> (plattformweit, unique). */
  @Index({ unique: true })
  @Column()
  nummer: string;

  @Column() dealerId: string;

  /** Abgerechneter Zeitraum (Bestell-Eingangsdatum, inklusive). */
  @Column({ type: timestampColumnType() }) zeitraumVon: Date;
  @Column({ type: timestampColumnType() }) zeitraumBis: Date;

  /** Anzahl erfasster Bestellungen (Snapshot). */
  @Column({ default: 0 }) bestellungen: number;

  /** Summen ueber alle erfassten Bestellungen (Snapshot). */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) summeUmsatz: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) summeProvision: number;

  @Column({
    type: enumColumnType(),
    enum: MarketplaceSettlementStatus,
    default: MarketplaceSettlementStatus.OFFEN,
  })
  status: MarketplaceSettlementStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
