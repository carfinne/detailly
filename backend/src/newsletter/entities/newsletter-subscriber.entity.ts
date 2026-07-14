import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';

/** Lebenszyklus eines Newsletter-Abonnenten (Double-Opt-in, § 7 UWG). */
export enum NewsletterStatus {
  /** Angemeldet, aber noch NICHT bestaetigt (kein Versand an diese Adresse). */
  PENDING = 'pending',
  /** Double-Opt-in abgeschlossen -> erhaelt den Newsletter. */
  CONFIRMED = 'confirmed',
  /** Abgemeldet -> kein Versand mehr. */
  UNSUBSCRIBED = 'unsubscribed',
}

/** Ein append-only Eintrag im Einwilligungs-Nachweis (§ 7 UWG Beweispflicht). */
export interface NachweisEintrag {
  ereignis: 'angemeldet' | 'bestaetigt' | 'abgemeldet';
  zeit: string; // ISO-Zeitstempel
}

/**
 * Plattform-Newsletter-Abonnent (Detailly als Verantwortlicher, KEIN Tenant-Scope).
 *
 * Rechtssicherheit (docs/RECHTLICHE_ABSICHERUNG.md, § 7 Abs. 2 Nr. 2 UWG,
 * BGH I ZR 164/09):
 *  - Double-Opt-in: Anmeldung erzeugt `pending`; erst der Klick auf den
 *    Bestaetigungs-Link setzt `confirmed`.
 *  - Nachweis/Beweispflicht: `angemeldetAm`/`bestaetigtAm`/`abgemeldetAm` spiegeln
 *    den AKTUELLEN Stand; `nachweisLog` haelt zusaetzlich JEDES Ereignis
 *    append-only fest (auch ueber Ab-/Neu-Anmeldung hinweg -> kein Nachweisverlust).
 *  - Abmeldung: 1-Klick-Link in JEDEM Newsletter, sofort wirksam.
 *  - PII-minimal: nur E-Mail (lowercase, unique) + Status + Zeitstempel + Tokens.
 *    KEIN Name.
 *
 * Zwei getrennte Token-Slots (bewusst):
 *  1. `tokenHash` — EINMALIGER Bestaetigungs-Token (nur SHA-256-Hash gespeichert,
 *     Rohwert lebt nur im Opt-in-Mail-Link). Wird nach der Bestaetigung entwertet
 *     (auf null gesetzt) -> Link ist danach nicht wiederverwendbar.
 *  2. `abmeldeToken` — STABILER Abmelde-Token, verschluesselt at rest
 *     (AES-256-GCM via `encryptedStringTransformer`). Er wird bei Versaenden NIE
 *     rotiert -> JEDER jemals verschickte Abmelde-Link bleibt gueltig, bis der
 *     Abonnent sich abmeldet (und bei einer spaeteren Neu-Anmeldung neu erzeugt
 *     wird). `abmeldeTokenHash` ist der SHA-256-Hash desselben Tokens fuer den
 *     schnellen Lookup beim Abmelden (GCM ist nicht deterministisch -> der
 *     Chiffretext taugt nicht als Suchschluessel).
 */
@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Lowercase-normalisiert + unique -> genau ein Datensatz pro Adresse. */
  @Index({ unique: true })
  @Column() email: string;

  @Column({ type: enumColumnType(), enum: NewsletterStatus, default: NewsletterStatus.PENDING })
  status: NewsletterStatus;

  /**
   * SHA-256-Hex des EINMALIGEN Bestaetigungs-Tokens. Nach der Bestaetigung
   * entwertet (null). Nie im Klartext gespeichert.
   */
  @Index()
  @Column({ nullable: true, select: false }) tokenHash: string | null;

  /**
   * STABILER Abmelde-Token, verschluesselt at rest. Rohwert wird zum Bauen des
   * Abmelde-Links beim Versand entschluesselt; er rotiert dabei NICHT.
   */
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  abmeldeToken: string | null;

  /** SHA-256-Hex des Abmelde-Tokens fuer den Lookup beim Abmelden. */
  @Index()
  @Column({ nullable: true, select: false }) abmeldeTokenHash: string | null;

  /** Zeitpunkt der letzten Anmeldung (aktueller Stand, Beweispflicht § 7 UWG). */
  @Column({ type: timestampColumnType() }) angemeldetAm: Date;

  /** Zeitpunkt der Double-Opt-in-Bestaetigung. null = noch unbestaetigt. */
  @Column({ type: timestampColumnType(), nullable: true }) bestaetigtAm: Date | null;

  /** Zeitpunkt der Abmeldung. null = aktiv/pending. */
  @Column({ type: timestampColumnType(), nullable: true }) abgemeldetAm: Date | null;

  /** Zeitpunkt der zuletzt versendeten Opt-in-Mail (Mail-Bombing-Cooldown). */
  @Column({ type: timestampColumnType(), nullable: true }) letzteOptInMailAm: Date | null;

  /** Append-only Einwilligungs-Nachweis: jedes Ereignis chronologisch, nie gekuerzt. */
  @Column({ type: jsonColumnType(), nullable: true }) nachweisLog: NachweisEintrag[] | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
