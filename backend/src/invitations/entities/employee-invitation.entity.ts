import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Persistierte Status-Werte einer Mitarbeiter-Einladung. BEWUSST als Code-
 * Konstante + varchar-Spalte (KEIN DB-Enum) gehalten – neue Werte erfordern so
 * keine Enum-Schema-Migration und keinen Dev-Reseed (Reseed-Falle).
 *
 * 'abgelaufen' ist KEIN gespeicherter Status, sondern wird zur Anzeige aus
 * `status==='offen' && expiresAt < now` ABGELEITET (kein Ablauf-Sweeper noetig,
 * analog zum Reset-Token, dessen Gueltigkeit ebenfalls nur beim Einloesen
 * geprueft wird).
 */
export const INVITATION_STATUS = ['offen', 'eingeloest', 'zurueckgezogen'] as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[number];

/**
 * Einmal-Einladung eines Mitarbeiters in einen Betrieb (Tenant).
 *
 * Sicherheit (Muster: password_reset_tokens):
 *  - Es wird NIE das Klartext-Token gespeichert, nur sein SHA-256-Hash. Der
 *    Rohwert existiert ausschliesslich im Einladungs-Link (Mail). Selbst bei
 *    DB-Leak ist kein gueltiger Einloese-Link rekonstruierbar.
 *  - `usedAt` erzwingt Single-Use (atomarer, bedingter Claim beim Einloesen),
 *    `expiresAt` begrenzt die Gueltigkeit zeitlich (7 Tage).
 *  - Die `role` wird HIER (aus der Einladung) festgeschrieben und ist beim
 *    Einloesen die EINZIGE Quelle der Rolle – nie der Request-Body des
 *    Eingeladenen (Privilege-Escalation-Schutz).
 *  - `tenantId` bindet die Einladung an genau EINEN Betrieb; das Einloesen legt
 *    den Nutzer ausschliesslich in DIESEM Tenant an.
 */
// Index-Namen EXAKT wie in der Baseline-Migration (1783456549418), damit die
// Dev-DB (synchronize aus dieser Entity) und die Prod-DB (Migration) dieselben
// Indizes unter denselben Namen tragen -> kein Schema-Drift bei migration:generate.
@Index('IDX_employee_invitations_tenant', ['tenantId'])
@Index('IDX_employee_invitations_tenant_status', ['tenantId', 'status'])
@Index('IDX_employee_invitations_tenant_email', ['tenantId', 'email'])
@Entity('employee_invitations')
export class EmployeeInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ziel-Betrieb der Einladung (Mandantentrennung). */
  @Column()
  tenantId: string;

  /** Eingeladene E-Mail-Adresse (normalisiert: getrimmt + lowercase). */
  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  /**
   * Zugewiesene Betriebs-Rolle (Wert aus TENANT_ROLLEN). varchar statt DB-Enum,
   * damit neue Rollen keinen Reseed erzwingen; Validierung uebernimmt das DTO
   * (@IsIn(TENANT_ROLLEN)) und der Service (Rang-/Ebenen-Wache).
   */
  @Column()
  role: string;

  /** SHA-256-Hex des rohen Tokens. Eindeutig -> direkte Suche beim Einloesen. */
  @Index('IDX_employee_invitations_tokenHash', { unique: true })
  @Column()
  tokenHash: string;

  @Column({ type: timestampColumnType() })
  expiresAt: Date;

  /** offen | eingeloest | zurueckgezogen (siehe INVITATION_STATUS). */
  @Column({ default: 'offen' })
  status: InvitationStatus;

  /** Auslösende Leitung (OWNER/MANAGER) – zur Nachvollziehbarkeit. */
  @Column({ nullable: true })
  invitedByUserId: string | null;

  /** Beim Einloesen angelegter Nutzer (Audit-Verknuepfung). */
  @Column({ nullable: true })
  acceptedUserId: string | null;

  /**
   * Gesetzt beim Einloesen (Single-Use-Claim) ODER beim Zurueckziehen. Ein
   * gesetztes `usedAt` macht den Link tot – der bedingte UPDATE `usedAt IS NULL`
   * gewinnt nur genau einmal (Race-Schutz auch auf Postgres).
   */
  @Column({ type: timestampColumnType(), nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
