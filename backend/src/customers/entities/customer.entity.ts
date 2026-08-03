import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';

export enum CustomerType { PRIVATE = 'private', BUSINESS = 'business' }

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Index: nahezu jede Kunden-Query filtert auf tenantId (Mandantentrennung).
  @Index() @Column() tenantId: string;
  @Column({ type: enumColumnType(), enum: CustomerType, default: CustomerType.PRIVATE }) type: CustomerType;
  @Column({ nullable: true }) firstName: string;
  @Column({ nullable: true }) lastName: string;
  @Column({ nullable: true }) companyName: string;
  @Column({ nullable: true }) vatNumber: string;
  /** Leitweg-ID (BT-10) des Rechnungsempfängers – Pflicht für B2G-Rechnungen an Behörden/öffentliche Auftraggeber. */
  @Column({ nullable: true }) leitwegId: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) mobile: string;
  // App-Verschluesselung (AES-256-GCM) fuer NICHT durchsuchte, personenbezogene
  // Adressfelder. WICHTIG: Der ValueTransformer wirkt rein app-seitig (to/from) und
  // aendert das DB-Schema NICHT – die Spalte bleibt `character varying` (in Postgres
  // ohne Laengenlimit, in SQLite TEXT). Der Chiffretext (Marker 7 + Base64 aus
  // 12-Byte-IV + 16-Byte-Tag + Klartext) passt damit ohne Migration. Altbestand
  // ohne Marker bleibt lesbar (decrypt gibt markerlosen Klartext unveraendert zurueck).
  // NICHT verschluesselbar sind firstName/lastName/companyName/email/phone/mobile/vin
  // (Kundensuche via LIKE) und city (nicht sensibel, in Auswahl-Subtiteln genutzt).
  @Column({ nullable: true, transformer: encryptedStringTransformer }) street: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true, transformer: encryptedStringTransformer }) postalCode: string;
  @Column({ default: 'DE' }) country: string;
  @Column({ nullable: true }) sevdeskContactId: string;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer }) notes: string;
  @Column({ default: true }) isActive: boolean;
  /** DSGVO Art.17: Zeitpunkt der Anonymisierung (gesetzt vom GdprService). NULL = nicht anonymisiert. */
  @Column({ type: timestampColumnType(), nullable: true }) anonymisiertAm: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
