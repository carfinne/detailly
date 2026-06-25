import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  ENTWURF = 'entwurf',
  OFFEN = 'offen',
  BEZAHLT = 'bezahlt',
  STORNIERT = 'storniert',
}

export enum InvoiceKind {
  ANGEBOT = 'angebot',
  RECHNUNG = 'rechnung',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Fortlaufende Nummer je Tenant, z.B. "RE-2026-0001" oder "AN-2026-0001". */
  @Column() nummer: string;

  @Column({ type: enumColumnType(), enum: InvoiceKind, default: InvoiceKind.RECHNUNG })
  art: InvoiceKind;

  @Column() customerId: string;
  @Column({ nullable: true }) orderId: string;

  @Column({ type: enumColumnType(), enum: InvoiceStatus, default: InvoiceStatus.ENTWURF })
  status: InvoiceStatus;

  @Column({ type: timestampColumnType(), nullable: true }) datum: Date;
  @Column({ type: timestampColumnType(), nullable: true }) leistungsdatum: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) netto: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mwst: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) brutto: number;

  // Paket 2 (Rechnung scharf machen): Faelligkeit/Mahnwesen. Alle additiv & nullable
  // (bzw. default 0), damit synchronize=true die Spalten in Dev konfliktfrei anlegt.
  /** Zahlungsziel als konkretes Datum (datum + zahlungsziel Tage). Nur fuer Rechnungen sinnvoll. */
  @Column({ type: timestampColumnType(), nullable: true }) faelligkeitsdatum: Date;
  /** Zahlungsfrist in Tagen, aus der faelligkeitsdatum abgeleitet wird (Default 14 im Service). */
  @Column({ nullable: true }) zahlungsziel: number;
  /** Datum des tatsaechlichen Zahlungseingangs (gesetzt von 'als bezahlt markieren'). */
  @Column({ type: timestampColumnType(), nullable: true }) zahldatum: Date;
  /** Mahnstufe 0..3 (0=keine, 1=Erinnerung, 2=1. Mahnung, 3=2. Mahnung). */
  @Column({ default: 0 }) mahnstufe: number;

  @Column({ nullable: true }) sevdeskInvoiceId: string;

  @Column({ type: 'text', nullable: true }) hinweis: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
