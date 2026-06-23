import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

/** Typ der Begutachtung: Annahme, eigenstaendiges Gutachten oder Ausgang. */
export type InspectionTyp = 'annahme' | 'gutachten' | 'ausgang';
/** Bearbeitungsstatus der Inspektion. */
export type InspectionStatus = 'entwurf' | 'abgeschlossen' | 'freigegeben';

/**
 * Eine Begutachtung je Fahrzeug/Auftrag/Typ (annahme|gutachten|ausgang).
 * Erweitert die bestehende 2D-Fahrzeugannahme (`VehicleIntake`) additiv um die
 * 3D-Schadenserfassung. Voll mandantengetrennt (tenantId + tenant-scope.ts).
 */
@Entity('damage_inspections')
@Index(['tenantId', 'vehicleId', 'typ'])
export class DamageInspection {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;

  /** FK, tenant-validiert via assertRefInTenant. */
  @Column() customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) orderId: string;

  @Column({
    type: enumColumnType(),
    enum: ['annahme', 'gutachten', 'ausgang'],
    default: 'annahme',
  })
  typ: InspectionTyp;

  @Column({
    type: enumColumnType(),
    enum: ['entwurf', 'abgeschlossen', 'freigegeben'],
    default: 'entwurf',
  })
  status: InspectionStatus;

  /** Kette annahme -> ausgang (Carry-over der Vorschaeden). */
  @Column({ nullable: true }) previousInspectionId: string;
  /** 3D-Modell-Identifier (z.B. "vw_golf_8_v3"). */
  @Column({ nullable: true }) modelKey: string;

  /** Kilometerstand, aus VehicleIntake uebernommen. */
  @Column({ type: 'int', nullable: true }) kmStand: number;
  /** Tankstand in Prozent (0–100). */
  @Column({ type: 'int', nullable: true }) tankstand: number;
  @Column({ type: 'text', nullable: true }) notiz: string;

  @Column({ nullable: true }) erfasstVonUserId: string;
  /** technician|receptionist|manager|gutachter */
  @Column({ nullable: true }) erfasstVonRolle: string;

  /** Offline-Sync-Idempotenz: Tablet-generierte UUID. */
  @Index() @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
