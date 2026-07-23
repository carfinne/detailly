import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';
import { normalizeKennzeichen } from '../kennzeichen.util';

export enum FuelType { PETROL = 'petrol', DIESEL = 'diesel', ELECTRIC = 'electric', HYBRID = 'hybrid', OTHER = 'other' }

// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
// Index fuer den Kennzeichen-Lookup der Schnellannahme (tenant-scoped Punktabfrage).
@Index('IDX_vehicles_tenant_kennzeichen_norm', ['tenantId', 'kennzeichenNormalisiert'])
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() customerId: string;
  @Column() make: string;
  @Column() model: string;
  @Column({ nullable: true }) variant: string;
  @Column({ nullable: true }) year: number;
  @Column({ nullable: true }) color: string;
  @Column({ nullable: true }) colorCode: string;
  @Column({ nullable: true }) licensePlate: string;
  /** Serverseitig normalisiertes Kennzeichen (JS-Normalisierung, umlautfest) —
   *  NIE vom Client befuellt, die Hooks unten ueberschreiben jeden Input. */
  @Column({ nullable: true }) kennzeichenNormalisiert: string;
  @Column({ nullable: true }) vin: string;
  @Column({ type: enumColumnType(), enum: FuelType, nullable: true }) fuelType: FuelType;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 }) lengthCm: number;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 }) widthCm: number;
  @Column({ nullable: true }) ppfTemplate: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) estimatedSqm: number;
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  /** Soft-Delete: gesetzt = geloescht. find/findOne blenden solche Zeilen aus,
   *  die Zeile bleibt aber fuer FK-Referenzen (Order.vehicleId) + Historie erhalten. */
  @DeleteDateColumn() deletedAt: Date;

  /** Haelt kennzeichenNormalisiert auf JEDEM save-Pfad synchron (Service,
   *  CSV-Import, Seed). Greift nicht bei .insert()/.update() am Repository
   *  vorbei am Entity-Save — dafuer existiert der Boot-Backfill im Service. */
  @BeforeInsert()
  @BeforeUpdate()
  syncKennzeichenNormalisiert() {
    this.kennzeichenNormalisiert = normalizeKennzeichen(this.licensePlate) || null;
  }
}
