import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { timestampColumnType } from '../../common/database.types';
import {
  encryptedStringTransformer,
  encryptedJsonTransformer,
} from '../../common/crypto/encrypted-column';

/**
 * Bewerbungs-/Freigabe-Status eines Haendlers (Welle 3: Grosshaendler-Portal).
 * KEINE Selbst-Freischaltung: oeffentliche Bewerbungen landen als 'beantragt'
 * und werden ausschliesslich vom Betreiber freigegeben oder abgelehnt. Default
 * 'freigegeben' haelt BESTANDS-Haendler (Seed-/Platform-Anlage vor Welle 3)
 * rueckwaertskompatibel im Katalog sichtbar.
 */
export type MarketplaceDealerStatus = 'beantragt' | 'freigegeben' | 'abgelehnt';

/** Ampel der KYB-Vorpruefung (Welle 5). rot=Handlungsbedarf, gelb=pruefen, gruen=plausibel. */
export type KybAmpel = 'gruen' | 'gelb' | 'rot';

/**
 * Ergebnis der assistierten KYB-Vorpruefung der Gewerbeanmeldung. Wird
 * FELD-VERSCHLUESSELT (encryptedJsonTransformer) abgelegt: enthaelt aus dem
 * Dokument extrahierte Firmen-/Adressdaten (personenbezogen bei Einzelunternehmen).
 * Die Freigabe bleibt IMMER menschlich - diese Ampel ist nur eine Entscheidungshilfe.
 */
export interface KybErgebnis {
  ampel: KybAmpel;
  felder: {
    firmenname?: string;
    anschrift?: string;
    taetigkeit?: string;
    anmeldedatum?: string;
    behoerde?: string;
  };
  abweichungen: string[];
  geprueftAm: string;
}

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

  /**
   * USt-IdNr (Pflicht bei Bewerbung; B2B-Seriositaets-Check des Betreibers).
   * FELD-VERSCHLUESSELT (Welle 5): steuerliche Kennung -> nie durchsucht, daher
   * transformer-verschluesselt. Markerloser Altbestand (vor Welle 5) wird beim
   * Lesen unveraendert durchgereicht und erst beim naechsten Save verschluesselt.
   */
  @Column({ type: 'text', nullable: true, transformer: encryptedStringTransformer })
  ustIdNr: string;

  /** Sortiment als CSV der Marktplatz-Bereiche (z. B. "folierung,ppf"). */
  @Column({ nullable: true }) sortiment: string;

  /** Bewerbungs-Nachricht; wird bei Ablehnung genullt (PII-Sparsamkeit). */
  @Column({ type: 'text', nullable: true }) nachricht: string;

  /** Eingangszeitpunkt der Bewerbung (null bei direkt angelegten Haendlern). */
  @Column({ type: timestampColumnType(), nullable: true }) beantragtAm: Date | null;

  // --- KYB / Gewerbeanmeldung (Welle 5) ---------------------------------------

  /**
   * Logischer Pfad der verschluesselten Gewerbeanmeldung unter private-uploads/kyb/.
   * BEWUSST kein oeffentlich-statischer Mount: die Datei ist nur ueber die
   * guard-geschuetzte Download-Route (Plattform-Rollen) abrufbar. Bei Ablehnung
   * + Ablauf der Retention-Frist wird die Datei geloescht und dieses Feld genullt.
   */
  @Column({ nullable: true }) gewerbeanmeldungDatei: string | null;

  /**
   * sha256 der KLARTEXT-Dokumentbytes (hex). UNVERSCHLUESSELT, weil per WHERE
   * durchsucht (Dubletten-Erkennung: gleiches Dokument, andere Firma -> Ampel rot).
   * Ein Hash ist keine PII und nicht auf den Inhalt zurueckrechenbar.
   */
  @Column({ nullable: true }) dokumentHash: string | null;

  /** Ergebnis der automatischen Vorpruefung (feld-verschluesselt, s. KybErgebnis). */
  @Column({ type: 'text', nullable: true, transformer: encryptedJsonTransformer<KybErgebnis>() })
  kybErgebnis: KybErgebnis | null;

  /** User-Id des Plattform-Mitarbeiters, der die Bewerbung final beschieden hat. */
  @Column({ nullable: true }) kybGeprueftVonUserId: string | null;

  /**
   * Zeitpunkt der Ablehnung. Saubere Uhr fuer die 90-Tage-Dokument-Retention -
   * bewusst NICHT updatedAt (das jeder spaetere Touch verfaelschen wuerde).
   */
  @Column({ type: timestampColumnType(), nullable: true }) abgelehntAm: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
