import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

/**
 * Status einer Restrolle:
 * - VERFUEGBAR   = nutzbarer Rest.
 * - AUFGEBRAUCHT = restLfm auf 0 gelaufen (setzt die Material-Buchung automatisch).
 * - ENTSORGT     = Rest weggeworfen/abgeschrieben -> macht Schwund SICHTBAR, ohne
 *                  den groben Produkt-`bestand` anzufassen.
 */
export enum FolienRolleStatus {
  VERFUEGBAR = 'verfuegbar',
  AUFGEBRAUCHT = 'aufgebraucht',
  ENTSORGT = 'entsorgt',
}

/**
 * Restrollen-Register (Folierer-Welle 2). Bewusst ENTKOPPELT vom Produkt-`bestand`:
 * `bestand` bleibt das grobe Nachbestell-Aggregat (Summe allen Materials), die
 * FolienRolle ist die feinere Verortung konkreter Reste ("2,8 m Rest 3M 2080
 * Satin Black"). So pflegt ein Ein-Mann-Betrieb nur die Reste, die er wirklich
 * hat, und der Schwund wird ueber `status=ENTSORGT` sichtbar statt als stille
 * Bestandsdifferenz. Tenant-getrennt.
 */
@Index(['tenantId', 'productId'])
@Entity('folien_rollen')
export class FolienRolle {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() tenantId: string;

  /** Optionale Zuordnung zu einem Folien-Produkt (Gruppierung + Verschnitt-KPI). */
  @Column({ nullable: true }) productId: string;

  /** Menschlicher Anker, z. B. "3M 2080 Satin Black - 2,8 m Rest". */
  @Column() bezeichnung: string;

  /** Optionale Chargen-/Los-Nummer (Farbkonsistenz ueber mehrere Rollen). */
  @Column({ nullable: true }) charge: string;

  /** Verbleibende Laufmeter dieser Rolle. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) restLfm: number;

  @Column({
    type: enumColumnType(),
    enum: FolienRolleStatus,
    default: FolienRolleStatus.VERFUEGBAR,
  })
  status: FolienRolleStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
