import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';
import {
  encryptedStringTransformer,
  encryptedJsonTransformer,
} from '../../common/crypto/encrypted-column';

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  street: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  postalCode: string;

  @Column({ default: 'DE' })
  country: string;

  @Column({ nullable: true })
  franchiseId: string;

  @Column({ type: enumColumnType(), enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ nullable: true })
  logoUrl: string;

  // Verschluesselt (sensibles API-Geheimnis). select:false -> nur bei Bedarf geladen.
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  sevdeskApiToken: string;

  // Geheimes Token fuer den oeffentlichen iCal-Kalender-Feed (in der URL = Zugang).
  // Bewusst KLARTEXT (muss per WHERE auffindbar sein) + select:false. Bei Verdacht
  // auf Leck regenerierbar.
  @Column({ nullable: true, select: false })
  calendarToken: string;

  @Column({ type: jsonColumnType(), nullable: true })
  businessHours: object;

  // Verschluesselt: enthaelt §14-Daten (IBAN/Steuernummer/USt-IdNr/Bank). Spalte
  // bewusst 'text' (NICHT jsonb) – der Transformer serialisiert + verschluesselt
  // das Objekt selbst. Wird nicht durchsucht -> Verschluesselung unkritisch.
  @Column({ type: 'text', nullable: true, transformer: encryptedJsonTransformer<object>() })
  settings: object;

  @Column({ nullable: true, type: timestampColumnType() })
  trialEndsAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
