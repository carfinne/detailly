import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Kategorie-Taxonomie des B2B-Marktplatzes. PLATTFORM-WEIT (bewusst OHNE
 * tenantId): Detailly pflegt EINEN zentralen Baum, alle Betriebe filtern
 * danach. Genau ZWEI Ebenen:
 * - Hauptkategorie: `parentId = null`; `slug` == `bereich` (z. B. "aufbereitung").
 * - Unterkategorie: `parentId` zeigt auf die Hauptkategorie; `bereich` traegt
 *   den Top-Level-Slug DENORMALISIERT mit (schneller Bereichsfilter ohne Self-Join).
 *
 * `slug` ist plattform-weit eindeutig (URL-/Filter-Anker) – Unterkategorien sind
 * daher bereichs-praefigiert (z. B. "folierung-primer-kleber" vs. "ppf-primer").
 * `sdbPflicht=true` markiert Chemie-Kategorien: ein Produkt darin verlangt spaeter
 * ein Sicherheitsdatenblatt (SDB) am Produkt (durchgereicht in spaeteren PRs).
 */
@Index(['bereich', 'aktiv'])
@Entity('marketplace_categories')
export class MarketplaceCategory {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** null = Hauptkategorie; sonst Id der Hauptkategorie (2 Ebenen, kein tieferer Baum). */
  @Index()
  @Column({ nullable: true }) parentId: string | null;

  /** Plattform-weit eindeutiger Slug (z. B. "aufbereitung-polituren"). */
  @Index({ unique: true })
  @Column() slug: string;

  @Column() name: string;

  /**
   * Denormalisierter Top-Level-Bereich: folierung | aufbereitung | ppf | sonstiges.
   * Bei Hauptkategorien identisch mit `slug`, bei Unterkategorien = Slug des Parents.
   */
  @Column({ default: 'sonstiges' }) bereich: string;

  /** Sortier-Reihenfolge innerhalb der Ebene (aufsteigend). */
  @Column({ type: 'int', default: 0 }) sortIndex: number;

  @Column({ default: true }) aktiv: boolean;

  /** Chemie-Kategorie: Sicherheitsdatenblatt am Produkt Pflicht (GHS/CLP). */
  @Column({ default: false }) sdbPflicht: boolean;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
