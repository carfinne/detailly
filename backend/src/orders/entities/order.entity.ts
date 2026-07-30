import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';
import { encryptedStringTransformer } from '../../common/crypto/encrypted-column';
import { OrderItem } from './order-item.entity';

export enum ServiceType {
  AUFBEREITUNG = 'aufbereitung',
  FOLIERUNG = 'folierung',
  PPF = 'ppf',
  SONSTIGES = 'sonstiges',
}

export enum OrderStatus {
  ANGEFRAGT = 'angefragt',
  KALKULIERT = 'kalkuliert',
  BESTAETIGT = 'bestaetigt',
  IN_ARBEIT = 'in_arbeit',
  QUALITAETSKONTROLLE = 'qualitaetskontrolle',
  FERTIG = 'fertig',
  ABGERECHNET = 'abgerechnet',
  STORNIERT = 'storniert',
}

/**
 * Branchenspezifische Leistungsdetails je nach serviceType.
 * Es sind jeweils nur die zum serviceType passenden Teilobjekte relevant.
 */
export interface LeistungDetails {
  ppf?: {
    folie?: string;
    hersteller?: string;
    qm?: number;
    garantieJahre?: number;
  };
  keramik?: {
    produkt?: string;
    schichten?: number;
    garantieJahre?: number;
  };
  folierung?: {
    farbe?: string;
    hersteller?: string;
    qm?: number;
    teilfolierung?: boolean;
    // Welle 1 (F4): Garantie-/Uebergabedaten fuer das Uebergabe-PDF.
    garantieJahre?: number;
    pflegehinweis?: string;
  };
}

