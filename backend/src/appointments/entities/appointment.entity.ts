import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum AppointmentStatus {
  GEPLANT = 'geplant',
  BESTAETIGT = 'bestaetigt',
  // Termin laeuft gerade (echter 5. Status): blockt Slots und zaehlt wie
  // `bestaetigt` als aktiv (Doppelbuchungs-Schutz, Auswertungen, iCal CONFIRMED).
  LAEUFT = 'laeuft',
  ABGESCHLOSSEN = 'abgeschlossen',
  ABGESAGT = 'abgesagt',
}

// Composite-Index fuer das Kalender-Muster WHERE tenantId AND start BETWEEN.
@Index(['tenantId', 'start'])
@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column({ nullable: true }) orderId: string;
  @Column({ nullable: true }) customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) assignedUserId: string;
  @Column({ nullable: true }) locationId: string;

  @Column() titel: string;

  @Column({ type: timestampColumnType() }) start: Date;
  @Column({ type: timestampColumnType() }) ende: Date;

  @Column({ type: enumColumnType(), enum: AppointmentStatus, default: AppointmentStatus.GEPLANT })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true }) notiz: string;

  /**
   * Zeitpunkt, zu dem die automatische Termin-Erinnerung an den Endkunden
   * versendet wurde (Doppelversand-Schutz). NULL = noch nicht erinnert. Der
   * Erinnerungs-Scheduler "claimt" diese Spalte konditional (WHERE ... IS NULL),
   * bevor er sendet -> jede Erinnerung geht garantiert nur EINMAL raus.
   */
  @Column({ type: timestampColumnType(), nullable: true }) erinnerungGesendetAm: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
