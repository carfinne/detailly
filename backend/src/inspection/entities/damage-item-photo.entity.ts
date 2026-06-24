import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Join-Tabelle fuer die n:m-Zuordnung Foto <-> Schaden. Ein Foto kann mehreren
 * Schaeden, ein Schaden mehreren Fotos zugeordnet sein.
 *
 * Mandantentrennung gilt auch fuer die Join-Tabelle (`tenantId` + @Index()).
 * Der Unique-Index verhindert Doppelzuordnung beim Re-Sync (idempotent).
 */
@Entity('damage_item_photos')
@Index(['damageItemId', 'photoId'], { unique: true })
export class DamageItemPhoto {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;

  @Column() damageItemId: string;
  @Column() photoId: string;

  @Column({ type: 'boolean', default: false }) istHauptfoto: boolean;

  @CreateDateColumn() createdAt: Date;
}
