import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { enumColumnType, jsonColumnType, timestampColumnType } from '../../common/database.types';
import {
  encryptedStringTransformer,
  encryptedJsonTransformer,
} from '../../common/crypto/encrypted-column';

export enum UserRole {
  // --- Plattform-Ebene (Detailly als Betreiber der Software) ---
  PLATFORM_ADMIN = 'platform_admin', // volle Plattform-Kontrolle
  PLATFORM_ANALYST = 'platform_analyst', // nur Plattform-Auswertungen (read-only)
  PLATFORM_SUPPORT = 'platform_support', // Einblick/Support, kein Billing/keine Rollen
  // --- Betriebs-Ebene (Kunde = Werkstatt, die die Software nutzt) ---
  OWNER = 'owner', // Inhaber/Admin des Betriebs
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  RECEPTIONIST = 'receptionist',
  // --- Marktplatz-Ebene (externer Grosshaendler mit eigenem Login) ---
  // Bewusst WEDER Plattform- NOCH Betriebs-Rolle: ein Haendler hat tenantId=NULL
  // und einen dealerId. Er darf ausschliesslich sein eigenes Haendler-Portal
  // sehen und kommt ueber die Rollen-Schranke an KEINEN Tenant-/Plattform-Endpunkt.
  HAENDLER = 'haendler',
}

/** Plattform-Rollen (Detailly) – betriebsuebergreifend, kein Mandant. */
export const PLATTFORM_ROLLEN = [
  UserRole.PLATFORM_ADMIN,
  UserRole.PLATFORM_ANALYST,
  UserRole.PLATFORM_SUPPORT,
];

/**
 * Betriebs-Rollen (Kunde). NUR diese darf ein Kunde ueber die Mitarbeiter-
 * Verwaltung vergeben – Plattform-Rollen sind hier bewusst NICHT enthalten
 * (zweite Sicherung an der Validierungsgrenze zusaetzlich zum Service-Guard).
 */
export const TENANT_ROLLEN = [
  UserRole.OWNER,
  UserRole.MANAGER,
  UserRole.TECHNICIAN,
  UserRole.RECEPTIONIST,
];

/**
 * Marktplatz-Haendler-Rolle. BEWUSST getrennt von TENANT_ROLLEN und
 * PLATTFORM_ROLLEN gehalten: ein Haendler ist kein Betriebs- und kein
 * Plattform-Nutzer. Weil die Rolle in KEINER der beiden Mengen steht, kann ein
 * Kunde sie ueber die Mitarbeiter-Verwaltung (@IsIn(TENANT_ROLLEN)) nicht
 * vergeben und die operativen Controller (die Tenant-/Plattform-Rollen fordern)
 * lassen einen Haendler nicht durch.
 */
export const HAENDLER_ROLLEN = [UserRole.HAENDLER];

/**
 * Gewerk-Funktion eines Mitarbeiters (erleichtert Planung/Zuordnung). BEWUSST
 * KEIN DB-Enum, sondern eine Union/Konstante im Code + varchar-Spalte: neue
 * Werte erfordern so keine Enum-Schema-Migration und keinen Dev-Reseed
 * (Reseed-Falle bei Enum-Wert-Aenderungen). Validierung uebernimmt das DTO.
 */
