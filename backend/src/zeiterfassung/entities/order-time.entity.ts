import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Auf einen Auftrag gebuchte Arbeitszeit eines Mitarbeiters (Job-Costing:
 * "wie viele Stunden hat dieser Auftrag gekostet?").
 *
 * BEWUSST getrennt von der Stempeluhr (TimeEntry = Anwesenheit Kommen/Gehen):
 * eine Auftragszeit ist eine Dauer auf genau EINEN Auftrag. Mitarbeiter erfassen
 * ihre EIGENE Zeit; nur die Leitung darf bestehende Eintraege aendern/loeschen
 * (Schutz vor nachtraeglicher Manipulation / Arbeitszeitbetrug).
 *
 * Tenant-getrennt: jeder Zugriff laeuft ueber tenantId.
 */
@Entity('order_times')
export class OrderTime {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Auftrag, auf den die Zeit gebucht wird. */
  @Index()
  @Column() orderId: string;

  /** Mitarbeiter, dessen Arbeitszeit gebucht wird (User.id). */
  @Index()
  @Column() userId: string;

  /** Tag der Arbeitsleistung. */
  @Column({ type: timestampColumnType() }) datum: Date;

  /** Dauer in Minuten (Anzeige als Stunden). */
  @Column() minuten: number;

  @Column({ type: 'text', nullable: true }) notiz: string;

  /** User.id, der den Eintrag erfasst hat (Self oder Leitung) – fuer die Revision. */
  @Column() erfasstVon: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
