import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Meldung eines Inserats (z. B. verbotene Chemie, Spam, Betrug). Reine
 * Entity/Schema-Basis – die Melde-Logik (Endpunkte, Auto-Verbergen,
 * Betreiber-Bearbeitung) folgt in PR3.
 *
 * UNIQUE (inseratId, melderTenantId): ein Betrieb kann dasselbe Inserat nur
 * einmal melden (Doppel-/Spam-Meldungen vermeiden).
 */
@Index(['inseratId', 'melderTenantId'], { unique: true })
@Entity('geraete_inserat_meldungen')
export class GeraeteInseratMeldung {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() inseratId: string;

  /** Meldender Betrieb (Mandantentrennung). */
  @Column() melderTenantId: string;

  /** Meldender Nutzer. */
  @Column() melderUserId: string;

  /** Siehe MELDUNG_GRUND. */
  @Column() grund: string;

  @Column({ type: 'text', nullable: true }) kommentar: string | null;

  /** Siehe MELDUNG_STATUS (offen/erledigt/verworfen). */
  @Column({ default: 'offen' }) status: string;

  /** Betreiber-Nutzer, der die Meldung bearbeitet hat (PR3). */
  @Column({ nullable: true }) bearbeitetVonUserId: string | null;

  @Column({ type: timestampColumnType(), nullable: true }) bearbeitetAm: Date | null;

  @CreateDateColumn() createdAt: Date;
}
