import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum UserRole {
  // --- Plattform-Ebene (Detailly als Betreiber der Software) ---
  PLATFORM_ADMIN = 'platform_admin', // volle Plattform-Kontrolle
  PLATFORM_ANALYST = 'platform_analyst', // nur Plattform-Auswertungen (read-only)
  PLATFORM_SUPPORT = 'platform_support', // Einblick/Support, kein Billing/keine Rollen
  // --- Betriebs-Ebene (Kunde = Werkstatt, die die Software nutzt) ---
  OWNER = 'owner', // Inhaber/Admin des Betriebs
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  RECEPTIONIST = 'receptionist',
}

/** Plattform-Rollen (Detailly) – betriebsuebergreifend, kein Mandant. */
export const PLATTFORM_ROLLEN = [
  UserRole.PLATFORM_ADMIN,
  UserRole.PLATFORM_ANALYST,
  UserRole.PLATFORM_SUPPORT,
];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: enumColumnType(), enum: UserRole, default: UserRole.TECHNICIAN })
  role: UserRole;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  /**
   * Interner Stundenlohn (€) fuer die Lohnkosten-Auswertung pro Auftrag.
   * GEHALTSDATEN: wird ausschliesslich ueber den Leitung-only /employees-Endpunkt
   * gelesen/gesetzt und fuer die Lohnkosten nur der Leitung berechnet. /auth/me
   * liefert nur den kuratierten JWT-User (kein Leak).
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stundenlohn: number;

  @Column({ nullable: true, type: timestampColumnType() })
  lastLoginAt: Date;

  /**
   * Zeitpunkt der letzten Passwort-Aenderung (z. B. via Reset). JWTs, die VOR
   * diesem Zeitpunkt ausgestellt wurden, werden in der JwtStrategy abgelehnt –
   * so entwertet ein Passwort-Reset bestehende Sessions (OWASP).
   */
  @Column({ nullable: true, type: timestampColumnType() })
  passwordChangedAt: Date;

  /** Zeitpunkt der E-Mail-Bestaetigung (Double-Opt-in). null = noch unbestaetigt. */
  @Column({ nullable: true, type: timestampColumnType() })
  emailVerifiedAt: Date;

  /** SHA-256-Hash des aktuellen E-Mail-Bestaetigungs-Tokens (nie Klartext). */
  @Column({ nullable: true, select: false })
  emailVerificationTokenHash: string;

  @Column({ nullable: true, type: timestampColumnType() })
  emailVerificationExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
