import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType } from '../../common/database.types';

/** Kategorie des Fotos (Doku-Zweck). */
export type DamagePhotoKategorie =
  | 'detail'
  | 'uebersicht'
  | 'vin'
  | 'tacho'
  | 'kennzeichen';

/**
 * Ein Foto, das zunaechst an der Inspektion haengt (nicht zwingend an einem
 * Schaden). Ueber `DamageItemPhoto` n:m an Schaeden verknuepfbar; `partId`
 * erlaubt zusaetzlich ein "Bauteil-Foto ohne konkreten Schaden".
 *
 * Phase 0: nur Metadaten-Create (Pfad als String). Upload/sharp-Pipeline
 * folgt in Phase 1.
 */
@Entity('damage_photos')
@Index(['tenantId', 'inspectionId'])
export class DamagePhoto {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() tenantId: string;
  @Column() inspectionId: string;

  /** "/uploads/{tenantId}/insp/{id}/IMG.webp". */
  @Column() pfad: string;
  @Column({ nullable: true }) thumbnailPfad: string;

  /** Bauteil-Foto OHNE konkreten Schaden. */
  @Index() @Column({ nullable: true }) partId: string;

  @Column({
    type: enumColumnType(),
    enum: ['detail', 'uebersicht', 'vin', 'tacho', 'kennzeichen'],
    default: 'detail',
  })
  kategorie: DamagePhotoKategorie;

  @Column({ type: 'int', nullable: true }) breite: number;
  @Column({ type: 'int', nullable: true }) hoehe: number;
  @Column({ type: 'int', nullable: true }) reihenfolge: number;

  @Column({ nullable: true }) clientUuid: string;

  @CreateDateColumn() createdAt: Date;
}
