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

  /** User.id, der den Verbrauch erfasst hat (Revision). */
  @Column() erfasstVon: string;

  @CreateDateColumn() createdAt: Date;
}
