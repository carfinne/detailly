import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Bild eines Geraete-Inserats. Reine Entity/Schema-Basis – die Upload-Logik
 * (Speicherung, Groessen-/Typ-Pruefung, tenant-scoped Auslieferung) folgt in
 * PR2. `datei` ist der spaetere Speicher-Pfad/Key (text).
 */
@Entity('geraete_inserat_bilder')
export class GeraeteInseratBild {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() inseratId: string;

  /** Speicher-Pfad/Key des Bildes (Upload-Logik = PR2). */
  @Column({ type: 'text' }) datei: string;

  /** Sortierreihenfolge in der Galerie. */
  @Column({ type: 'int', default: 0 }) sortIndex: number;

  @CreateDateColumn() createdAt: Date;
}
