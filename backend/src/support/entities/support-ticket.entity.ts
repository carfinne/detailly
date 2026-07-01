import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum TicketStatus {
  OFFEN = 'offen',
  BEANTWORTET = 'beantwortet',
  GESCHLOSSEN = 'geschlossen',
}

export enum TicketKategorie {
  FRAGE = 'frage',
  PROBLEM = 'problem',
  IDEE = 'idee',
  ABRECHNUNG = 'abrechnung',
}

/**
 * Support-Anfrage eines Kunden (Betriebs) an Detailly. Der Verlauf haengt als
 * SupportMessage-Zeilen daran. Kunden sehen nur die Tickets des eigenen
 * Betriebs; die Plattform-Rollen (Detailly) sehen alle.
 */
@Index(['tenantId', 'updatedAt'])
@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** User.id des Erstellers (Kunde). */
  @Column() createdByUserId: string;

  @Column({ length: 150 }) betreff: string;

  @Column({ type: enumColumnType(), enum: TicketKategorie, default: TicketKategorie.FRAGE })
  kategorie: TicketKategorie;

  @Column({ type: enumColumnType(), enum: TicketStatus, default: TicketStatus.OFFEN })
  status: TicketStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
