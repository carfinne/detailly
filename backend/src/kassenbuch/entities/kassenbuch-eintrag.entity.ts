import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';

/**
 * Ein einzelner Eintrag im GoBD-Kassenbuch (Bargeld-Ein-/Auszahlungen).
 *
 * GoBD-Kernprinzipien, die diese Tabelle traegt:
 *  - Unveraenderbarkeit: ein FESTGESCHRIEBENER Eintrag darf nicht mehr geaendert
 *    oder geloescht werden (Service wirft ConflictException). Korrektur nur per
 *    Gegenbuchung (Storno-Eintrag mit `stornoVonId` auf das Original).
 *  - Lueckenlose, fortlaufende `laufendeNummer` je Tenant (Unique-Index +
 *    withUniqueRetry beim Anlegen, analog Rechnungsnummern).
 *  - Verkettung: `kassenbestandNach` ist der laufende Saldo NACH diesem Eintrag,
 *    serverseitig aus dem Vorgaenger-Saldo berechnet (nie vom Client). Die
 *    Barkasse kann physisch nicht negativ werden -> bei Ausgabe > Bestand 400.
 *
 * Wertespalte `typ` ist BEWUSST varchar + Code-Konstante (kassenbuch.constants),
 * KEIN DB-Enum – kein Reseed bei neuen Werten. FK-frei (tenantId/userId als
 * varchar wie im uebrigen Schema), damit SQLite-Dev und Postgres-Prod dieselbe
 * Tabelle tragen.
 */
// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY laufendeNummer.
@Index(['tenantId', 'laufendeNummer'], { unique: true })
// Zeitraum-Filter (WHERE tenantId AND datum BETWEEN ...).
@Index(['tenantId', 'datum'])
@Entity('kassenbuch_eintraege')
export class KassenbuchEintrag {
  @PrimaryGeneratedColumn('uuid') id: string;

  /** Betrieb (Mandantentrennung). Jede Query/Mutation ist hierauf gescoped. */
  @Index() @Column() tenantId: string;

  /**
   * Fortlaufende, lueckenlose Nummer je Tenant (1, 2, 3, ...). Beim Anlegen als
   * MAX(laufendeNummer)+1 gezogen und ueber den Unique-Index (tenantId,
   * laufendeNummer) + withUniqueRetry gegen Parallel-Kollisionen gesichert.
   */
  @Column({ type: 'int' }) laufendeNummer: number;

  /** Buchungsdatum. Chronologisch >= Datum des Vorgaengers (kein Rueckdatieren). */
  @Column({ type: timestampColumnType() }) datum: Date;

  /** 'einnahme' | 'ausgabe' (siehe KASSENBUCH_TYPEN). Validierung im DTO. */
  @Column() typ: string;

  /** Betrag der Bewegung (immer > 0; die Richtung steckt in `typ`). */
  @Column({ type: 'decimal', precision: 10, scale: 2 }) betrag: number;

  /** Angewandter MwSt-Satz in Prozent (0/7/19). Nur informativ – kein Steuerabschluss. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) mwstSatz: number;

  /** Zweck/Betreff der Buchung (Pflicht – GoBD verlangt einen Buchungstext). */
  @Column() zweck: string;

  /** Externe Belegnummer (Quittung/Bon), optional. */
  @Column({ nullable: true }) belegNummer: string | null;

  /** Freie Kategorie (z. B. Materialeinkauf, Trinkgeld), optional. */
  @Column({ nullable: true }) kategorie: string | null;

  /**
   * Laufender Kassenbestand NACH diesem Eintrag. Serverseitig aus dem
   * Vorgaenger-Saldo berechnet (Vorgaenger.kassenbestandNach +/- betrag). Nie
   * negativ (Ausgabe > Bestand wird abgewiesen).
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 }) kassenbestandNach: number;

  /** Erfassender Nutzer (aus dem JWT, nie aus dem Body). */
  @Column() erfasstVonUserId: string;

  /** true = festgeschrieben (unveraenderlich). Korrektur nur per Storno. */
  @Column({ default: false }) festgeschrieben: boolean;

  /** Zeitpunkt der Festschreibung (gesetzt beim ersten Festschreiben). */
  @Column({ type: timestampColumnType(), nullable: true }) festgeschriebenAm: Date | null;

  /**
   * Bei einem Storno-Eintrag (Gegenbuchung): Verweis auf den ORIGINAL-Eintrag,
   * der storniert wird. NULL bei normalen Buchungen. Das Original bleibt
   * unveraendert (GoBD) – die Korrektur ist ausschliesslich dieser Gegeneintrag.
   */
  @Index() @Column({ nullable: true }) stornoVonId: string | null;

  @CreateDateColumn() createdAt: Date;
}
