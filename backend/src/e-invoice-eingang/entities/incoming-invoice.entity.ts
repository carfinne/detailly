import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';

/**
 * Auslese-Status einer eingegangenen E-Rechnung.
 * - GELESEN:     Kernfelder (Nr./Verkaeufer/Brutto) erfolgreich extrahiert.
 * - TEILWEISE:   Format erkannt, aber Pflicht-Kernfelder unvollstaendig.
 * - NICHT_LESBAR: kein verwertbares XML (kaputt/unbekannt/PDF ohne Anhang) –
 *                 das Original bleibt trotzdem archiviert + herunterladbar.
 */
export enum IncomingInvoiceStatus {
  GELESEN = 'gelesen',
  TEILWEISE = 'teilweise',
  NICHT_LESBAR = 'nicht_lesbar',
}

/** Erkanntes Quellformat (rein informativ fuer die Anzeige). */
export enum IncomingInvoiceFormat {
  UBL = 'ubl',
  CII = 'cii',
  /** Hybrides PDF/A-3 mit eingebettetem CII-XML. */
  CII_PDF = 'cii_pdf',
  UNBEKANNT = 'unbekannt',
}

/**
 * Eingegangene E-Rechnung (E-Rechnungs-Eingang, §14 UStG Empfangspflicht).
 *
 * Ein FREMDER Beleg (vom Lieferanten): KEIN eigener GoBD-Nummernkreis, keine
 * Positionen-Pflicht. Das hochgeladene Original (XML oder hybrides PDF) wird
 * verschluesselt at rest archiviert (GoBD: unveraenderbar, 8 Jahre) – die
 * strukturierten Felder werden nur ZUSAETZLICH ausgelesen (Anzeige, nie
 * automatische Verbuchung). Lieferanten-PII/Bankdaten sind feld-verschluesselt.
 *
 * Mandantentrennung: `tenantId` auf JEDER Zeile; alle Queries tenant-scoped.
 */
// Listen-/Paginier-Muster: WHERE tenantId ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
// Sortierung nach Belegdatum.
@Index(['tenantId', 'rechnungsdatum'])
// Dedup-Lookup (Service-seitiger 409, bewusst NICHT unique – echte
// Doppelrechnungen eines Lieferanten bleiben moeglich).
@Index(['tenantId', 'dokumentHash'])
@Entity('incoming_invoices')
export class IncomingInvoice {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  @Column({
    type: enumColumnType(),
    enum: IncomingInvoiceStatus,
    default: IncomingInvoiceStatus.NICHT_LESBAR,
  })
  status: IncomingInvoiceStatus;

  @Column({
    type: enumColumnType(),
    enum: IncomingInvoiceFormat,
    default: IncomingInvoiceFormat.UNBEKANNT,
  })
  format: IncomingInvoiceFormat;

  // --- Archiv (GoBD-Original, unveraenderbar) --------------------------------
  /** Logischer Pfad der verschluesselten Datei unter private-uploads/erechnung/. */
  @Column() archivDatei: string;
  /** sha256 ueber die KLARTEXT-Bytes (Dedup-Lookup je tenant). */
  @Column() dokumentHash: string;
  @Column() mimeType: string;
  @Column({ default: 0 }) dateiGroesse: number;
  /** Original-Dateiname – kann Kunden-/Belegdaten tragen -> verschluesselt. */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  originalDateiname: string | null;

  // --- Strukturierte Kopf-/Summen-Felder (plaintext: Liste/Sortierung/Summen) -
  @Column({ nullable: true }) rechnungsnummer: string | null;
  @Column({ type: timestampColumnType(), nullable: true }) rechnungsdatum: Date | null;
  @Column({ type: timestampColumnType(), nullable: true }) faelligkeitsdatum: Date | null;
  @Column({ type: timestampColumnType(), nullable: true }) leistungsdatum: Date | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) nettoBetrag: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) mwstBetrag: number | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) bruttoBetrag: number | null;
  @Column({ default: 'EUR' }) waehrung: string;
  /** Leitweg-ID / Kaeuferreferenz (Routing-ID, nicht sensibel). */
  @Column({ nullable: true }) leitwegId: string | null;

  // --- Verkaeufer/Bankdaten (PII/sensibel -> verschluesselt) -----------------
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  verkaeuferName: string | null;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  verkaeuferAnschrift: string | null;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  verkaeuferUstId: string | null;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  verkaeuferSteuernummer: string | null;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  iban: string | null;
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  bic: string | null;

  /** Menschenlesbarer Grund bei TEILWEISE/NICHT_LESBAR. */
  @Column({ type: 'text', nullable: true }) parseFehler: string | null;

  /** Wer die Datei hochgeladen hat (Nachvollziehbarkeit). */
  @Column({ nullable: true }) hochgeladenVonUserId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
