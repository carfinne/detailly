import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  ENTWURF = 'entwurf',
  OFFEN = 'offen',
  BEZAHLT = 'bezahlt',
  STORNIERT = 'storniert',
}

export enum InvoiceKind {
  ANGEBOT = 'angebot',
  RECHNUNG = 'rechnung',
}

/**
 * Angebots-Lebenszyklus (Welle 1). BEWUSST ein SEPARATES Feld statt einer
 * Erweiterung von InvoiceStatus: der GoBD-Rechnungsfluss (entwurf/offen/bezahlt/
 * storniert) samt Statusregeln bleibt voellig unberuehrt. Nur fuer art=ANGEBOT
 * relevant (bei Rechnungen NULL). NULL wird in der Logik wie 'offen' behandelt
 * (Altbestand-Angebote vor Welle 1).
 */
export enum AngebotStatus {
  OFFEN = 'offen',
  ANGENOMMEN = 'angenommen',
  ABGELEHNT = 'abgelehnt',
  ABGELAUFEN = 'abgelaufen',
}

// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
// GoBD-Backstop (C1): eindeutige Belegnummer je Betrieb. Mehrere NULLs sind in
// SQLite wie Postgres "distinct" -> Rechnungs-Entwuerfe (nummer=NULL) bleiben
// erlaubt; die Nummer wird erst bei der Festsetzung vergeben. Die Vergabe ist
// zusaetzlich per withUniqueRetry serialisiert (invoices.service).
@Index(['tenantId', 'nummer'], { unique: true })
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /**
   * Fortlaufende Nummer je Tenant, z.B. "RE-2026-0001" oder "AN-2026-0001".
   * NULL bei Rechnungs-Entwuerfen: die RE-Nummer wird erst bei der Festsetzung
   * (Entwurf -> Offen) vergeben -> keine durch Entwuerfe verbrauchten Nummern.
   */
  @Column({ nullable: true }) nummer: string;

  @Column({ type: enumColumnType(), enum: InvoiceKind, default: InvoiceKind.RECHNUNG })
  art: InvoiceKind;

  @Column() customerId: string;
  @Column({ nullable: true }) orderId: string;

  @Column({ type: enumColumnType(), enum: InvoiceStatus, default: InvoiceStatus.ENTWURF })
  status: InvoiceStatus;

  @Column({ type: timestampColumnType(), nullable: true }) datum: Date;
  @Column({ type: timestampColumnType(), nullable: true }) leistungsdatum: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) netto: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mwst: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) brutto: number;

  /** Angewandter MwSt-Satz in Prozent (19/7/0). Default 19; aus ihm wird mwst berechnet. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 }) mwstSatz: number;

  // Paket 2 (Rechnung scharf machen): Faelligkeit/Mahnwesen. Alle additiv & nullable
  // (bzw. default 0), damit synchronize=true die Spalten in Dev konfliktfrei anlegt.
  /** Zahlungsziel als konkretes Datum (datum + zahlungsziel Tage). Nur fuer Rechnungen sinnvoll. */
  @Column({ type: timestampColumnType(), nullable: true }) faelligkeitsdatum: Date;
  /** Zahlungsfrist in Tagen, aus der faelligkeitsdatum abgeleitet wird (Default 14 im Service). */
  @Column({ nullable: true }) zahlungsziel: number;
  /** Datum des tatsaechlichen Zahlungseingangs (gesetzt von 'als bezahlt markieren'). */
  @Column({ type: timestampColumnType(), nullable: true }) zahldatum: Date;
  /** Mahnstufe 0..3 (0=keine, 1=Erinnerung, 2=1. Mahnung, 3=2. Mahnung). */
  @Column({ default: 0 }) mahnstufe: number;

  /** Zeitpunkt des letzten E-Mail-Versands an den Kunden. NULL = noch nie versendet. */
  @Column({ type: timestampColumnType(), nullable: true }) versendetAm: Date;

  @Column({ nullable: true }) sevdeskInvoiceId: string;

  /**
   * Geheimes Token fuer den oeffentlichen Download-Link (Kunde laedt sein PDF
   * ohne Login). Plaintext, select:false (nie in normalen Antworten), unique
   * (Kollision faellt fail-closed), regenerierbar. Zugriff nur ueber
   * GET /public/invoices/:token(/pdf) und nur fuer offene/bezahlte Belege.
   */
  @Index({ unique: true })
  @Column({ nullable: true, select: false }) downloadToken: string;

  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer }) hinweis: string;

  // --- Welle 1: Angebots-Varianten / Gueltigkeit / Annahme (F1+F2) ---
  /** Klammert die Varianten EINES Angebots-Sets (gemeinsame UUID). NULL = Einzelangebot. */
  @Index()
  @Column({ nullable: true }) varianteGruppeId: string;
  /** Anzeigename der Variante im Set, z.B. "Vollfolierung 3M". */
  @Column({ nullable: true }) varianteLabel: string;
  /** Die vom Kunden gewaehlte Variante der Gruppe. */
  @Column({ default: false }) istGewaehlt: boolean;
  /** Gueltigkeit des Angebots (Default beim Erstellen: +14 Tage). Nur fuer Angebote. */
  @Column({ type: timestampColumnType(), nullable: true }) gueltigBis: Date;
  /** Angebots-Lebenszyklus (separat vom Rechnungs-Status). NULL bei Rechnungen. */
  @Column({ type: enumColumnType(), enum: AngebotStatus, nullable: true })
  angebotStatus: AngebotStatus;
  /**
   * Geheimes Token fuer die oeffentliche Kunden-Freigabe der Angebots-Gruppe.
   * Plaintext, select:false, ueber ALLE Mitglieder EINER Gruppe identisch (daher
   * NICHT unique). Zugriff nur ueber GET/POST /public/angebote/:token; die Gruppe
   * wird dort strikt ueber tenantId+varianteGruppeId geladen (kein Fremd-Tenant-Leak).
   */
  @Index()
  @Column({ nullable: true, select: false }) angebotToken: string;

  // --- Welle 1: Anzahlung/Abschlag (F3) ---
  /** true = diese Rechnung ist eine Anzahlungsrechnung. */
  @Column({ default: false }) istAnzahlung: boolean;
  /** Verweis der Anzahlung auf die (spaetere) Schlussrechnung. Self-Reference, nullable. */
  @Column({ nullable: true }) anzahlungFuerInvoiceId: string;

  // --- DSGVO/GoBD: Empfaenger-Snapshot (eingefroren bei Art.17-Anonymisierung) ---
  // Wird vor der Anonymisierung des Customers gefuellt, damit das PDF (§14 UStG)
  // den korrekten Rechnungsadressaten behaelt, obwohl der Live-Customer anonym ist.
  // Empfaenger-Snapshot = personenbezogene Daten -> verschluesselt.
  /** Name des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerName: string | null;
  /** Anschrift (mehrzeilig) des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerAnschrift: string | null;
  /** USt-IdNr. des Rechnungsadressaten zum Anonymisierungszeitpunkt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  empfaengerVatNumber: string | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
