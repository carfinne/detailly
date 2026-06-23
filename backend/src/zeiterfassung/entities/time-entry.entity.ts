import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

/** Stempelart: Kommen oder Gehen. */
export enum TimeEntryType {
  KOMMEN = 'kommen',
  GEHEN = 'gehen',
}

/**
 * Ein Stempel-Eintrag (Kommen/Gehen) eines Mitarbeiters, optional je Standort.
 * Tenant-getrennt: jeder Zugriff laeuft ueber tenantId.
 */
@Entity('time_entries')
export class TimeEntry {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Mitarbeiter (User.id), der gestempelt hat. */
  @Index()
  @Column() userId: string;

  /** Optionaler Standort (Location.id). */
  @Column({ nullable: true }) locationId: string;

  @Column({ type: enumColumnType(), enum: TimeEntryType })
  art: TimeEntryType;

  /** Zeitpunkt des Stempelns (Default = jetzt; von Leitung korrigierbar). */
  @Column({ type: timestampColumnType() }) zeitpunkt: Date;

  /** Markiert nachtraeglich von der Leitung erfasste/korrigierte Eintraege. */
  @Column({ default: false }) korrigiert: boolean;

  @Column({ type: 'text', nullable: true }) notiz: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
