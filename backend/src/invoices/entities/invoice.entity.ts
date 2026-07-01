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
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';
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

// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /**
   * Fortlaufende Nummer je Tenant, z.B. "RE-2026-0001" oder "AN-2026-0001".
   * NULL bei Rechnungs-Entwuerfen: die RE-Nummer wird erst bei der Festsetzung
   * (Entwurf -> Offen) vergeben -> keine durch Entwuerfe verbrauchten Nummern.
   */
  @Column({ nullable: true }) nummer: string;

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

  /** Angewandter MwSt-Satz in Prozent (19/7/0). Default 19; aus ihm wird mwst berechnet. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 }) mwstSatz: number;

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

  /** Zeitpunkt des letzten E-Mail-Versands an den Kunden. NULL = noch nie versendet. */
  @Column({ type: timestampColumnType(), nullable: true }) versendetAm: Date;

  @Column({ nullable: true }) sevdeskInvoiceId: string;

  /**
   * Geheimes Token fuer den oeffentlichen Download-Link (Kunde laedt sein PDF
   * ohne Login). Plaintext, select:false (nie in normalen Antworten), unique
   * (Kollision faellt fail-closed), regenerierbar. Zugriff nur ueber
   * GET /public/invoices/:token(/pdf) und nur fuer offene/bezahlte Belege.
   */
  @Index({ unique: true })
  @Column({ nullable: true, select: false }) downloadToken: string;

  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer }) hinweis: string;

  // --- DSGVO/GoBD: Empfaenger-Snapshot (eingefroren bei Art.17-Anonymisierung) ---
  // Wird vor der Anonymisierung des Customers gefuellt, damit das PDF (§14 UStG)
  // den korrekten Rechnungsadressaten behaelt, obwohl der Live-Customer anonym ist.
  // Empfaenger-Snapshot = personenbezogene Daten -> verschluesselt.
  /** Name des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerName: string | null;
  /** Anschrift (mehrzeilig) des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerAnschrift: string | null;
  /** USt-IdNr. des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerVatNumber: string | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
