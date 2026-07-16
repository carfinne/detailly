import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType } from '../../common/database.types';

/** 3D-Weltpunkt + Oberflaechennormale (nur Visualisierung). */
export interface Position3D {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

/** Eine einzelne µm-Messung an einem Punkt (mehrere je Punkt moeglich). */
export interface LayerReading {
  /** Gemessene Schichtdicke in Mikrometer. */
  wertUm: number;
  /** ISO-Zeitstempel der Messung (Client-gesetzt, Beweis-/Sortier-Zweck). */
  erfasstAm?: string;
}

/** Standard- (vordefinierter) oder frei gesetzter Messpunkt. */
export type LayerPointTyp = 'standard' | 'frei';

/**
 * Ein Messpunkt eines Schichtdicken-Protokolls, an einem Bauteil (`partId`,
 * fachliche Wahrheit) verankert. Die µm-Einzelmessungen liegen als JSON-Array
 * `readings` direkt am Punkt (der Punkt ist die Sync-/Aggregations-Einheit;
 * Aggregate min/mean/max je Punkt/Bauteil werden daraus abgeleitet).
 *
 * Eigene Tabelle (nicht in den Kopf eingebettet), damit Punkte einzeln
 * referenzierbar, konfliktarm synchronisierbar (clientUuid) und je Bauteil
 * indexierbar sind – analog DamageItem.
 */
@Entity('layer_measurement_points')
@Index(['tenantId', 'measurementId'])
@Index(['tenantId', 'partId'])
export class LayerMeasurementPoint {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;
  @Column() measurementId: string;

  /** Kanonische partId, z.B. "tuer_vl". */
  @Column() partId: string;
  /** Denormalisiertes Label, z.B. "Tür vorne links". */
  @Column({ nullable: true }) partLabel: string;

  @Column({ type: enumColumnType(), enum: ['standard', 'frei'], default: 'frei' })
  punktTyp: LayerPointTyp;
  /** Stabiler Schluessel eines Standardpunktes am Bauteil (Welle 2), sonst null. */
  @Column({ nullable: true }) standardKey: string;
  /** Freitext-Bezeichnung des Punktes (z.B. "Türmitte", "Kante unten"). */
  @Column({ nullable: true }) label: string;

  // --- Positionierung: 3D ODER 2D-Fallback (analog DamageItem) ---
  @Column({ type: enumColumnType(), enum: ['3d', '2d'], default: '3d' })
  positionMode: '3d' | '2d';
  @Column({ type: jsonColumnType(), nullable: true }) position3d: Position3D | null;
  /** front|heck|links|rechts|dach */
  @Column({ nullable: true }) ansicht2d: string;
  @Column({ type: 'float', nullable: true }) x2d: number;
  @Column({ type: 'float', nullable: true }) y2d: number;

  /** Mehrere µm-Messungen je Punkt (unbegrenzt), mit Zeitstempel. */
  @Column({ type: jsonColumnType(), nullable: true }) readings: LayerReading[];

  @Column({ type: 'int', nullable: true }) reihenfolge: number;
  @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
