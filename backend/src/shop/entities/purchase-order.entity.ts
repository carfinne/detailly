import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';
import { PurchaseOrderItem } from './purchase-order-item.entity';

export enum PurchaseOrderStatus {
  ENTWURF = 'entwurf',
  EINGEREICHT = 'eingereicht',
  FREIGEGEBEN = 'freigegeben',
  BESTELLT = 'bestellt',
  GELIEFERT = 'geliefert',
  ABGELEHNT = 'abgelehnt',
}

// GoBD-Backstop (C1): eindeutige Bestellnummer je Betrieb (nummer ist immer
// gesetzt). Die Vergabe ist zusaetzlich per withUniqueRetry serialisiert (shop.service).
@Index(['tenantId', 'nummer'], { unique: true })
@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() nummer: string;
  @Column({ nullable: true }) lieferant: string;
  @Column({ type: enumColumnType(), enum: PurchaseOrderStatus, default: PurchaseOrderStatus.ENTWURF })
  status: PurchaseOrderStatus;
  @Column({ nullable: true }) erstelltVon: string;
  @Column({ nullable: true }) freigegebenVon: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) summe: number;
  @Column({ type: 'text', nullable: true }) notiz: string;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
