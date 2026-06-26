import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum FuelType { PETROL = 'petrol', DIESEL = 'diesel', ELECTRIC = 'electric', HYBRID = 'hybrid', OTHER = 'other' }

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
}
