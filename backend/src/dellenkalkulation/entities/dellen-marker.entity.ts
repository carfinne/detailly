import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { decimalColumnType, jsonColumnType } from '../../common/database.types';
import type { Groessenklasse, PositionMode } from '../dellen-preis.util';

/** 3D-Weltpunkt + Oberflaechennormale (nur Visualisierung). */
export interface Position3D {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Ein Dellen-Marker einer Kalkulation. Im Einzel-Modus = eine einzelne Delle
 * (Groessenklasse + Kante/Alu/Lackschaden), im Hagel-Modus = ein Bauteil (Panel)
 * mit einer Dellen-Anzahl. Primaer am Bauteil (`bauteil` = partId, fachliche
 * Wahrheit) verankert; 3D-Position bzw. 2D-Zonen-Fallback dienen nur der
 * Visualisierung (analog DamageItem/LayerMeasurementPoint).
 *
 * `einzelpreis` wird IMMER serverseitig aus der Tenant-Preismatrix berechnet und
 * hier gespeichert – ein vom Client gesendeter Preis wird ignoriert/ueberschrieben.
 */
@Entity('dellen_marker')
@Index(['tenantId', 'kalkulationId'])
@Index(['tenantId', 'bauteil'])
export class DellenMarker {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;
  @Column() kalkulationId: string;

  // --- Bauteil-Verankerung (FACHLICHE Wahrheit) ---
  /** Kanonische partId, z.B. "tuer_vl". */
  @Column() bauteil: string;
  /** Denormalisiertes Label, z.B. "Tür vorne links". */
  @Column({ nullable: true }) bauteilLabel: string;

  // --- Positionierung: 3D ODER 2D-Fallback ---
  @Column({ default: '3d' }) positionMode: PositionMode;
  @Column({ type: jsonColumnType(), nullable: true }) position3d: Position3D | null;
  /** 2D-Zone: front|heck|links|rechts|dach. */
  @Column({ nullable: true }) ansicht2d: string;
  @Column({ type: 'float', nullable: true }) x2d: number;
  @Column({ type: 'float', nullable: true }) y2d: number;

  // --- Fachliche Attribute (Einzel-Modus) ---
  /** Groessenklasse (1euro|2euro|5euro|golfball|groesser); varchar + @IsIn. */
  @Column({ nullable: true }) groessenklasse: Groessenklasse;
  /** Kanten-/Sicken-Delle (schwerer zugaenglich -> Faktor). */
  @Column({ type: 'boolean', default: false }) kante: boolean;
  /** Aluminium-Bauteil (schwerer -> Faktor). */
  @Column({ type: 'boolean', default: false }) alu: boolean;
  /** Lackschaden vorhanden (kein reines PDR -> Aufschlag/Hinweis). */
  @Column({ type: 'boolean', default: false }) lackschaden: boolean;

  // --- Fachliche Attribute (Hagel-Modus) ---
  /** Anzahl der Dellen an diesem Bauteil (Panel-Staffel). */
  @Column({ type: 'int', nullable: true }) dellenAnzahl: number;

  /** Serverseitig berechneter Einzelpreis dieses Markers (Euro). */
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 })
  einzelpreis: string;

  @Column({ type: 'int', nullable: true }) reihenfolge: number;
  @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
