import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType } from '../../common/database.types';

/** Herkunft des Schadens: bestehender Vorschaden oder neu festgestellt. */
export type DamageOrigin = 'vorschaden' | 'neu';
/** Schadensart. */
export type DamageArt =
  | 'kratzer'
  | 'delle'
  | 'steinschlag'
  | 'lackschaden'
  | 'rost'
  | 'riss'
  | 'bruch'
  | 'verzogen'
  | 'fehlteil'
  | 'sonstiges';
/** Schweregrad. */
export type DamageSchweregrad = 'leicht' | 'mittel' | 'schwer';
/** Empfohlene Reparaturart. */
export type DamageReparaturart =
  | 'polieren'
  | 'smart_repair'
  | 'lackieren'
  | 'instandsetzen'
  | 'austausch'
  | 'keine';
/** Bearbeitungsstatus eines einzelnen Schadens. */
export type DamageItemStatus =
  | 'offen'
  | 'in_arbeit'
  | 'erledigt'
  | 'abgelehnt'
  | 'uebernommen';

/** 3D-Weltpunkt + Oberflaechennormale (nur Visualisierung, nicht fachliche Wahrheit). */
export interface Position3D {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Ein einzelner Schaden, primaer an einem Bauteil (`partId`) verankert
 * (fachliche Wahrheit, robust gegen Modellwechsel). Die 3D-Position bzw. der
 * 2D-Fallback dienen nur der Visualisierung. Eigene Tabelle, weil
 * kalkulationsrelevant, einzeln referenzierbar und konfliktfrei synchronisierbar.
 */
@Entity('damage_items')
@Index(['tenantId', 'inspectionId'])
@Index(['tenantId', 'partId'])
export class DamageItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;
  @Column() inspectionId: string;

  // --- Bauteil-Verankerung (FACHLICHE Wahrheit) ---
  /** z.B. "tuer_vl", "stossfaenger_hinten". */
  @Column() partId: string;
  /** Denormalisiertes Label, z.B. "Tuer vorne links". */
  @Column({ nullable: true }) partLabel: string;

  // --- Positionierung: 3D ODER 2D-Fallback (kompatibel zu SchadensMarker) ---
  @Column({ type: enumColumnType(), enum: ['3d', '2d'], default: '3d' })
  positionMode: '3d' | '2d';
  @Column({ type: jsonColumnType(), nullable: true }) position3d: Position3D | null;
  /** front|heck|links|rechts|dach */
  @Column({ nullable: true }) ansicht2d: string;
  /** 0..100 % der SVG-Flaeche. */
  @Column({ type: 'float', nullable: true }) x2d: number;
  @Column({ type: 'float', nullable: true }) y2d: number;

  // --- Fachliche Klassifikation ---
  @Column({ type: enumColumnType(), enum: ['vorschaden', 'neu'], default: 'neu' })
  origin: DamageOrigin;
  @Column({
    type: enumColumnType(),
    enum: [
      'kratzer',
      'delle',
      'steinschlag',
      'lackschaden',
      'rost',
      'riss',
      'bruch',
      'verzogen',
      'fehlteil',
      'sonstiges',
    ],
  })
  art: DamageArt;
  @Column({ type: enumColumnType(), enum: ['leicht', 'mittel', 'schwer'] })
  schweregrad: DamageSchweregrad;
  @Column({ type: 'int', nullable: true }) groesseLaengeMm: number;
  @Column({ type: 'int', nullable: true }) groesseBreiteMm: number;
  /** Freitext, z.B. "handflaechengross", "Streifschaden 30cm". */
  @Column({ nullable: true }) ausmass: string;
  @Column({
    type: enumColumnType(),
    enum: ['polieren', 'smart_repair', 'lackieren', 'instandsetzen', 'austausch', 'keine'],
    nullable: true,
  })
  reparaturart: DamageReparaturart;
  @Column({
    type: enumColumnType(),
    enum: ['offen', 'in_arbeit', 'erledigt', 'abgelehnt', 'uebernommen'],
    default: 'offen',
  })
  status: DamageItemStatus;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  kostenSchaetzung: string;
  @Column({ type: 'text', nullable: true }) notiz: string;

  // --- Carry-over / Versionierung ---
  /** Identischer Schaden in der Vor-Inspektion. */
  @Index() @Column({ nullable: true }) carriedFromItemId: string;
  @Column({ type: 'boolean', default: false }) istUebernommen: boolean;
  /** Soll/Ist: war Vorschaden -> bei Ausgang behoben? */
  @Column({ type: 'boolean', nullable: true }) behobenBeiAusgang: boolean;

  @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
