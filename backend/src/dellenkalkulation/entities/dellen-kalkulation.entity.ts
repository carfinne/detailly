import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { decimalColumnType, timestampColumnType } from '../../common/database.types';
import type { DellenModus, DellenStatus } from '../dellen-preis.util';

/**
 * Kopf einer Dellenkalkulation (Smart Repair / PDR – Hagel-/Parkdellen). Je
 * Kalkulation wird der Modus gewaehlt: `einzel` (jede Delle einzeln) oder `hagel`
 * (Staffel je Bauteil). Der Gesamtpreis wird serverseitig aus der Tenant-
 * Preismatrix + den Markern berechnet und hier denormalisiert gespeichert
 * (Anzeige/Liste), ist aber jederzeit reproduzierbar.
 *
 * Voll mandantengetrennt (tenantId + tenant-scope.ts). Fremd-IDs (customerId/
 * vehicleId) werden im Service tenant-validiert (assertRefInTenant), nie aus dem
 * Body uebernommen. `modus`/`status` sind BEWUSST varchar + @IsIn (kein DB-Enum),
 * damit neue Werte keine Enum-Migration/keinen Reseed erzwingen.
 */
@Entity('dellen_kalkulationen')
@Index(['tenantId', 'vehicleId'])
@Index(['tenantId', 'createdAt'])
export class DellenKalkulation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;

  /** Optionale FK (tenant-validiert). Fuer Angebots-Uebernahme / Zuordnung. */
  @Column({ nullable: true }) customerId: string;
  @Column({ nullable: true }) vehicleId: string;

  /** 3D-Modell-Identifier (analog DamageInspection/LayerMeasurement). */
  @Column({ nullable: true }) modelKey: string;

  /** einzel | hagel (varchar + @IsIn im DTO). */
  @Column({ default: 'einzel' }) modus: DellenModus;

  /** entwurf | final (varchar + @IsIn im DTO). Final = read-only. */
  @Column({ default: 'entwurf' }) status: DellenStatus;

  /** Serverseitig berechneter Gesamtpreis (Euro), denormalisiert. */
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 })
  gesamtpreis: string;

  @Column({ type: 'text', nullable: true }) notiz: string;

  @Column({ nullable: true }) erstelltVonUserId: string;
  @Column({ nullable: true }) erstelltVonRolle: string;

  /** Zeitpunkt der Finalisierung (nur gesetzt, wenn status = final). */
  @Column({ type: timestampColumnType(), nullable: true }) finalisiertAm: Date;

  /** Offline-Sync-Idempotenz (tenant-scoped). */
  @Index() @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
