import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

export enum ServiceCategory {
  AUFBEREITUNG = 'aufbereitung',
  FOLIERUNG = 'folierung',
  PPF = 'ppf',
  SONSTIGES = 'sonstiges',
}

export enum ServiceUnit {
  PAUSCHAL = 'pauschal',
  QM = 'qm',
  STUNDE = 'stunde',
}

/** Leistung bzw. Leistungspaket (Aufbereitung/Folierung/PPF). */
@Entity('service_items')
export class ServiceItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Index: Leistungskatalog wird immer mandanten-gescoped geladen.
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) beschreibung: string;
  @Column({ type: enumColumnType(), enum: ServiceCategory, default: ServiceCategory.AUFBEREITUNG })
  kategorie: ServiceCategory;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) basispreis: number;
  @Column({ type: enumColumnType(), enum: ServiceUnit, default: ServiceUnit.PAUSCHAL })
  einheit: ServiceUnit;
  /**
   * Optionale geplante Dauer dieser Leistung in Minuten (Soll fuer die
   * Nachkalkulation). Der Betrieb pflegt sie einmal im Katalog; sie wird beim
   * Uebernehmen in einen Auftrag auf die Position geschnappt (order_items).
   * Nullable -> Bestandsdaten bleiben unberuehrt, keine Vorgabe erzwungen.
   */
  @Column({ type: 'int', nullable: true }) geplanteDauerMinuten: number | null;
  @Column({ default: true }) aktiv: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
