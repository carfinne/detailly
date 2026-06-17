import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';
import { OrderItem } from './order-item.entity';

export enum ServiceType {
  AUFBEREITUNG = 'aufbereitung',
  FOLIERUNG = 'folierung',
  PPF = 'ppf',
  SONSTIGES = 'sonstiges',
}

export enum OrderStatus {
  ANGEFRAGT = 'angefragt',
  KALKULIERT = 'kalkuliert',
  BESTAETIGT = 'bestaetigt',
  IN_ARBEIT = 'in_arbeit',
  QUALITAETSKONTROLLE = 'qualitaetskontrolle',
  FERTIG = 'fertig',
  ABGERECHNET = 'abgerechnet',
  STORNIERT = 'storniert',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Fortlaufende Auftragsnummer je Tenant, z.B. "AU-2026-0001". */
  @Column() auftragsnummer: string;

  @Column() customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) locationId: string;
  @Column({ nullable: true }) assignedUserId: string;

  @Column({ type: enumColumnType(), enum: ServiceType, default: ServiceType.AUFBEREITUNG })
  serviceType: ServiceType;

  @Column({ type: enumColumnType(), enum: OrderStatus, default: OrderStatus.ANGEFRAGT })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) materialkosten: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) arbeitsstunden: number;

  @Column({ nullable: true, type: timestampColumnType() }) geplanterStart: Date;
  @Column({ nullable: true, type: timestampColumnType() }) geplantesEnde: Date;

  @Column({ type: jsonColumnType(), nullable: true }) bilderVorher: string[];
  @Column({ type: jsonColumnType(), nullable: true }) bilderNachher: string[];

  @Column({ type: 'text', nullable: true }) internerHinweis: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) nettoSumme: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mwstBetrag: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
