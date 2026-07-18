import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType, timestampColumnType } from '../../common/database.types';
import type {
  IncidentQuelle,
  IncidentSchweregrad,
  IncidentSignalTyp,
  IncidentStatus,
} from '../incident.constants';

/**
 * Datenpannen-/Incident-Register (Art. 33/34 DSGVO).
 *
 * Mandantentrennung: `tenantId` ist der betroffene Betrieb (Verantwortlicher).
 * NULL = plattformweiter Vorfall (mehrere Betriebe / Detailly-Ebene) – NUR fuer
 * PLATFORM_ADMIN sichtbar. Der OWNER sieht ausschliesslich Vorfaelle des eigenen
 * `tenantId` (Service erzwingt das strikt).
 *
 * Status/Schweregrad/Quelle/Signaltyp sind TEXT-Spalten mit `@IsIn`-Validierung
 * in den DTOs (kein Postgres-`enum` – s. incident.constants.ts). Die 72h-Deadline
 * wird NICHT gespeichert, sondern aus `kenntnisAm` abgeleitet (meldefristDeadline).
 */
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'status'])
@Entity('data_incidents')
export class DataIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Betroffener Betrieb; NULL = plattformweit (nur PLATFORM_ADMIN). */
  @Column({ nullable: true })
  tenantId: string | null;

  @Column({ default: 'manuell' })
  quelle: IncidentQuelle;

  /** Nur bei quelle==='auto_signal' gesetzt (dient zugleich der De-Duplizierung). */
  @Column({ nullable: true })
  signalTyp: IncidentSignalTyp | null;

  @Column({ default: 'erkannt' })
  status: IncidentStatus;

  @Column({ default: 'mittel' })
  schweregrad: IncidentSchweregrad;

  /** Kenntniszeitpunkt = Start der 72h-Frist (Art. 33 Abs. 1). */
  @Column({ type: timestampColumnType() })
  kenntnisAm: Date;

  /** Betroffene Datenkategorien, z. B. ['kontaktdaten','fahrzeugdaten','rechnungsdaten']. */
  @Column({ type: jsonColumnType(), nullable: true })
  betroffeneDatenkategorien: string[] | null;

  @Column({ type: 'int', nullable: true })
  betroffenePersonenAnzahl: number | null;

  @Column({ type: 'int', nullable: true })
  betroffeneDatensaetzeAnzahl: number | null;

  @Column({ type: 'text', nullable: true })
  beschreibung: string | null;

  /** Voraussichtliche Folgen der Verletzung (Art. 33 Abs. 3 lit. c). */
  @Column({ type: 'text', nullable: true })
  wahrscheinlicheFolgen: string | null;

  /** Ergriffene/vorgeschlagene Massnahmen (Art. 33 Abs. 3 lit. d). */
  @Column({ type: 'text', nullable: true })
  getroffeneMassnahmen: string | null;

  /** Begruendung meldepflichtig/nicht (Risiko-Abwaegung Art. 33 Abs. 1). */
  @Column({ type: 'text', nullable: true })
  risikoBewertung: string | null;

  /** Generierte Melde-VORLAGE (Text) – wird NIE automatisch versendet. */
  @Column({ type: 'text', nullable: true })
  meldungEntwurf: string | null;

  // --- Eskalationskette (Zeitstempel; Versand erfolgt IMMER durch einen Menschen) ---

  /** Art. 33 Abs. 2: Auftragsverarbeiter (Detailly) hat den Verantwortlichen informiert. */
  @Column({ type: timestampColumnType(), nullable: true })
  verantwortlicherInformiertAm: Date | null;

  /** Meldung an die Aufsichtsbehoerde erfolgt (Art. 33 Abs. 1). */
  @Column({ type: timestampColumnType(), nullable: true })
  aufsichtsbehoerdeGemeldetAm: Date | null;

  /** Benachrichtigung der betroffenen Personen erfolgt (Art. 34). */
  @Column({ type: timestampColumnType(), nullable: true })
  betroffeneInformiertAm: Date | null;

  /** Zustaendiger Bearbeiter (User-ID). */
  @Column({ nullable: true })
  bearbeiterUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
