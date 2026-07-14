import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

/** Lebenszyklus eines Newsletter-Abonnenten (Double-Opt-in, § 7 UWG). */
export enum NewsletterStatus {
  /** Angemeldet, aber noch NICHT bestaetigt (kein Versand an diese Adresse). */
  PENDING = 'pending',
  /** Double-Opt-in abgeschlossen -> erhaelt den Newsletter. */
  CONFIRMED = 'confirmed',
  /** Abgemeldet -> kein Versand mehr. */
  UNSUBSCRIBED = 'unsubscribed',
}

/**
 * Plattform-Newsletter-Abonnent (Detailly als Verantwortlicher, KEIN Tenant-Scope).
 *
 * Rechtssicherheit (docs/RECHTLICHE_ABSICHERUNG.md, § 7 Abs. 2 Nr. 2 UWG,
 * BGH I ZR 164/09):
 *  - Double-Opt-in: Anmeldung erzeugt `pending`; erst der Klick auf den
 *    Bestaetigungs-Link setzt `confirmed`.
 *  - Nachweis/Beweispflicht: `angemeldetAm` (Anmeldung) UND `bestaetigtAm`
 *    (Bestaetigung) werden protokolliert; `abgemeldetAm` dokumentiert die
 *    Abmeldung.
 *  - PII-minimal: nur E-Mail (lowercase-normalisiert, unique) + Status +
 *    Zeitstempel + Token-Hash. KEIN Name, keine weiteren Daten.
 *
 * Token-Sicherheit: gespeichert wird NIE das Klartext-Token, sondern nur sein
 * SHA-256-Hash (`select:false`). Das rohe Token existiert ausschliesslich im
 * jeweiligen Mail-Link (Bestaetigung bzw. Abmeldung). Selbst bei DB-Leak laesst
 * sich damit kein gueltiger Link rekonstruieren. Da nur der Hash gespeichert
 * wird, wird der rohe Abmelde-Token pro Newsletter-Versand frisch erzeugt und
 * der Hash rotiert (der aktuellste Newsletter enthaelt immer einen gueltigen
 * 1-Klick-Abmelde-Link).
 */
@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Lowercase-normalisiert + unique -> genau ein Datensatz pro Adresse. */
  @Index({ unique: true })
  @Column() email: string;

  @Column({ type: enumColumnType(), enum: NewsletterStatus, default: NewsletterStatus.PENDING })
  status: NewsletterStatus;

  /** SHA-256-Hex des aktuell gueltigen Roh-Tokens. Nie im Klartext gespeichert. */
  @Index()
  @Column({ select: false }) tokenHash: string;

  /** Zeitpunkt der Anmeldung (Beweispflicht § 7 UWG). */
  @Column({ type: timestampColumnType() }) angemeldetAm: Date;

  /** Zeitpunkt der Double-Opt-in-Bestaetigung. null = noch unbestaetigt. */
  @Column({ type: timestampColumnType(), nullable: true }) bestaetigtAm: Date | null;

  /** Zeitpunkt der Abmeldung. null = aktiv/pending. */
  @Column({ type: timestampColumnType(), nullable: true }) abgemeldetAm: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
