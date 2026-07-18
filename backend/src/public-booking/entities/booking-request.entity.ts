import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, timestampColumnType } from '../../common/database.types';

export enum BookingRequestStatus {
  NEU = 'neu',
  ANGENOMMEN = 'angenommen',
  ABGELEHNT = 'abgelehnt',
}

/**
 * Oeffentlich (ohne Login) erzeugte Online-Terminanfrage eines Endkunden.
 *
 * BEWUSST eine eigene Tabelle statt direkt Appointment/Customer: Fremd-Eingaben
 * sind untrusted/unbestaetigt und werden hier isoliert gehalten (Datensparsamkeit,
 * eigene kurze Aufbewahrung, klarer Vertrauens-Uebergang beim "Annehmen"). Erst
 * beim Annehmen entsteht ein echtes Appointment (+ optional Customer).
 *
 * tenantId wird IMMER serverseitig aus dem Slug gesetzt – nie aus dem Request-Body.
 */
@Entity('booking_requests')
export class BookingRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  // --- Kontakt (untrusted Fremd-Eingabe) ---
  @Column() name: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true }) phone: string;

  // --- Anliegen ---
  /** Optional gewaehlte Leistung – serverseitig gegen den Betrieb validiert. */
  @Column({ nullable: true }) serviceItemId: string;
  /** Denormalisierter Name der Leistung (Snapshot, falls Leistung spaeter entfernt wird). */
  @Column({ nullable: true }) serviceName: string;
  @Column({ type: 'text', nullable: true }) fahrzeug: string;
  @Column({ type: timestampColumnType(), nullable: true }) wunschtermin: Date;
  @Column({ type: 'text', nullable: true }) nachricht: string;

  @Column({
    type: enumColumnType(),
    enum: BookingRequestStatus,
    default: BookingRequestStatus.NEU,
  })
  status: BookingRequestStatus;

  // --- Verbraucherrechtlicher Abschluss-Nachweis (§312j/§312f/§356 BGB) --------
  // Bewusst TEXT-Spalten (DB-portabel, additiv). Zeitstempel werden als ISO-8601-
  // String gespeichert (kein DB-Zeittyp noetig) und dienen ausschliesslich dem
  // Nachweis, WANN welche Pflicht-Zustimmung im Flow erteilt wurde.

  /**
   * Snapshot des Abschluss-Modus zum Zeitpunkt der Absendung ('anfrage' |
   * 'verbindlich'). Haelt den Nachweis stabil, auch wenn der Betrieb den Modus
   * spaeter umstellt.
   */
  @Column({ type: 'text', nullable: true }) abschlussModus: string;

  /**
   * ISO-Zeitpunkt der Kenntnisnahme der Pflichtinformationen + Widerrufsbelehrung
   * (nur Modus `verbindlich`; im Modus `anfrage` immer null – kein Vertrag).
   */
  @Column({ type: 'text', nullable: true }) pflichtinfoBestaetigtAm: string;

  /**
   * ISO-Zeitpunkt der ausdruecklichen Zustimmung zum vorzeitigen Leistungsbeginn
   * (§356 Abs. 4 BGB) – nur bei `verbindlich` UND Termin innerhalb der 14-taegigen
   * Widerrufsfrist. Sonst null.
   */
  @Column({ type: 'text', nullable: true }) vorzeitigerLeistungsbeginnAm: string;

  /**
   * ISO-Zeitpunkt der Datenschutz-Kenntnisnahme (optional, KEINE erzwungene
   * Einwilligung – Kopplungsverbot). null, wenn der Client sie nicht bestaetigt hat.
   */
  @Column({ type: 'text', nullable: true }) datenschutzHinweisAm: string;

  /**
   * Nicht-erratbare oeffentliche Referenz, die dem Kunden als Bestaetigung gezeigt
   * wird (kein fortlaufender Zaehler -> kein Rueckschluss auf das Anfrage-Volumen).
   */
  @Index()
  @Column() reference: string;

  /** Datensparsamkeit: Quell-IP NUR gehasht (Spam-Forensik), nie im Klartext. */
  @Column({ nullable: true }) sourceIpHash: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
