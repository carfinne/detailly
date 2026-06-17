import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum AppointmentStatus {
  GEPLANT = 'geplant',
  BESTAETIGT = 'bestaetigt',
  ABGESCHLOSSEN = 'abgeschlossen',
  ABGESAGT = 'abgesagt',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column({ nullable: true }) orderId: string;
  @Column({ nullable: true }) customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) assignedUserId: string;
  @Column({ nullable: true }) locationId: string;

  @Column() titel: string;

  @Column({ type: timestampColumnType() }) start: Date;
  @Column({ type: timestampColumnType() }) ende: Date;

  @Column({ type: enumColumnType(), enum: AppointmentStatus, default: AppointmentStatus.GEPLANT })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true }) notiz: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
