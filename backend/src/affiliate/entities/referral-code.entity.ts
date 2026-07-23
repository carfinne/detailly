import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Der Empfehlungs-Code EINES Betriebs (Werber). Genau ein Code je Tenant
 * (UNIQUE tenantId); der Code selbst ist global eindeutig (UNIQUE code) und wird
 * fuer den exakten, listing-freien Lookup bei der Registrierung genutzt.
 *
 * Bewusst FK-frei (varchar tenantId, wie ueberall im Projekt) – SQLite-Dev und
 * Postgres-Prod tragen dieselbe Spalte. Kein Secret: der Code ist zum Teilen
 * gedacht (steht im Einladungs-Link).
 */
@Entity('referral_codes')
export class ReferralCode {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Inhaber-Betrieb dieses Codes (genau ein Code je Betrieb). */
  @Index({ unique: true })
  @Column()
  tenantId: string;

  /** Kurzer, global eindeutiger Code (verwechslungsarmes Alphabet, 8 Zeichen). */
  @Index({ unique: true })
  @Column()
  code: string;

  @CreateDateColumn() createdAt: Date;
}
