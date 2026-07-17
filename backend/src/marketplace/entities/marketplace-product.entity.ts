import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType, timestampColumnType } from '../../common/database.types';

/**
 * Produkt im B2B-Marktplatz (plattform-weit). Zwei Vertriebswege je Produkt:
 * - `affiliateUrl` gesetzt: Kauf BEIM HAENDLER via Affiliate-Link (`klicks`
 *   ist der denormalisierte Zaehler; Einzelklicks als MarketplaceClick).
 * - `bestellbar`: direkte In-App-Bestellung (MarketplaceOrder) mit Provision
 *   fuer den Betreiber. Braucht einen gesetzten `preis`.
 * Mindestens einer der beiden Wege muss aktiv sein (Service-Validierung).
 */
@Index(['aktiv', 'bereich'])
@Entity('marketplace_products')
export class MarketplaceProduct {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() dealerId: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) beschreibung: string;

  /**
   * Fester Bereich fuer die Haupt-Navigation im Marktplatz:
   * folierung | aufbereitung | ppf | sonstiges.
   */
  @Index()
  @Column({ default: 'sonstiges' }) bereich: string;

  /** Marke/Hersteller (z. B. "3M", "Koch Chemie") – Schnellfilter im Katalog. */
  @Column({ nullable: true }) marke: string;

  /** Legacy: freie Kategorie (durch bereich+marke abgeloest, bleibt fuer Altdaten). */
  @Column({ nullable: true }) kategorie: string;

  /** Anzeigepreis (z. B. "ab 289 €"); null = Preis beim Haendler. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) preis: number;

  /** Optionaler Zusatz zum Preis (z. B. "pro Rolle", "ab"). */
  @Column({ nullable: true }) preisHinweis: string;

  @Column({ nullable: true }) bildUrl: string;

  /** Detailly-Affiliate-Link zum Haendler-Shop (optional bei bestellbaren Produkten). */
  @Column({ nullable: true }) affiliateUrl: string;

  /** Direkt in der App bestellbar (setzt einen gesetzten preis voraus). */
  @Column({ default: false }) bestellbar: boolean;

  @Column({ default: true }) aktiv: boolean;

  /** Denormalisierter Klick-Zaehler (atomar inkrementiert). */
  @Column({ default: 0 }) klicks: number;

  // --- Marktplatz-Ausbau PR1 (Datenmodell-Fundament) --------------------------
  // Alle Felder ADDITIV (nullable bzw. Default): Legacy-Produkte ohne Kategorie/
  // SDB bleiben gueltig; `bereich`/`marke` bleiben als Fallback erhalten.

  /**
   * Zuordnung zur Unterkategorie (FK -> marketplace_categories.id). Nullable:
   * Altbestand bleibt ueber `bereich`+`marke` katalogisiert (Fallback-Filter).
   */
  @Index()
  @Column({ nullable: true }) categoryId: string | null;

  /** Herkunftsland als ISO-3166-1 alpha-2 (z. B. "DE"); nullable. */
  @Column({ nullable: true }) herkunftsland: string | null;

  /**
   * Logischer Pfad des Sicherheitsdatenblatts (SDB). BEWUSST kein oeffentlich-
   * statischer Mount – Abruf spaeter ueber eine guard-geschuetzte Route.
   */
  @Column({ type: 'text', nullable: true }) sdbDatei: string | null;

  @Column({ type: timestampColumnType(), nullable: true }) sdbHochgeladenAm: Date | null;

  /**
   * sha256 ueber die KLARTEXT-Bytes des SDB (Integritaet/Dedup-Reserve). Wird beim
   * Upload gesetzt; nullable fuer Altbestand ohne SDB. Wie die uebrigen Marktplatz-
   * Ausbau-Spalten additiv (Dev-synchronize; Baseline-Migration zuletzt).
   */
  @Column({ type: 'text', nullable: true }) sdbHash: string | null;

  /** Versandkosten (brutto); null = auf Anfrage / nicht hinterlegt. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) versandKosten: number | null;

  @Column({ type: 'text', nullable: true }) versandHinweis: string | null;

  /** Lieferzeit in Tagen; null = unbekannt. */
  @Column({ type: 'int', nullable: true }) lieferzeitTage: number | null;

  /** Lagerbestand; null = unbekannt/unbegrenzt (Affiliate/Beim-Haendler). */
  @Column({ type: 'int', nullable: true }) bestand: number | null;

  /** Redaktioneller Hervorhebungs-Schalter (Betreiber). */
  @Column({ default: false }) istHighlight: boolean;

  @Column({ type: 'text', nullable: true }) anwendungshinweise: string | null;

  /** Frei strukturierte technische Daten (portabel: jsonb / simple-json). */
  @Column({ type: jsonColumnType(), nullable: true }) technischeDaten: Record<string, unknown> | null;

  /** Inhalts-/Gebindemenge als Freitext (z. B. "500 ml", "5 L"). */
  @Column({ nullable: true }) inhaltMenge: string | null;

  /** Denormalisierter Bewertungs-Schnitt (0.00–5.00); Quelle: marketplace_reviews. */
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 }) bewertungSchnitt: number;

  /** Denormalisierte Anzahl aktiver Bewertungen. */
  @Column({ type: 'int', default: 0 }) bewertungAnzahl: number;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
