import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

/**
 * Standort eines Betriebs (Mehr-Standort/Franchise). Order/Appointment/Vehicle
 * referenzieren einen Standort ueber `locationId`. Tenant-getrennt.
 */
@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column() name: string;
  @Column({ nullable: true }) street: string;
  @Column({ nullable: true }) city: string;
  @Column({ nullable: true }) postalCode: string;
  @Column({ nullable: true }) phone: string;

  @Column({ default: true }) isActive: boolean;

  @CreateDateColumn() createdAt: Date;
  /** Soft-Delete: gesetzt = geloescht. find/findOne blenden solche Zeilen aus,
   *  die Zeile bleibt aber fuer FK-Referenzen (Order.locationId) + Historie erhalten. */
  @DeleteDateColumn() deletedAt: Date;
}
