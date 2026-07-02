import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  // Index fuer Positions-Lookups/Deletes je Beleg (FK bekommt keinen Auto-Index).
  @Index() @Column() invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column() beschreibung: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 }) menge: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) einzelpreis: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;
}
