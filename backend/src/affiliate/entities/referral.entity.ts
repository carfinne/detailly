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
 * Eine konkrete Werbung: Betrieb A (`referrerTenantId`, Code-Inhaber) hat Betrieb
 * B (`referredTenantId`, neu registriert) geworben.
 *
 * WICHTIG (Zugriff/Isolation): Referrals sind fachlich betriebsUEBERGREIFEND
 * (sie verbinden zwei Tenants). Der Zugriff ist dennoch strikt geschnitten – ein
 * Tenant sieht ausschliesslich SEINE eigenen Werbungen (WHERE referrerTenantId =
 * user.tenantId), die Plattform sieht alles (read-only). Es gibt KEINEN Endpunkt,
 * der einem Tenant fremde Werbungen zeigt.
 *
 * UNIQUE(referredTenantId): ein Betrieb kann nur EINMAL geworben worden sein
 * (verhindert Doppelzuordnung/Doppel-Gutschrift). Bewusst FK-frei (varchar).
 */
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Werber (Inhaber des genutzten Codes). Nach diesem Feld scopet der Tenant. */
  @Index()
  @Column()
  referrerTenantId: string;

  /** Geworbener (neu registrierter) Betrieb. Nur EINE Werbung je Betrieb. */
  @Index({ unique: true })
  @Column()
  referredTenantId: string;

  /** Snapshot des genutzten Codes (Nachweis, auch falls der Code neu vergeben wird). */
  @Column()
  code: string;

  /** Siehe REFERRAL_STATUS ('registriert' | 'zahlend'). varchar + @IsIn (kein DB-Enum). */
  @Column({ default: 'registriert' })
  status: string;

  /**
   * Gutschrift-Anwartschaft verdient? Wird beim Wechsel auf „zahlend" EINMALIG
   * (idempotent) gesetzt. KEINE echte Zahlungsverrechnung – die kommt mit Stripe.
   */
  @Column({ default: false })
  belohnungAnwartschaft: boolean;

  /** Art der Anwartschaft (siehe REWARD_TYPES), z. B. 'monat_basic'. null = keine. */
  @Column({ nullable: true })
  belohnungTyp: string | null;

  /** Zeitpunkt des Wechsels auf „zahlend" (bezahltes Abo). null = noch nicht zahlend. */
  @Column({ nullable: true, type: timestampColumnType() })
  zahlendSeit: Date | null;

  /** Registrierungs-/Zuordnungszeitpunkt (= Anlage der Werbung). */
  @CreateDateColumn() createdAt: Date;

  @UpdateDateColumn() updatedAt: Date;
}
