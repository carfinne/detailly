import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column({ nullable: true }) productId: string;
  @Column() beschreibung: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 }) menge: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) einzelpreis: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;
}
