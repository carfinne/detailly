import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

/** Anlass der Schichtdicken-Messung. */
export type LayerMeasurementAnlass =
  | 'vor_folierung'
  | 'vor_ppf'
  | 'ankauf'
  | 'gutachten'
  | 'sonstiges';
/** Bearbeitungsstatus des Messprotokolls. */
export type LayerMeasurementStatus = 'entwurf' | 'abgeschlossen' | 'freigegeben';

/**
 * Kopf eines Schichtdicken-Messprotokolls (Lackschichtdicke, µm) je Fahrzeug.
 * Eigenstaendige Entity NEBEN der DamageInspection: µm-Messungen sind fachlich
 * keine Schaeden (wuerden die Schadens-Enums verwaessern). Optionaler
 * `inspectionId`-FK erlaubt aber die Verknuepfung mit einer bestehenden Annahme.
 *
 * Voll mandantengetrennt (tenantId + tenant-scope.ts). Alle Fremd-IDs werden im
 * Service tenant-validiert (assertRefInTenant), nie aus dem Body uebernommen.
 *
 * Signatur-/Freigabe-Spalten sind bereits angelegt, werden aber erst in Welle 2
 * genutzt (spart eine zweite Migration; pre-launch-Baseline-Konvention).
 */
@Entity('layer_measurements')
@Index(['tenantId', 'vehicleId'])
@Index(['tenantId', 'orderId'])
export class LayerMeasurement {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;

  /** FK, tenant-validiert. */
  @Column() customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) orderId: string;
  /** Optionale Verknuepfung an eine bestehende Schadensinspektion. */
  @Column({ nullable: true }) inspectionId: string;

  /** 3D-Modell-Identifier (z.B. "vw_golf_8_v3"), analog DamageInspection. */
  @Column({ nullable: true }) modelKey: string;

  @Column({
    type: enumColumnType(),
    enum: ['vor_folierung', 'vor_ppf', 'ankauf', 'gutachten', 'sonstiges'],
    default: 'ankauf',
  })
  anlass: LayerMeasurementAnlass;

  @Column({
    type: enumColumnType(),
    enum: ['entwurf', 'abgeschlossen', 'freigegeben'],
    default: 'entwurf',
  })
  status: LayerMeasurementStatus;

  /** Angewandtes Normprofil (Reproduzierbarkeit, falls Defaults spaeter wandern). */
  @Column({ default: 'serienlack_stahl' }) normProfileKey: string;

  /** Freitext-Bezeichnung des Messgeraets (Geraete-Anbindung erst Welle 2). */
  @Column({ nullable: true }) messgeraet: string;
  @Column({ type: 'text', nullable: true }) notiz: string;

  @Column({ nullable: true }) erfasstVonUserId: string;
  @Column({ nullable: true }) erfasstVonRolle: string;

  /** Offline-Sync-Idempotenz. */
  @Index() @Column({ nullable: true }) clientUuid: string;

  // --- Freigabe/Unterschrift (Welle 2, Spalten schon vorhanden) ---
  /** Geheimes Token fuer die oeffentliche Freigabe (Welle 2). */
  @Index() @Column({ nullable: true, select: false }) freigabeToken: string;
  @Column({ type: 'text', nullable: true }) unterschriftPng: string;
  @Column({ nullable: true }) unterschriebenVonName: string;
  @Column({ type: timestampColumnType(), nullable: true }) unterschriebenAm: Date;
  @Column({ nullable: true }) unterschriebenVonUserId: string;
  @Column({ type: 'text', nullable: true }) consentText: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
