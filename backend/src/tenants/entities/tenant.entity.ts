import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';
import {
  encryptedStringTransformer,
  encryptedJsonTransformer,
} from '../../common/crypto/encrypted-column';

export enum TenantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
}

/**
 * Ausrichtung des Betriebs. Steuert Branchen-Theming (Akzentfarbe/Look),
 * den Kalkulations-Katalog (Bauteile/Leistungen je Typ) und typspezifische
 * Optionen. KOMPLETT = alle Bereiche (Default, sicher fuer Bestandsbetriebe).
 */
export enum Betriebstyp {
  AUFBEREITUNG = 'aufbereitung',
  FOLIERUNG = 'folierung',
  PPF = 'ppf',
  KOMPLETT = 'komplett',
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

  @Column({ type: enumColumnType(), enum: TenantStatus, default: TenantStatus.TRIAL })
  status: TenantStatus;

  @Column({ type: enumColumnType(), enum: Betriebstyp, default: Betriebstyp.KOMPLETT })
  betriebstyp: Betriebstyp;

  @Column({ nullable: true })
  logoUrl: string;

  // Verschluesselt (sensibles API-Geheimnis). select:false -> nur bei Bedarf geladen.
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  sevdeskApiToken: string;

  // SMTP-Passwort fuer den betriebseigenen Mail-Versand (Vorbild sevdeskApiToken):
  // verschluesselt + select:false -> wird nur beim Transporter-Bau/Test geladen,
  // verlaesst das Backend nie im Klartext. Die uebrige mailConfig liegt in settings.
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  smtpPassword: string;

  // Privater DKIM-Schluessel (PEM) fuer die Signierung ausgehender Mails der eigenen
  // Domain. Wie smtpPassword: verschluesselt + select:false -> wird nur beim
  // Transporter-Bau/Signieren geladen und NIE ausgeliefert. Der zugehoerige
  // oeffentliche Schluessel steht (unbedenklich) in settings.mailConfig.dkim.
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  dkimPrivateKey: string;

  // Geheimes Token fuer den oeffentlichen iCal-Kalender-Feed (in der URL = Zugang).
  // Bewusst KLARTEXT (muss per WHERE auffindbar sein) + select:false. Bei Verdacht
  // auf Leck regenerierbar.
  @Column({ nullable: true, select: false })
  calendarToken: string;

  // Verschluesselt: enthaelt §14-Daten (IBAN/Steuernummer/USt-IdNr/Bank). Spalte
  // bewusst 'text' (NICHT jsonb) – der Transformer serialisiert + verschluesselt
  // das Objekt selbst. Wird nicht durchsucht -> Verschluesselung unkritisch.
  @Column({ type: 'text', nullable: true, transformer: encryptedJsonTransformer<object>() })
  settings: object;

  @Column({ nullable: true, type: timestampColumnType() })
  trialEndsAt: Date;

  // ---------------------------------------------------------------------------
  // Rechts-Zustimmung bei der Registrierung (Nachweis, additiv). Zeitstempel
  // werden SERVERSEITIG gesetzt (nie ein Client-Wert), die Versions-Strings
  // stammen aus common/legal-versions -> spaetere Neuzustimmung erkennbar.
  // ---------------------------------------------------------------------------

  /** Zeitpunkt der AGB-Zustimmung (serverseitig). null = (noch) nicht zugestimmt. */
  @Column({ nullable: true, type: timestampColumnType() })
  agbAkzeptiertAm: Date;

  /** Version der akzeptierten AGB (Nachweis, vgl. AGB_VERSION). */
  @Column({ nullable: true })
  agbVersion: string;

  /** Zeitpunkt der Zustimmung zur Datenschutzerklaerung (serverseitig). */
  @Column({ nullable: true, type: timestampColumnType() })
  dseAkzeptiertAm: Date;

  /** Version der akzeptierten Datenschutzerklaerung (Nachweis, vgl. DSE_VERSION). */
  @Column({ nullable: true })
  dseVersion: string;

  /** Zeitpunkt der Zustimmung zum Auftragsverarbeitungsvertrag (AVV, Art. 28 DSGVO). */
  @Column({ nullable: true, type: timestampColumnType() })
  avvAkzeptiertAm: Date;

  /** Version des akzeptierten AVV (Nachweis, vgl. AVV_VERSION). */
  @Column({ nullable: true })
  avvVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
