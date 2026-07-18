import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../common/database.types';
import type { SecurityEventSeverity, SecurityEventType } from '../security.constants';

/**
 * Plattformweites Sicherheits-Ereignis-Protokoll (Sentinel Teil 1).
 *
 * Muster wie audit-log.entity, aber PLATTFORMWEIT (nicht tenant-gebunden) und
 * IP-tragend. Anders als der fachliche Audit-Trail (Schreibvorgaenge je Betrieb)
 * dient diese Tabelle der IT-Sicherheit: Fehl-Logins, Sperren, 2FA-Fehlversuche.
 *
 * DSGVO / Datenminimierung:
 *  - `ip` ist personenbezogen. Rechtsgrundlage = Art. 6 Abs. 1 lit. f DSGVO
 *    (berechtigtes Interesse an der System-/IT-Sicherheit). Aufbewahrung ist
 *    ueber den Auto-Purge (SecurityEventService) auf SECURITY_EVENT_TTL_DAYS
 *    begrenzt.
 *  - Die E-Mail wird NIE im Klartext gespeichert, ausschliesslich als SHA-256
 *    (`emailHash`) – erlaubt Korrelation ("dasselbe Konto") ohne Klartext-PII.
 *  - `details` traegt nur nicht-sensiblen Kontext (Zaehlerstand, Sperrdauer,
 *    Scope). NIE Passwoerter, Tokens, TOTP-Codes oder Recovery-Codes.
 */
@Index('IDX_security_events_created', ['createdAt'])
@Index('IDX_security_events_ip', ['ip'])
@Index('IDX_security_events_type_created', ['type', 'createdAt'])
@Entity('security_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ereignis-Typ (TEXT + @IsIn – s. SECURITY_EVENT_TYPES). */
  @Column({ type: 'text' })
  type: SecurityEventType;

  /** Schweregrad (TEXT – s. SECURITY_EVENT_SEVERITY). */
  @Column({ type: 'text', default: 'info' })
  severity: SecurityEventSeverity;

  /** Client-IP (personenbezogen! nullable; hinter Reverse-Proxy korrekt aufgeloest). */
  @Column({ type: 'text', nullable: true })
  ip: string | null;

  /** SHA-256-Hash der (normalisierten) E-Mail – NIE Klartext. */
  @Column({ type: 'text', nullable: true })
  emailHash: string | null;

  /** Betroffener Nutzer (sofern die E-Mail einem Konto zuordenbar war). */
  @Column({ type: 'text', nullable: true })
  userId: string | null;

  /** Betroffener Betrieb (sofern zuordenbar); NULL = nicht zuordenbar. */
  @Column({ type: 'text', nullable: true })
  tenantId: string | null;

  /** Nicht-sensibler Kontext (Zaehlerstand, Sperrdauer, Scope). NIE Secrets. */
  @Column({ type: jsonColumnType(), nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
