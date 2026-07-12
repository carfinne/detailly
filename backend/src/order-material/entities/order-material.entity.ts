import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Auf einen Auftrag verbrauchtes Material (Lager -> Auftrag). Beim Erfassen sinkt
 * der Produkt-Bestand, beim Loeschen wird er zurueckgebucht. Produktname/Einheit
 * werden als Snapshot gehalten, damit die Historie lesbar bleibt, falls das
 * Produkt spaeter entfernt wird. Tenant-getrennt.
 */
@Entity('order_materials')
export class OrderMaterial {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Index()
  @Column() orderId: string;

  @Column() productId: string;

  /** Snapshot fuer die Anzeige (ueberlebt das Loeschen des Produkts). */
  @Column() produktName: string;
  @Column({ default: 'Stueck' }) einheit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 }) menge: number;

  /**
   * Optionale Verortung: von welcher konkreten Restrolle wurde gebucht. Feinere
   * Zuordnung DESSELBEN Materials, das auch den groben `bestand` fuellt - eine
   * Buchung mit Rolle senkt daher BEIDES (bestand UND FolienRolle.restLfm), das
   * ist KEIN Doppelabzug. Nullable: Buchung ohne Rollenbezug bleibt der Normalfall.
   */
  @Column({ nullable: true }) folienRolleId: string;

  /**
   * Geplanter Verbrauch in Laufmetern (kommt aus dem lfm-Rechner, parallel).
   * Grundlage der Verschnitt-KPI (geplant vs. verbraucht). Null = keine Planzahl.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) geplantLfm: number;

  /** User.id, der den Verbrauch erfasst hat (Revision). */
  @Column() erfasstVon: string;

  @CreateDateColumn() createdAt: Date;
}
