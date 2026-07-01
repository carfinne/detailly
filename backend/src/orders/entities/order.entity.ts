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
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';
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

/**
 * Branchenspezifische Leistungsdetails je nach serviceType.
 * Es sind jeweils nur die zum serviceType passenden Teilobjekte relevant.
 */
export interface LeistungDetails {
  ppf?: {
    folie?: string;
    hersteller?: string;
    qm?: number;
    garantieJahre?: number;
  };
  keramik?: {
    produkt?: string;
    schichten?: number;
    garantieJahre?: number;
  };
  folierung?: {
    farbe?: string;
    hersteller?: string;
    qm?: number;
    teilfolierung?: boolean;
  };
}

// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
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

  /**
   * Geheimes Token fuer den oeffentlichen Tracking-Link ("Wo ist mein Auto?").
   * Plaintext, aber per Default NICHT mitselektiert (select:false), damit es nie
   * versehentlich in normalen Auftrags-Antworten landet. Regenerierbar -> alter
   * Link wird ungueltig. Zugriff ausschliesslich ueber GET /public/orders/:token.
   * Unique-Index: erzwingt Eindeutigkeit DB-seitig (mehrere NULLs erlaubt), damit
   * eine – astronomisch unwahrscheinliche – Token-Kollision fail-closed scheitert
   * statt einen mehrdeutigen Treffer zu liefern.
   */
  @Index({ unique: true })
  @Column({ nullable: true, select: false }) freigabeToken: string;

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

  /** Branchenspezifische Detailfelder (PPF/Keramik/Folierung). */
  @Column({ type: jsonColumnType(), nullable: true }) leistungDetails: LeistungDetails;

  // Verschluesselt (Freitext, kann personenbezogene Notizen enthalten).
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  internerHinweis: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) nettoSumme: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mwstBetrag: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