export const EMPLOYEE_FUNKTIONEN = [
  'aufbereiter',
  'folierer',
  'ppf_spezialist',
  'allrounder',
  'buero',
] as const;
export type EmployeeFunktion = (typeof EMPLOYEE_FUNKTIONEN)[number];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: enumColumnType(), enum: UserRole, default: UserRole.TECHNICIAN })
  role: UserRole;

  @Column({ nullable: true })
  tenantId: string;

  /**
   * Marktplatz-Haendler-Bindung (nur fuer role=HAENDLER gesetzt, sonst NULL).
   * Verweist auf marketplace_dealers.id; ein Haendler-Login sieht ausschliesslich
   * die Daten DIESES dealers. tenantId ist bei Haendlern immer NULL – die beiden
   * Felder schliessen sich fachlich aus. Bewusst als varchar (wie tenantId, statt
   * uuid-Typ), damit SQLite-Dev und Postgres-Prod dieselbe Spalte tragen.
   * Relation "viele Users -> ein Dealer" (zukunftsfest: mehrere Ansprechpartner).
   */
  @Index()
  @Column({ nullable: true })
  dealerId: string;

  @Column({ default: true })
  isActive: boolean;

  /**
   * Interner Stundenlohn (€) fuer die Lohnkosten-Auswertung pro Auftrag.
   * GEHALTSDATEN: wird ausschliesslich ueber den Leitung-only /employees-Endpunkt
   * gelesen/gesetzt und fuer die Lohnkosten nur der Leitung berechnet. /auth/me
   * liefert nur den kuratierten JWT-User (kein Leak).
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stundenlohn: number;

  /**
   * Geburtstag (nur Datum, ohne Zeit). Wird als jaehrlich wiederkehrende
   * Erinnerung im Kalender genutzt – die Marker rendert das Frontend
   * clientseitig aus der Mitarbeiterliste (kein eigener Termin-Datensatz).
   */
  @Column({ type: 'date', nullable: true })
  geburtstag: string;

  /**
   * Gewerk-Funktion (siehe EMPLOYEE_FUNKTIONEN). varchar statt DB-Enum, damit
   * neue Werte keine Enum-Migration/keinen Reseed erzwingen.
   */
  @Column({ nullable: true })
  funktion: string;

  @Column({ nullable: true, type: timestampColumnType() })
  lastLoginAt: Date;

  /**
   * Zeitpunkt der letzten Passwort-Aenderung (z. B. via Reset). JWTs, die VOR
   * diesem Zeitpunkt ausgestellt wurden, werden in der JwtStrategy abgelehnt –
   * so entwertet ein Passwort-Reset bestehende Sessions (OWASP).
   */
  @Column({ nullable: true, type: timestampColumnType() })
  passwordChangedAt: Date;

  /**
   * Monotoner Session-Revocation-Zaehler (JWT-Revocation). Das Voll-JWT traegt
   * den Wert als Claim `tv`; die JwtStrategy lehnt Tokens mit abweichendem tv ab.
   * Ein Increment entwertet damit SOFORT alle frueher ausgestellten Voll-JWTs.
   * Erhoeht bei: Passwort-Reset, 2FA-Aktivieren/-Deaktivieren (und kuenftig
   * "ueberall abmelden"). Alt-Tokens ohne tv-Claim gelten als tv=0 -> bleiben
   * gueltig, solange tokenVersion 0 ist (kein Mass-Logout beim Deploy).
   */
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  /** Zeitpunkt der E-Mail-Bestaetigung (Double-Opt-in). null = noch unbestaetigt. */
  @Column({ nullable: true, type: timestampColumnType() })
  emailVerifiedAt: Date;

  /** SHA-256-Hash des aktuellen E-Mail-Bestaetigungs-Tokens (nie Klartext). */
  @Column({ nullable: true, select: false })
  emailVerificationTokenHash: string;

  @Column({ nullable: true, type: timestampColumnType() })
  emailVerificationExpiresAt: Date;

  // ---------------------------------------------------------------------------
  // Zwei-Faktor-Authentifizierung (TOTP)
  // ---------------------------------------------------------------------------

  /**
   * TOTP-Secret (Base32). Verschluesselt at-rest (wie tenant.sevdeskApiToken) und
   * select:false -> wird nur bei Enrollment/Aktivieren/Verify/Deaktivieren geladen
   * und verlaesst das Backend nie im Klartext. Ein gesetztes Secret bei
   * totpEnabled=false bedeutet: Enrollment gestartet, aber noch nicht bestaetigt.
   */
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedStringTransformer })
  totpSecret: string | null;

  /** true = 2FA aktiv; Login verlangt dann einen TOTP-/Recovery-Code (2. Stufe). */
  @Column({ default: false })
  totpEnabled: boolean;

  /**
   * Einmal-Wiederherstellungscodes als SHA-256-Hex-Array (nie Klartext),
   * verschluesselt + select:false. Ein benutzter Code wird aus dem Array entfernt
   * (single-use). null/leer = keine Codes hinterlegt.
   */
  @Column({ type: 'text', nullable: true, select: false, transformer: encryptedJsonTransformer<string[]>() })
  recoveryCodes: string[] | null;

  /**
   * Benachrichtigungs-Praeferenzen je Nutzer (Welle 3-A): welche In-App-Hinweise
   * (Glocke) angezeigt werden. Kleines, NICHT sensibles JSON (reine UI-Steuerung)
   * -> unverschluesselt (wie die uebrigen settings-JSONs). Fehlt der Block, gilt jede
   * Kategorie als AN (resolveBenachrichtigungen) -> kein Verhaltensbruch.
   */
  @Column({ type: jsonColumnType(), nullable: true })
  benachrichtigungen: object;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
