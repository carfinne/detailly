import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum AutorTyp {
  KUNDE = 'kunde',
  DETAILLY = 'detailly',
}

/** Eine Nachricht im Verlauf eines Support-Tickets (Kunde oder Detailly). */
@Index(['ticketId', 'createdAt'])
@Entity('support_messages')
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column() ticketId: string;

  @Column({ type: enumColumnType(), enum: AutorTyp })
  autorTyp: AutorTyp;

  /** Anzeigename als Snapshot (ueberlebt User-Aenderungen, kein Lookup noetig). */
  @Column() autorName: string;

  @Column({ type: 'text' }) text: string;

  @CreateDateColumn() createdAt: Date;
}