// Composite-Index fuer das Listen-Muster WHERE tenantId ... ORDER BY createdAt.
@Index(['tenantId', 'createdAt'])
// GoBD-Backstop (C1): eindeutige Auftragsnummer je Betrieb (auftragsnummer ist
// immer gesetzt). Die Vergabe ist zusaetzlich per withUniqueRetry serialisiert
// (orders.service + booking-requests.service).
@Index(['tenantId', 'auftragsnummer'], { unique: true })
// Welle 1 (F2): DB-agnostischer Backstop gegen doppelte Auftrags-Erzeugung aus
// EINEM Angebot (Race/Doppelklick). angebotInvoiceId ist meist NULL -> mehrere
// NULLs bleiben (SQLite wie Postgres) "distinct", nur gesetzte Werte sind eindeutig.
@Index(['tenantId', 'angebotInvoiceId'], { unique: true })
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index()
  @Column() tenantId: string;

  /** Fortlaufende Auftragsnummer je Tenant, z.B. "AU-2026-0001". */
  @Column() auftragsnummer: string;

  @Column() customerId: string;
  @Column({ nullable: true }) vehicleId: string;
  @Column({ nullable: true }) locationId: string;
  @Column({ nullable: true }) assignedUserId: string;

  /**
   * Welle 1 (F2): Rueckverweis auf das angenommene Angebot (Invoice), aus dem
   * dieser Auftrag erzeugt wurde. Dient zugleich als Idempotenz-Anker: existiert
   * bereits ein Auftrag mit diesem Verweis, liefert acceptAngebot ihn zurueck.
   * Eindeutigkeit erzwingt der Composite-Unique-Index (tenantId, angebotInvoiceId).
   */
  @Column({ nullable: true }) angebotInvoiceId: string;

  /**
   * Welle 1-A (F3): Zeitpunkt, zu dem dieser Auftrag aus einer ONLINE-Angebots-
   * annahme (oeffentlicher Token, ohne eingeloggten Betrieb) entstand. Wird NUR im
   * Token-Pfad gesetzt (Betrieb nimmt selbst an -> bleibt null), damit die Glocke
   * ausschliesslich den "unsichtbaren" Kunden-Moment meldet. Der Zaehler
   * (RemindersService) zaehlt Auftraege mit gesetztem Zeitpunkt UND Status
   * "bestaetigt"; sobald der Betrieb den Auftrag weiterschiebt, faellt er still
   * heraus (symmetrisch zur Buchungsanfrage NEU -> bearbeitet). Nullable, additiv.
   */
  @Column({ nullable: true, type: timestampColumnType() }) angebotOnlineAngenommenAm: Date;

  /**
   * Geheimes Token fuer den oeffentlichen Tracking-Link ("Wo ist mein Auto?").
   * Plaintext, aber per Default NICHT mitselektiert (select:false), damit es nie
   * versehentlich in normalen Auftrags-Antworten landet. Regenerierbar -> alter
   * Link wird ungueltig. Zugriff ausschliesslich ueber GET /public/orders/:token.
   * Unique-Index: erzwingt Eindeutigkeit DB-seitig (mehrere NULLs erlaubt), damit
   * eine – astronomisch unwahrscheinliche – Token-Kollision fail-closed scheitert
   * statt einen mehrdeutigen Treffer zu liefern.
   */
  @Index({ unique: true })
  @Column({ nullable: true, select: false }) freigabeToken: string;

  @Column({ type: enumColumnType(), enum: ServiceType, default: ServiceType.AUFBEREITUNG })
  serviceType: ServiceType;

  @Column({ type: enumColumnType(), enum: OrderStatus, default: OrderStatus.ANGEFRAGT })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) materialkosten: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) arbeitsstunden: number;

  @Column({ nullable: true, type: timestampColumnType() }) geplanterStart: Date;
  @Column({ nullable: true, type: timestampColumnType() }) geplantesEnde: Date;

  // --- Welle 2-B (Teil 2): Nachsorge-Wiedervorlage (Keramik/PPF/Coating) ---
  // Opt-in JE AUFTRAG (nicht automatisch fuer alles): der Betrieb setzt am
  // abgeschlossenen Auftrag "Wiedervorlage in N Monaten". Alle drei additiv/nullable,
  // damit synchronize=true (Dev) sie konfliktfrei anlegt.
  /**
   * Faelligkeit der Nachsorge-Wiedervorlage. NULL = keine Nachsorge gesetzt
   * (Opt-in). Erreicht dieser Zeitpunkt, erzeugt der Scheduler GENAU EINE
   * In-App-Erinnerung (kein Auto-Mail an den Kunden).
   */
  @Column({ nullable: true, type: timestampColumnType() }) nachsorgeAm: Date;
  /**
   * Idempotenz-Anker (Muster Termin-Erinnerung): setzt der Scheduler EINMAL
   * KONDITIONAL (WHERE ... IS NULL), sobald die Nachsorge faellig ist. Genau ein
   * Gewinner -> genau eine Erinnerung. Solange gesetzt UND nachsorgeErledigtAm
   * NULL, erscheint der Auftrag in Glocke + Nachsorge-Liste.
   */
  @Column({ nullable: true, type: timestampColumnType() }) nachsorgeErinnertAm: Date;
  /**
   * Der Betrieb hat die Wiedervorlage abgehakt/erledigt (Termin angestossen oder
   * bewusst verworfen). Entfernt den Auftrag aus Glocke + Liste. NULL = offen.
   */
  @Column({ nullable: true, type: timestampColumnType() }) nachsorgeErledigtAm: Date;
  /**
   * Geplante Gesamtdauer des Auftrags in Minuten (Soll fuer die Nachkalkulation).
   * OVERRIDE: ist der Wert gesetzt, gewinnt er; ist er null, wird das Soll aus der
   * Summe der Positions-Dauern (order_items.geplanteDauerMinuten) berechnet. Der
   * Meister kann die Positions-Summe also bewusst uebersteuern. Nullable, additiv.
   */
  @Column({ type: 'int', nullable: true }) geplanteDauerMinuten: number | null;

  @Column({ type: jsonColumnType(), nullable: true }) bilderVorher: string[];
  @Column({ type: jsonColumnType(), nullable: true }) bilderNachher: string[];

  /**
   * Gibt der Betrieb die (internen) Vorher-Fotos fuer die oeffentliche, login-freie
   * Kundenmappe frei? Default false: Vorher-Bilder (Innenraum/Vorschaeden) bleiben
   * privat; nur die Nachher-Fotos sind standardmaessig oeffentlich sichtbar.
   */
  @Column({ default: false }) mappeVorherFotosZeigen: boolean;

  /** Branchenspezifische Detailfelder (PPF/Keramik/Folierung). */
  @Column({ type: jsonColumnType(), nullable: true }) leistungDetails: LeistungDetails;

  // Verschluesselt (Freitext, kann personenbezogene Notizen enthalten).
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  internerHinweis: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) nettoSumme: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) mwstBetrag: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gesamtpreis: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  /**
   * Welle 1-A (F2): TRANSIENTES Anzeige-Flag (KEINE DB-Spalte, kein @Column).
   * findOneDetail() setzt es fuer die Detailseite: true = Positionen sind
   * GoBD-gesperrt (Status abgerechnet/storniert ODER eine festgeschriebene
   * Rechnung haengt am Auftrag). Steuert im UI die Read-only-Sperre; die harte
   * Durchsetzung liegt serverseitig in update(). TypeORM ignoriert nicht
   * dekorierte Felder beim Schema/Persistieren -> unkritisch fuer save().
   */
  abgerechnet?: boolean;
}
