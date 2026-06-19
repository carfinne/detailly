import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../common/database.types';

/** Ein einzelner Schadensmarker auf der Fahrzeug-Silhouette. */
export interface SchadensMarker {
  /** Eindeutige ID des Markers (frontend-generiert). */
  id: string;
  /** Ansicht, auf der der Marker gesetzt wurde (z.B. "oben", "links"). */
  ansicht: string;
  /** Position in Prozent der SVG-Flaeche (0–100), unabhaengig von der Pixelgroesse. */
  x: number;
  y: number;
  /** Optional angeklickte Zone (z.B. "motorhaube", "tuer_vl"). */
  zone?: string;
  /** Schadensart: kratzer | delle | steinschlag | lackschaden | rost | sonstiges. */
  art: string;
  /** Schweregrad: leicht | mittel | schwer. */
  schweregrad: string;
  notiz?: string;
}

/**
 * Fahrzeugannahme-Protokoll: dokumentiert den Zustand eines Fahrzeugs bei der
 * Annahme inkl. Schadensmarker. Tenant-getrennt (Mandantentrennung).
 */
@Entity('vehicle_intakes')
export class VehicleIntake {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column() customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) orderId: string;

  /** Kilometerstand bei Annahme. */
  @Column({ type: 'int', nullable: true }) kmStand: number;

  /** Tankstand in Prozent (0–100). */
  @Column({ type: 'int', nullable: true }) tankstand: number;

  /** Schadensmarker als JSON-Liste. */
  @Column({ type: jsonColumnType(), nullable: true }) marker: SchadensMarker[];

  @Column({ type: 'text', nullable: true }) notiz: string;

  @CreateDateColumn() createdAt: Date;
}
