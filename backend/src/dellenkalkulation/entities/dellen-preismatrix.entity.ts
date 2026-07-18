import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { decimalColumnType, jsonColumnType } from '../../common/database.types';
import type { HagelStaffelStufe } from '../dellen-preis.util';

/**
 * Betriebs-eigene Preismatrix der Dellenkalkulation (genau EINE Zeile je Tenant,
 * `tenantId` unique). Konfiguriert die regelbasierte PDR-Kalkulation: Basispreise
 * je Groessenklasse, Kanten-/Alu-Faktor, Lackschaden-Aufschlag, optionale
 * Mindest-/Anfahrtspauschale und die Hagel-Staffel.
 *
 * Geldbetraege/Faktoren sind decimal-Spalten (decimal-Konvention); nur die
 * variabel lange Hagel-Staffel liegt als JSON. Existiert (noch) keine Zeile,
 * nutzt der Service die Default-Matrix aus dellen-preis.util (lazy default) –
 * die Berechnung funktioniert also auch ohne gepflegte Matrix.
 */
@Entity('dellen_preismatrix')
export class DellenPreismatrix {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Genau eine Matrix je Betrieb. */
  @Index({ unique: true }) @Column() tenantId: string;

  // --- Basispreise je Groessenklasse (Euro) ---
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) basis1Euro: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) basis2Euro: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) basis5Euro: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) basisGolfball: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) basisGroesser: string;

  // --- Faktoren + Zuschlaege ---
  @Column({ type: decimalColumnType(), precision: 6, scale: 3, default: 1 }) kantenFaktor: string;
  @Column({ type: decimalColumnType(), precision: 6, scale: 3, default: 1 }) aluFaktor: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 })
  lackschadenAufschlag: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) mindestpauschale: string;
  @Column({ type: decimalColumnType(), precision: 10, scale: 2, default: 0 }) anfahrtspauschale: string;

  /** Hagel-Staffel: [{ maxDellen: number|null, pauschale: number }, ...]. */
  @Column({ type: jsonColumnType(), nullable: true }) hagelStaffel: HagelStaffelStufe[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
