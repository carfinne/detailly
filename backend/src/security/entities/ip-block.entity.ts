import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';
import type { IpBlockSeverity } from '../security.constants';

/**
 * Aktive IP-Sperren (Sentinel Teil 2).
 *
 * Plattformweit (NICHT tenant-gebunden). Zwei Quellen:
 *  - `createdBy = 'system'`  : automatische, IMMER befristete Sperre (expiresAt
 *    gesetzt) durch den ThreatDetectionService bei Fehl-Login-/Scan-Fluten.
 *  - `createdBy = <userId>`  : manuelle Sperre eines PLATFORM_ADMIN. Darf
 *    dauerhaft sein (expiresAt = NULL).
 *
 * DSGVO / Datenminimierung:
 *  - `ip` ist personenbezogen. Rechtsgrundlage = Art. 6 Abs. 1 lit. f DSGVO
 *    (berechtigtes Interesse an der IT-Sicherheit; Abwehr von Brute-Force/Scans).
 *    Verhaeltnismaessigkeit: automatische Sperren sind stets temporaer (TTL ueber
 *    `expiresAt`); der ThreatDetectionService/Purge deaktiviert abgelaufene
 *    Sperren. Der Security-Event-Auto-Purge begrenzt zusaetzlich die Historie.
 *  - `reason` traegt nur einen internen Grund-String (keine PII, kein Body).
 *
 * `severity`/`createdBy`/`reason` sind TEXT-Spalten (kein Postgres-`enum`, vgl.
 * security_events) mit @IsIn-Validierung im DTO.
 */
@Index('IDX_ip_blocks_ip', ['ip'])
@Index('IDX_ip_blocks_active', ['active'])
@Index('IDX_ip_blocks_created', ['createdAt'])
@Entity('ip_blocks')
export class IpBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Gesperrte Client-IP (personenbezogen; normalisiert ohne ::ffff:-Praefix). */
  @Column({ type: 'text' })
  ip: string;

  /** Interner Grund (z. B. 'auto:login_fail_flood' oder manueller Freitext). */
  @Column({ type: 'text' })
  reason: string;

  /** Schweregrad (TEXT – s. IP_BLOCK_SEVERITY). */
  @Column({ type: 'text', default: 'warn' })
  severity: IpBlockSeverity;

  /** Wer die Sperre gesetzt hat: 'system' (auto) oder die PLATFORM_ADMIN-userId. */
  @Column({ type: 'text' })
  createdBy: string;

  /**
   * Ablauf der Sperre (TTL). NULL = dauerhaft (nur bei manueller Sperre erlaubt).
   * Automatische Sperren setzen IMMER einen Wert.
   */
  @Column({ type: timestampColumnType(), nullable: true })
  expiresAt: Date | null;

  /** Zeitpunkt der (manuellen) Aufhebung; NULL solange aktiv. */
  @Column({ type: timestampColumnType(), nullable: true })
  releasedAt: Date | null;

  /** Wer aufgehoben hat (PLATFORM_ADMIN-userId oder 'system' beim Auto-Purge). */
  @Column({ type: 'text', nullable: true })
  releasedBy: string | null;

  /**
   * Ob die Sperre aktiv gilt. Wird beim Aufheben/Ablaufen auf false gesetzt
   * (statt die Zeile zu loeschen -> nachvollziehbare Historie fuers Betreiber-
   * Dashboard, bis der Purge greift).
   */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
