import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum RentalStatus {
  RESERVIERT = 'reserviert',
  AKTIV = 'aktiv',
  ZURUECK = 'zurueck',
}

/** Einfache Vermietung eines vermietbaren Produkts an einen Kunden. */
@Entity('rentals')
export class Rental {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() productId: string;
  @Column() customerId: string;
  @Column({ type: timestampColumnType() }) von: Date;
  @Column({ type: timestampColumnType() }) bis: Date;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) preis: number;
  @Column({ type: enumColumnType(), enum: RentalStatus, default: RentalStatus.RESERVIERT })
  status: RentalStatus;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
