import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum BookingRequestStatus {
  NEU = 'neu',
  ANGENOMMEN = 'angenommen',
  ABGELEHNT = 'abgelehnt',
}

/**
 * Oeffentlich (ohne Login) erzeugte Online-Terminanfrage eines Endkunden.
 *
 * BEWUSST eine eigene Tabelle statt direkt Appointment/Customer: Fremd-Eingaben
 * sind untrusted/unbestaetigt und werden hier isoliert gehalten (Datensparsamkeit,
 * eigene kurze Aufbewahrung, klarer Vertrauens-Uebergang beim "Annehmen"). Erst
 * beim Annehmen entsteht ein echtes Appointment (+ optional Customer).
 *
 * tenantId wird IMMER serverseitig aus dem Slug gesetzt – nie aus dem Request-Body.
 */
@Entity('booking_requests')
export class BookingRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  // --- Kontakt (untrusted Fremd-Eingabe) ---
  @Column() name: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;

  // --- Anliegen ---
  /** Optional gewaehlte Leistung – serverseitig gegen den Betrieb validiert. */
  @Column({ nullable: true }) serviceItemId: string;
  /** Denormalisierter Name der Leistung (Snapshot, falls Leistung spaeter entfernt wird). */
  @Column({ nullable: true }) serviceName: string;
  @Column({ type: 'text', nullable: true }) fahrzeug: string;
  @Column({ type: timestampColumnType(), nullable: true }) wunschtermin: Date;
  @Column({ type: 'text', nullable: true }) nachricht: string;

  @Column({
    type: enumColumnType(),
    enum: BookingRequestStatus,
    default: BookingRequestStatus.NEU,
  })
  status: BookingRequestStatus;

  /**
   * Nicht-erratbare oeffentliche Referenz, die dem Kunden als Bestaetigung gezeigt
   * wird (kein fortlaufender Zaehler -> kein Rueckschluss auf das Anfrage-Volumen).
   */
  @Index()
  @Column() reference: string;

  /** Datensparsamkeit: Quell-IP NUR gehasht (Spam-Forensik), nie im Klartext. */
  @Column({ nullable: true }) sourceIpHash: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
