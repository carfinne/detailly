import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Einmal-Token fuer "Passwort vergessen".
 *
 * Sicherheit: Es wird NIE das Klartext-Token gespeichert, sondern nur sein
 * SHA-256-Hash. Das rohe Token existiert ausschliesslich im Versand-Link.
 * Damit ist selbst bei DB-Leak kein gueltiger Reset-Link rekonstruierbar.
 * `usedAt` macht das Token einmalig, `expiresAt` zeitlich begrenzt (1 h).
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  userId: string;

  /** SHA-256-Hex des rohen Tokens. Eindeutig -> direkte Suche beim Einloesen. */
  @Index({ unique: true })
  @Column()
  tokenHash: string;

  @Column({ type: timestampColumnType() })
  expiresAt: Date;

  /** Gesetzt beim Einloesen ODER beim Entwerten (neuer Request / nach Reset). */
  @Column({ type: timestampColumnType(), nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
