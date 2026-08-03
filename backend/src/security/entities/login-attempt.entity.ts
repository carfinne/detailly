import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Neustart-feste Login-Fehlversuchs-Zaehler (Sentinel Teil 1 – Persistenz).
 *
 * Bis hierher hielt der LoginGuardService seine Zaehler NUR im Arbeitsspeicher
 * (zwei Maps). Folge: jeder Neustart (Deploy/Absturz/Speicherdruck) setzte einen
 * laufenden Angreifer auf 0 zurueck. Diese Tabelle ist die dauerhafte WAHRHEIT
 * hinter dem In-Memory-Cache: beim Start hydratisiert der Guard seine Maps aus
 * ihr, bei jedem Fehlversuch schreibt er atomar durch.
 *
 * Zwei Zaehler-Arten (Spalte `scope`), exakt wie im Guard:
 *  - 'account' : Konto-Schluessel = Hash(IP + E-Mail) – begrenzt Lockout-DoS auf
 *                die eigene IP-Konto-Kombination.
 *  - 'ip'      : reiner IP-Zaehler = Hash(IP) – faengt Credential-Stuffing.
 *
 * DSGVO / Datenminimierung:
 *  - `keyHash` ist ein SHA-256-Hex (nie Klartext). Die 'account'-Kennung enthaelt
 *    die E-Mail des Anmeldeversuchs; sie wird NUR gehasht abgelegt (wie
 *    security_events.emailHash), damit hier NIE eine Liste echter Mailadressen
 *    aller Anmeldeversuche entsteht. Auch der reine IP-Zaehler wird gehasht (die
 *    IP selbst lebt – wo betrieblich noetig – im ip_blocks-/security_events-Log
 *    mit eigener 6-Abs.-1-lit.-f-Grundlage; dieser transiente Zaehler braucht
 *    keine lesbare Kennung, nur Wiedererkennung).
 *  - Rechtsgrundlage = Art. 6 Abs. 1 lit. f DSGVO (IT-Sicherheit, Brute-Force-
 *    Abwehr). Verhaeltnismaessigkeit: `expiresAt` begrenzt jede Zeile hart; der
 *    periodische Purge (ThreatDetectionService-Lauf) loescht abgelaufene Zeilen,
 *    sodass die Tabelle nicht durch erfundene Konten/IPs unbegrenzt waechst.
 */
@Index('UQ_login_attempts_scope_key', ['scope', 'keyHash'], { unique: true })
@Index('IDX_login_attempts_expires', ['expiresAt'])
@Entity('login_attempts')
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Zaehler-Art: 'account' (IP+E-Mail) oder 'ip' (reiner IP-Zaehler). */
  @Column({ type: 'text' })
  scope: 'account' | 'ip';

  /** SHA-256-Hex des scoped Schluessels (nie Klartext-E-Mail/-IP). */
  @Column({ type: 'text' })
  keyHash: string;

  /** Aktueller Fehlversuchs-Zaehlerstand im gleitenden Fenster. */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Zeitpunkt des letzten gezaehlten Fehlversuchs (Basis fuers gleitende Fenster). */
  @Column({ type: timestampColumnType() })
  lastFailAt: Date;

  /** Sperre gilt bis zu diesem Zeitpunkt; NULL = keine aktive Sperre. */
  @Column({ type: timestampColumnType(), nullable: true })
  lockedUntil: Date | null;

  /**
   * Zeitpunkt, ab dem die Zeile irrelevant ist (max. aus Fenster-Ablauf und
   * Sperr-Ablauf). Steuert Purge (loeschen, wenn <= now) UND Hydration (laden,
   * wenn > now). Indiziert.
   */
  @Column({ type: timestampColumnType() })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
