import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Bewerbungs-/Freigabe-Status eines Haendlers (Welle 3: Grosshaendler-Portal).
 * KEINE Selbst-Freischaltung: oeffentliche Bewerbungen landen als 'beantragt'
 * und werden ausschliesslich vom Betreiber freigegeben oder abgelehnt. Default
 * 'freigegeben' haelt BESTANDS-Haendler (Seed-/Platform-Anlage vor Welle 3)
 * rueckwaertskompatibel im Katalog sichtbar.
 */
export type MarketplaceDealerStatus = 'beantragt' | 'freigegeben' | 'abgelehnt';

/**
 * Haendler im B2B-Marktplatz. PLATTFORM-WEITER Inhalt (bewusst OHNE tenantId):
 * Detailly kuratiert den Katalog zentral, alle Betriebe sehen dieselben
 * Haendler/Produkte. Verdienst laeuft ueber Affiliate-Links der Produkte UND
 * ueber die Provision auf In-App-Bestellungen (provisionSatz).
 */
@Entity('marketplace_dealers')
export class MarketplaceDealer {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  @Column({ nullable: true }) logoUrl: string;

  @Column({ nullable: true }) webseite: string;

  /** Kontakt fuer Bestell-Benachrichtigungen an den Haendler. */
  @Column({ nullable: true }) kontaktEmail: string;

  /**
   * Provisions-Satz in PROZENT, den der Betreiber (Finn) je In-App-Bestellung
   * dieses Haendlers erhaelt. Wird auf jeder Bestellposition als Snapshot
   * eingefroren -> spaetere Satz-Aenderungen ruehren alte Belege nicht.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  provisionSatz: number;

  /**
   * Geheimer Token fuer das Haendler-Portal (/haendler/<token>): eigene
   * Produkte pflegen + Bestellungen abwickeln. Capability-URL wie Kalender-/
   * Freigabe-Token, bewusst OHNE eigenes Login-System (kleine Angriffsflaeche).
   * Klartext (muss per WHERE auffindbar sein) + select:false; bei Leck
   * regenerierbar.
   */
  @Column({ nullable: true, select: false })
  uploadToken: string;

  @Column({ default: true }) aktiv: boolean;

  /** Freigabe-Workflow (Welle 3), s. MarketplaceDealerStatus. */
  @Column({ default: 'freigegeben' })
  status: MarketplaceDealerStatus;

  /** Ansprechpartner aus der Bewerbung (Person beim Grosshaendler). */
  @Column({ nullable: true }) ansprechpartner: string;

  @Column({ nullable: true }) telefon: string;

  /** Freitext-Anschrift; wird bei Ablehnung genullt (PII-Sparsamkeit). */
  @Column({ nullable: true }) adresse: string;

  /** USt-IdNr (Pflicht bei Bewerbung; B2B-Seriositaets-Check des Betreibers). */
  @Column({ nullable: true }) ustIdNr: string;

  /** Sortiment als CSV der Marktplatz-Bereiche (z. B. "folierung,ppf"). */
  @Column({ nullable: true }) sortiment: string;

  /** Bewerbungs-Nachricht; wird bei Ablehnung genullt (PII-Sparsamkeit). */
  @Column({ type: 'text', nullable: true }) nachricht: string;

  /** Eingangszeitpunkt der Bewerbung (null bei direkt angelegten Haendlern). */
  @Column({ type: timestampColumnType(), nullable: true }) beantragtAm: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
