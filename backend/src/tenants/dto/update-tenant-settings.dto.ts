import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Betriebstyp } from '../entities/tenant.entity';
import { FRIST_MAX, FRIST_MIN, GEBUEHR_MAX, GEBUEHR_MIN } from '../../common/mahnwesen/mahnwesen-config';
import { PORT_MAX, PORT_MIN } from '../../common/mail/mail-config';
import { QM_PREIS_MAX } from '../../common/kalkulation/kalkulation-config';
import {
  PUFFER_MIN_MAX,
  PUFFER_MIN_MIN,
  SLOT_DAUER_MIN_MAX,
  SLOT_DAUER_MIN_MIN,
} from '../../common/kalender/kalender-config';
import {
  BUCHUNG_MODI,
  VORLAUF_MAX_TAGE_MAX,
  VORLAUF_MAX_TAGE_MIN,
  VORLAUF_MIN_STUNDEN_MAX,
  VORLAUF_MIN_STUNDEN_MIN,
  type BuchungModus,
} from '../../common/kalender/buchung-config';
import {
  END_STUNDE_MAX,
  END_STUNDE_MIN,
  START_STUNDE_MAX,
  START_STUNDE_MIN,
} from '../../common/darstellung/darstellung-config';
import { RECHTSFORMEN, STANDARD_MWST_SAETZE, type Rechtsform } from '../../common/steuer';
import {
  MITGLIED_KURZBESCHREIBUNG_MAX,
  MITGLIED_STADT_MAX,
  MITGLIED_WEBSEITE_MAX,
} from '../../common/mitglied-profil';
import {
  AUSLASTUNG_ZIEL_MAX,
  AUSLASTUNG_ZIEL_MIN,
  STEUER_TERMINE_MAX,
  STEUER_TERMIN_ART_MAX,
  STEUER_TERMIN_DATUM_MAX,
  STEUER_TERMIN_ID_MAX,
} from '../../common/ziele';
import {
  BEWERTUNG_TEXT_MAX,
  BEWERTUNG_URL_MAX,
  STUNDEN_VORLAUF_MAX,
  STUNDEN_VORLAUF_MIN,
} from '../../common/kundenkommunikation';
import {
  STATUS_MAIL_BETREFF_MAX,
  STATUS_MAIL_TEXT_MAX,
} from '../../common/status-mail-vorlagen';
import { AUFBEWAHRUNG_JAHRE_MAX, AUFBEWAHRUNG_JAHRE_MIN } from '../../common/datenschutz';
import { NACHFASS_TAGE_MAX, NACHFASS_TAGE_MIN } from '../../common/umsatz-erinnerungen';

/** 'HH:MM' im 24h-Format (00:00 .. 23:59). */
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Fristen des Mahnwesens (Tage nach Faelligkeit). Jedes Feld optional (Teil-Update);
 * die Reihenfolge-Regel (aufsteigend) prueft der Service auf dem zusammengefuehrten
 * Ergebnis, da sie felduebergreifend ist.
 */
class MahnwesenFristenDto {
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) erinnerung?: number;
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) mahnung1?: number;
  @IsOptional() @IsInt() @Min(FRIST_MIN) @Max(FRIST_MAX) mahnung2?: number;
}

/** Mahngebuehren (EUR) je Stufe. Nicht negativ, gedeckelt. */
class MahnwesenGebuehrDto {
  @IsOptional() @IsNumber() @Min(GEBUEHR_MIN) @Max(GEBUEHR_MAX) mahnung1?: number;
  @IsOptional() @IsNumber() @Min(GEBUEHR_MIN) @Max(GEBUEHR_MAX) mahnung2?: number;
}

/**
 * SMTP-Konfiguration fuer den betriebseigenen Mail-Versand (feat/night-email).
 * Alle Felder optional (Teil-Update). Die felduebergreifende Regel
 * (enabled -> Host/Port/From Pflicht) prueft der Service (assertMailConfigValid)
 * auf dem zusammengefuehrten Ergebnis. Das Passwort ist WRITE-ONLY: leerer String
 * loescht es, Weglassen laesst es unveraendert; es wird NIE zurueckgegeben.
 * Nicht-secret-Felder landen in tenant.settings.mailConfig, `pass` in der
 * verschluesselten select:false-Spalte tenant.smtpPassword.
 */
export class MailConfigDto {
  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional() @IsString() @MaxLength(255) host?: string;

  @IsOptional() @IsInt() @Min(PORT_MIN) @Max(PORT_MAX) port?: number;

  /** true = SMTPS (implizites TLS, meist Port 465); false = STARTTLS (587). */
  @IsOptional() @IsBoolean() secure?: boolean;

  @IsOptional() @IsString() @MaxLength(255) user?: string;

  /** SMTP-Passwort (write-only). Leerer String = loeschen, weglassen = unveraendert. */
  @IsOptional() @IsString() @MaxLength(255) pass?: string;

  /** Absender-Adresse (From). Leerer String erlaubt (= Feld leeren, Versand dann inaktiv). */
  @IsOptional()
  @ValidateIf((o: MailConfigDto) => o.fromEmail !== '')
  @IsEmail({}, { message: 'Bitte eine gueltige Absender-Adresse (From) angeben.' })
  @MaxLength(255)
  fromEmail?: string;

  /** Anzeigename des Absenders (z. B. Firmenname). */
  @IsOptional() @IsString() @MaxLength(120) fromName?: string;

  /**
   * Eigene Mail-Domain fuer die Zustellbarkeit (SPF/DKIM). Leerer String = Feld
   * loeschen (ValidateIf ueberspringt die Formatpruefung dann). Bei gesetzter Domain
   * muss die Absender-Adresse auf ihr liegen (Service: assertMailConfigValid).
   */
  @IsOptional()
  @ValidateIf((o: MailConfigDto) => o.domain !== '')
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'Bitte eine gueltige Domain angeben (z. B. dein-betrieb.de).',
  })
  @MaxLength(255)
  domain?: string;

  /**
   * Steuerflag (nicht gespeichert): erzwingt ein NEUES DKIM-Schluesselpaar. Nach
   * einer Rotation muss der neue oeffentliche Schluessel im DNS hinterlegt +
   * erneut verifiziert werden (bis dahin wird unsigniert gesendet).
   */
  @IsOptional() @IsBoolean() dkimRotate?: boolean;
}

/** Mahnwesen-Konfiguration je Betrieb (C1-C). Landet als Objekt in tenant.settings.mahnwesen. */
export class MahnwesenDto {
  @IsOptional() @IsBoolean() autoMahnen?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenFristenDto)
  fristen?: MahnwesenFristenDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenGebuehrDto)
  gebuehr?: MahnwesenGebuehrDto;
}

/**
 * EUR/qm-Richtwerte der 3D-Sofortkalkulation je Betrieb. Alle Felder optional
 * (Teil-Update); nicht negativ und gedeckelt (@Max spiegelt das QM_PREIS_MAX-
 * Clamp -> ein zu grosser Wert wird abgelehnt statt still gekappt). Landet als
 * Objekt in tenant.settings.kalkulation.
 */
export class KalkulationDto {
  @IsOptional() @IsNumber() @Min(0) @Max(QM_PREIS_MAX) folierungProQm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(QM_PREIS_MAX) ppfProQm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(QM_PREIS_MAX) aufbereitungProQm?: number;
}

/** Arbeitszeitfenster eines Wochentags (Teil-Update; leerer Wert = unveraendert). */
class ArbeitszeitDto {
  @IsOptional() @Matches(HHMM_REGEX, { message: 'Zeit bitte als HH:MM (24h) angeben.' }) von?: string;
  @IsOptional() @Matches(HHMM_REGEX, { message: 'Zeit bitte als HH:MM (24h) angeben.' }) bis?: string;
  @IsOptional() @IsBoolean() aktiv?: boolean;
}

/** Arbeitszeiten je Wochentag (mo..so), alle optional (Teil-Update). */
class ArbeitszeitenDto {
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) mo?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) di?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) mi?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) do?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) fr?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) sa?: ArbeitszeitDto;
  @IsOptional() @ValidateNested() @Type(() => ArbeitszeitDto) so?: ArbeitszeitDto;
}

/**
 * Kalender-/Plantafel-Einstellungen (Teil-Update). Landet als Objekt in
 * tenant.settings.kalender; Defaults spiegelt resolveKalender (Mo–Fr 08–18,
 * warnen, kein Standort-Konflikt, 30-min-Slots, 0-min-Puffer).
 */
export class KalenderDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ArbeitszeitenDto)
  arbeitszeiten?: ArbeitszeitenDto;

  @IsOptional() @IsIn(['warnen', 'blockieren']) konfliktverhalten?: 'warnen' | 'blockieren';

  @IsOptional() @IsBoolean() standortKonflikt?: boolean;

  @IsOptional() @IsInt() @Min(SLOT_DAUER_MIN_MIN) @Max(SLOT_DAUER_MIN_MAX) slotDauerMin?: number;

  @IsOptional() @IsInt() @Min(PUFFER_MIN_MIN) @Max(PUFFER_MIN_MAX) pufferMin?: number;

  /**
   * Wochen-Umsatzziel (EUR brutto) fuer den Kalender-Chef-Layer. null loescht das
   * Ziel; Zahlen werden im Service GEKLAMMERT auf 0..1 Mio (Spec: klammern statt
   * ablehnen, daher bewusst KEIN @Min/@Max-Reject wie bei slot/puffer).
   * @IsOptional laesst null durch (class-validator ueberspringt bei null/undefined).
   */
  @IsOptional() @IsNumber() umsatzZielWoche?: number | null;
}

/**
 * Buchungsportal-Einstellungen (Teil-Update, Kalender 2.0 W2). Landet als Objekt
 * in tenant.settings.buchung; Defaults spiegelt resolveBuchung (24 h Mindest-
 * Vorlauf, 60 Tage maximaler Vorlauf).
 */
export class BuchungDto {
  @IsOptional()
  @IsInt()
  @Min(VORLAUF_MIN_STUNDEN_MIN)
  @Max(VORLAUF_MIN_STUNDEN_MAX)
  vorlaufMinStunden?: number;

  @IsOptional()
  @IsInt()
  @Min(VORLAUF_MAX_TAGE_MIN)
  @Max(VORLAUF_MAX_TAGE_MAX)
  vorlaufMaxTage?: number;

  /**
   * Rechtlicher Abschluss-Modus der oeffentlichen Buchungsseite:
   * `anfrage` (unverbindliche Terminanfrage, Default) oder `verbindlich`
   * (entgeltlicher Fernabsatzvertrag mit §312j-Button-Loesung + Widerruf).
   */
  @IsOptional() @IsIn([...BUCHUNG_MODI]) modus?: BuchungModus;
}

/**
 * Steuer-Einstellungen (Welle 1: §19 UStG Kleinunternehmer + Rechtsform).
 * Teil-Update: nur uebergebene Felder werden angewandt (mergeSteuer). Landet als
 * Objekt in tenant.settings.steuer. `kleinunternehmer` erzwingt serverseitig
 * 0 % MwSt auf NEUEN Belegen; `standardMwstSatz` (19|0) ist die Vorwahl neuer
 * Belege bei Regelbesteuerung. Leerer Hinweis -> Default-Text (§ 19 UStG).
 */
export class SteuerDto {
  @IsOptional() @IsBoolean() kleinunternehmer?: boolean;

  @IsOptional() @IsIn([...STANDARD_MWST_SAETZE]) standardMwstSatz?: number;

  @IsOptional() @IsString() @MaxLength(300) kleinunternehmerHinweis?: string;

  @IsOptional() @IsIn([...RECHTSFORMEN]) rechtsform?: Rechtsform;

  @IsOptional() @IsString() @MaxLength(120) registergericht?: string;

  @IsOptional() @IsString() @MaxLength(40) registernummer?: string;

  @IsOptional() @IsString() @MaxLength(200) vertretungsberechtigte?: string;
}

/**
 * Optionaler Impressum-Zusatzblock (Tenant-Impressum-Generator). Nur SEKUNDAERE
 * Angaben, die selten gebraucht werden – die Pflichtangaben (Firma/Anschrift/
 * Kontakt/Rechtsform/Register/USt-IdNr.) stammen aus den bestehenden Feldern.
 * Teil-Update ueber die bestehende (aufgeloeste) Konfig (mergeImpressum); landet
 * als Objekt in tenant.settings.impressum.
 */
export class ImpressumDto {
  /** Berufshaftpflichtversicherung inkl. raeuml. Geltungsbereich (§ 2 DL-InfoV). */
  @IsOptional() @IsString() @MaxLength(300) berufshaftpflicht?: string;

  /** Zustaendige Aufsichtsbehoerde (nur bei erlaubnispflichtigen Taetigkeiten). */
  @IsOptional() @IsString() @MaxLength(200) aufsichtsbehoerde?: string;
}

/**
 * Oeffentliches Mitglieds-Profil (Opt-in fuer die Mitgliederliste auf detailly.de).
 * Teil-Update ueber die bestehende (aufgeloeste) Konfig (mergeMitgliedProfil);
 * landet als Objekt in tenant.settings.mitgliedProfil. Bewusst PII-ARM: NUR zur
 * Veroeffentlichung gedachte Felder – der Betrieb erscheint ausschliesslich mit
 * `zeigen === true` und jederzeit widerrufbar.
 */
export class MitgliedProfilDto {
  /** Opt-in: nur bei true erscheint der Betrieb oeffentlich (Default false). */
  @IsOptional() @IsBoolean() zeigen?: boolean;

  /** Ort/Stadt fuer die oeffentliche Karte. */
  @IsOptional() @IsString() @MaxLength(MITGLIED_STADT_MAX) stadt?: string;

  /** Kurze Selbstbeschreibung (max. 160 Zeichen). */
  @IsOptional() @IsString() @MaxLength(MITGLIED_KURZBESCHREIBUNG_MAX) kurzbeschreibung?: string;

  /**
   * Eigene Webseite. Leerer String erlaubt (= Feld leeren); sonst muss sie mit
   * http:// oder https:// beginnen (kein gefaehrliches Schema auf der oeffentlichen
   * Karte). ValidateIf ueberspringt die Pruefung beim Leeren (setOrDelete-Muster).
   */
  @IsOptional()
  @ValidateIf((o: MitgliedProfilDto) => o.webseite !== '')
  @Matches(/^https?:\/\/\S+$/, { message: 'Die Webseite muss mit http:// oder https:// beginnen.' })
  @MaxLength(MITGLIED_WEBSEITE_MAX)
  webseite?: string;
}

/**
 * Darstellungs-Einstellungen der Plantafel (Teil-Update). Landet als Objekt in
 * tenant.settings.darstellung; Defaults: Wochenstart Montag, 24h, 7–19 Uhr. Die
 * Invariante Endstunde > Startstunde erzwingt der Service defensiv (mergeDarstellung).
 */
export class DarstellungDto {
  @IsOptional() @IsIn(['montag', 'sonntag']) wochenstart?: 'montag' | 'sonntag';

  @IsOptional() @IsIn(['24h', '12h']) zeitformat?: '24h' | '12h';

  @IsOptional() @IsInt() @Min(START_STUNDE_MIN) @Max(START_STUNDE_MAX) kalenderStartStunde?: number;

  @IsOptional() @IsInt() @Min(END_STUNDE_MIN) @Max(END_STUNDE_MAX) kalenderEndStunde?: number;
}

/**
 * Ein einzelner Steuer-Termin (Ziele & Erinnerungen, Welle 1). `datum` ist entweder
 * `MM-TT` (wiederkehrend, z. B. jaehrlich) oder `YYYY-MM-TT` (einmalig) – die
 * Formatpruefung/Datums-Mathematik passiert client-seitig (kein neues Backend),
 * hier nur Typ + Laengen. Art/Datum sind Pflicht; leere Eintraege verwirft der
 * Service (resolveZiele).
 */
export class SteuerTerminDto {
  /** Stabile, inhaltsunabhaengige Kennung (Client-erzeugt) fuer die Nudge-/Snooze-Zuordnung. */
  @IsOptional() @IsString() @MaxLength(STEUER_TERMIN_ID_MAX) id?: string;

  @IsString() @MaxLength(STEUER_TERMIN_ART_MAX) art!: string;

  @IsString() @MaxLength(STEUER_TERMIN_DATUM_MAX) datum!: string;

  @IsOptional() @IsBoolean() wiederkehrend?: boolean;

  @IsOptional() @IsBoolean() aktiv?: boolean;
}

/**
 * Ziele & Erinnerungen (Welle 1): Auslastungsziel, §19-Umsatzgrenzen-Warnung
 * (nur der Schalter – der Status kommt aus dem bestehenden §19-Waechter) und bis
 * zu 12 selbst gepflegte Steuer-Termine. Teil-Update ueber die bestehende
 * (aufgeloeste) Konfiguration (mergeZiele); landet als Objekt in
 * tenant.settings.ziele. Reine In-App-Erinnerungen (kein Mail-Versand).
 */
export class ZieleDto {
  @IsOptional() @IsBoolean() auslastungAktiv?: boolean;

  @IsOptional()
  @IsInt()
  @Min(AUSLASTUNG_ZIEL_MIN)
  @Max(AUSLASTUNG_ZIEL_MAX)
  auslastungZielProzent?: number;

  @IsOptional() @IsBoolean() par19WarnungAktiv?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(STEUER_TERMINE_MAX)
  @ValidateNested({ each: true })
  @Type(() => SteuerTerminDto)
  steuerTermine?: SteuerTerminDto[];
}

/**
 * Kundenkommunikation – Feature 1 (Termin-Erinnerung an den Endkunden). Teil-Update;
 * landet als Objekt in tenant.settings.kundenkommunikation. `terminErinnerungAktiv`
 * ist ein Opt-in (Default AUS – automatische Kunden-Mails brauchen einen bewussten
 * Schalter), `stundenVorlauf` die Vorlaufzeit (Default 24), geklammert auf [1..168].
 */
export class KundenkommunikationDto {
  @IsOptional() @IsBoolean() terminErinnerungAktiv?: boolean;

  @IsOptional() @IsInt() @Min(STUNDEN_VORLAUF_MIN) @Max(STUNDEN_VORLAUF_MAX) stundenVorlauf?: number;
}

/**
 * Bewertungs-Bitte – Feature 2. Teil-Update; landet als Objekt in tenant.settings.bewertung.
 * Wird bei Auftrags-Abschluss (OrderStatus.FERTIG) an die bestehende "abholbereit"-Mail
 * angehaengt – nur wenn `aktiv` UND `googleUrl` gesetzt sind. Leere URL erlaubt
 * (= Feld leeren); sonst nur https (die URL landet als Link in einer Kunden-Mail),
 * ValidateIf ueberspringt die Pruefung beim Leeren (setOrDelete-Muster).
 */
export class BewertungDto {
  @IsOptional() @IsBoolean() aktiv?: boolean;

  @IsOptional()
  @ValidateIf((o: BewertungDto) => o.googleUrl !== '')
  @Matches(/^https:\/\/\S+$/, { message: 'Der Bewertungs-Link muss mit https:// beginnen.' })
  @MaxLength(BEWERTUNG_URL_MAX)
  googleUrl?: string;

  @IsOptional() @IsString() @MaxLength(BEWERTUNG_TEXT_MAX) text?: string;
}

/**
 * Eine editierbare Status-Mail-Vorlage (Betreff + Fliesstext). Beide optional
 * (Teil-Update); leerer String = Feld leeren -> Aufrufer faellt auf den heutigen
 * Default-Text zurueck. Platzhalter ({auftragsnummer}/{betrieb}/{fahrzeug}/{status})
 * werden erst beim Versand ersetzt – hier nur Typ + Laenge geprueft.
 */
export class StatusMailVorlageDto {
  @IsOptional() @IsString() @MaxLength(STATUS_MAIL_BETREFF_MAX) betreff?: string;
  @IsOptional() @IsString() @MaxLength(STATUS_MAIL_TEXT_MAX) text?: string;
}

/**
 * Editierbare Status-Mail-Vorlagen je kuratiertem Status (bestaetigt/in_arbeit/
 * abholbereit). Teil-Update: nur uebergebene Status/Felder werden angewandt
 * (mergeStatusMailVorlagen). Landet als Objekt in tenant.settings.statusMailVorlagen.
 */
export class StatusMailVorlagenDto {
  @IsOptional() @ValidateNested() @Type(() => StatusMailVorlageDto) bestaetigt?: StatusMailVorlageDto;
  @IsOptional() @ValidateNested() @Type(() => StatusMailVorlageDto) in_arbeit?: StatusMailVorlageDto;
  @IsOptional() @ValidateNested() @Type(() => StatusMailVorlageDto) abholbereit?: StatusMailVorlageDto;
}

/**
 * Datenschutz-Einstellungen (DSGVO Art. 5 Abs. 1 lit. e): Aufbewahrungsfrist fuer
 * inaktive Kunden in Jahren. 0 = Automatik aus. Teil-Update ueber die bestehende
 * (aufgeloeste) Konfiguration (mergeDatenschutz); landet als Objekt in
 * tenant.settings.datenschutz. Es wird NIE automatisch geloescht – nur die
 * Pruefliste im Datenschutz-Cockpit befuellt.
 */
export class DatenschutzDto {
  @IsOptional()
  @IsInt()
  @Min(AUFBEWAHRUNG_JAHRE_MIN)
  @Max(AUFBEWAHRUNG_JAHRE_MAX)
  aufbewahrungInaktiveKundenJahre?: number;
}

/**
 * Nachfass-Konfiguration (Welle 2-B, Teil 1): ab wie vielen Tagen ein noch offenes
 * Angebot als nachfassreif gilt (Default 7). Teil-Update ueber die bestehende
 * (aufgeloeste) Konfiguration (mergeNachfass); landet als Objekt in
 * tenant.settings.nachfass. Reine In-App-Vorschlagsliste (kein Auto-Versand).
 */
export class NachfassDto {
  @IsOptional() @IsInt() @Min(NACHFASS_TAGE_MIN) @Max(NACHFASS_TAGE_MAX) tageOffen?: number;
}

/**
 * Stammdaten des EIGENEN Betriebs (Self-Service durch den Inhaber).
 * Alle Felder optional -> Teil-Update (PATCH). Adress-/Kontaktfelder landen in
 * echten Tenant-Spalten, Steuer-/Bankfelder in tenant.settings (genau die Keys,
 * die das Rechnungs-PDF bereits ausliest: steuernummer/ustId/iban/bic/bankname).
 *
 * §14 UStG: Name + Anschrift + (Steuernummer ODER USt-IdNr) sind Pflichtangaben
 * auf einer gueltigen Rechnung.
 */
export class UpdateTenantSettingsDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;

  /** Ausrichtung des Betriebs (Theming + Kalkulations-Katalog). */
  @IsOptional() @IsIn(Object.values(Betriebstyp)) betriebstyp?: Betriebstyp;

  /**
   * Eigene Akzentfarbe des Betriebs ("Dein Look"). Bevorzugt vor der
   * Betriebstyp-Standardfarbe (resolveTenantAkzent). 3-/6-stelliges Hex, fuehrendes
   * `#` optional (der Service normalisiert es MIT `#`, weil der Lesepfad es
   * verlangt). Leerer String = zuruecksetzen auf den Branchen-Standard (ValidateIf
   * ueberspringt dann die Formatpruefung, setOrDelete-Muster). Landet in
   * tenant.settings.akzentfarbe.
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantSettingsDto) => o.akzentfarbe !== '')
  @Matches(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Bitte gültige Hex-Farbe angeben (z. B. #B5722F).',
  })
  akzentfarbe?: string;
  /**
   * Betriebs-E-Mail: dient u. a. als Reply-To der Kunden-Mails (T-003), deshalb
   * echte E-Mail-Validierung. Leerer String bleibt erlaubt (= Feld loeschen) –
   * ValidateIf ueberspringt die Pruefung dann.
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantSettingsDto) => o.email !== '')
  @IsEmail({}, { message: 'Bitte eine gueltige E-Mail-Adresse angeben.' })
  @MaxLength(160)
  email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;

  @IsOptional() @IsString() @MaxLength(120) street?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;

  @IsOptional() @IsString() @MaxLength(40) steuernummer?: string;
  @IsOptional() @IsString() @MaxLength(40) ustId?: string;

  @IsOptional() @IsString() @MaxLength(40) iban?: string;
  @IsOptional() @IsString() @MaxLength(20) bic?: string;
  @IsOptional() @IsString() @MaxLength(80) bankname?: string;

  // DATEV-Buchhaltungsexport (je Betrieb pflegbar).
  @IsOptional() @IsString() @MaxLength(20) datevBeraterNr?: string;
  @IsOptional() @IsString() @MaxLength(20) datevMandantNr?: string;
  @IsOptional() @IsString() @MaxLength(4) datevSkr?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto19?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto7?: string;
  @IsOptional() @IsString() @MaxLength(8) datevErloeskonto0?: string;
  @IsOptional() @IsString() @MaxLength(8) datevDebitorSammelkonto?: string;

  // Rechnungsstellung: Standardwerte fuer NEUE Rechnungen (bestehende bleiben unveraendert).
  /** Standard-Zahlungsziel in Tagen (leer = Systemstandard 14). */
  @IsOptional()
  @Matches(/^\d{0,3}$/, { message: 'Zahlungsziel bitte als Zahl in Tagen angeben (z. B. 14).' })
  rechnungZahlungszielTage?: string;

  /** Freier Fusstext auf dem Rechnungs-/Angebots-PDF (z. B. Danke-Zeile, Hinweis). */
  @IsOptional() @IsString() @MaxLength(300) rechnungFusstext?: string;

  /**
   * Eigener Online-Zahlungslink des Betriebs (T-006), z. B. PayPal.me oder ein
   * im EIGENEN Stripe-Konto erstellter Payment Link. Wird auf der oeffentlichen
   * Belegseite als "Online bezahlen"-Button gezeigt – das Geld fliesst direkt
   * an den Betrieb, nie ueber die Plattform. Leerer String = Link entfernen
   * (ValidateIf ueberspringt die Pruefung dann, setOrDelete-Muster).
   */
  @IsOptional()
  @ValidateIf((o: UpdateTenantSettingsDto) => o.rechnungPaymentLink !== '')
  @Matches(/^https:\/\/\S+$/, { message: 'Der Zahlungslink muss mit https:// beginnen.' })
  @MaxLength(300)
  rechnungPaymentLink?: string;

  // Automatische Kunden-Mails (T-003): '1' = an (Default, auch wenn ungesetzt),
  // '0' = aus, '' = Key loeschen (zurueck auf Default). Werte als String, weil
  // tenant.settings durchgaengig String-Keys haelt (setOrDelete-Muster).
  /** Status-Mails an Endkunden (bestaetigt/in Arbeit/abholbereit, mit Track-Link). */
  @IsOptional() @IsIn(['0', '1', '']) kundenmailStatus?: string;

  /** Terminbestaetigung an Endkunden bei Annahme einer Online-Anfrage. */
  @IsOptional() @IsIn(['0', '1', '']) kundenmailTerminbestaetigung?: string;

  /**
   * 2FA-Pflicht fuer die Betriebs-Rollen dieses Betriebs (Owner-Policy). '1' = an,
   * '0' = aus, '' = Key loeschen (zurueck auf Default aus). String-Key wie die
   * uebrigen settings-Flags (setOrDelete-Muster). Erzwungen wird die Einrichtung
   * im Frontend (kein Server-Hard-Block, um Aussperrung zu vermeiden).
   */
  @IsOptional() @IsIn(['0', '1', '']) mfaPflicht?: string;

  // sevDesk-API-Token (pro Betrieb). Leerer String = Integration deaktivieren.
  // Wird verschluesselt in der dedizierten Spalte tenant.sevdeskApiToken abgelegt
  // (NICHT in settings) und nie im Klartext zurueckgegeben.
  @IsOptional() @IsString() @MaxLength(120) sevdeskApiToken?: string;

  /**
   * Mahnwesen-Konfiguration (C1-C): Auto-Mahnen an/aus, Fristen (Tage nach
   * Faelligkeit) und Mahngebuehren. Teil-Update: nur die uebergebenen Felder
   * werden auf die bestehende Konfiguration angewandt (Service). Landet als
   * Objekt in tenant.settings.mahnwesen.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MahnwesenDto)
  mahnwesen?: MahnwesenDto;

  /**
   * SMTP-Konfiguration fuer den betriebseigenen Mail-Versand (feat/night-email).
   * Teil-Update: nur uebergebene Felder werden angewandt. Nicht-secret-Felder
   * landen in tenant.settings.mailConfig, das Passwort in der verschluesselten
   * select:false-Spalte tenant.smtpPassword (nie in settings, nie in Antworten).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MailConfigDto)
  mailConfig?: MailConfigDto;

  /**
   * EUR/qm-Richtwerte der 3D-Sofortkalkulation (Folierung/PPF/Aufbereitung).
   * Teil-Update: nur uebergebene Felder werden angewandt. Landet als Objekt in
   * tenant.settings.kalkulation; Defaults spiegeln 60/130/25.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => KalkulationDto)
  kalkulation?: KalkulationDto;

  /**
   * Kalender-/Plantafel-Einstellungen (Arbeitszeiten, Konfliktverhalten,
   * Standort-Konflikt, Slot-/Puffer-Minuten). Teil-Update ueber die bestehende
   * (aufgeloeste) Konfiguration; landet als Objekt in tenant.settings.kalender.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => KalenderDto)
  kalender?: KalenderDto;

  /**
   * Buchungsportal-Einstellungen (Vorlauf min/max fuer den Slot-Picker, W2).
   * Teil-Update ueber die bestehende (aufgeloeste) Konfiguration; landet als
   * Objekt in tenant.settings.buchung.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => BuchungDto)
  buchung?: BuchungDto;

  /**
   * Darstellungs-Einstellungen der Plantafel (Wochenstart, Zeitformat, sichtbarer
   * Stundenbereich). Teil-Update ueber die bestehende (aufgeloeste) Konfiguration;
   * landet als Objekt in tenant.settings.darstellung.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DarstellungDto)
  darstellung?: DarstellungDto;

  /**
   * Steuer-Einstellungen (Welle 1): §19-Kleinunternehmer, Standard-MwSt-Satz
   * fuer neue Belege, Rechtsform + Registerangaben. Teil-Update ueber die
   * bestehende (aufgeloeste) Konfiguration; landet als Objekt in
   * tenant.settings.steuer.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => SteuerDto)
  steuer?: SteuerDto;

  /**
   * Optionaler Impressum-Zusatzblock (Tenant-Impressum-Generator): Berufshaftpflicht
   * + Aufsichtsbehoerde. Teil-Update ueber die bestehende (aufgeloeste) Konfig;
   * landet als Objekt in tenant.settings.impressum. Pflichtangaben stammen aus den
   * bestehenden Feldern (Adresse/Kontakt/steuer/ustId).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ImpressumDto)
  impressum?: ImpressumDto;

  /**
   * Oeffentliches Mitglieds-Profil (Opt-in fuer die Mitgliederliste auf
   * detailly.de): zeigen + optional Stadt/Kurzbeschreibung/Webseite. Teil-Update
   * ueber die bestehende (aufgeloeste) Konfig; landet als Objekt in
   * tenant.settings.mitgliedProfil.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MitgliedProfilDto)
  mitgliedProfil?: MitgliedProfilDto;

  /**
   * Ziele & Erinnerungen (Welle 1): Auslastungsziel, §19-Warnungs-Schalter und
   * bis zu 12 selbst gepflegte Steuer-Termine. Teil-Update ueber die bestehende
   * (aufgeloeste) Konfiguration; landet als Objekt in tenant.settings.ziele.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ZieleDto)
  ziele?: ZieleDto;

  /**
   * Kundenkommunikation – Feature 1 (Termin-Erinnerung an den Endkunden, 24 h
   * vorher). Teil-Update ueber die bestehende (aufgeloeste) Konfiguration; landet
   * als Objekt in tenant.settings.kundenkommunikation. Opt-in (Default AUS).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => KundenkommunikationDto)
  kundenkommunikation?: KundenkommunikationDto;

  /**
   * Bewertungs-Bitte – Feature 2. Teil-Update ueber die bestehende (aufgeloeste)
   * Konfiguration; landet als Objekt in tenant.settings.bewertung. Wird an die
   * Abschluss-Statusmail (FERTIG) angehaengt, wenn aktiv + Google-URL gesetzt.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => BewertungDto)
  bewertung?: BewertungDto;

  /**
   * Editierbare Status-Mail-Vorlagen (Welle 3-A): je Status Betreff + Text mit
   * Platzhaltern. Teil-Update ueber die bestehende (aufgeloeste) Konfiguration;
   * landet als Objekt in tenant.settings.statusMailVorlagen. Leer/ungepflegt =>
   * heutiger Default-Text (Altbestand unveraendert).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => StatusMailVorlagenDto)
  statusMailVorlagen?: StatusMailVorlagenDto;

  /**
   * Datenschutz-Einstellungen (DSGVO Art. 5 Abs. 1 lit. e): Aufbewahrungsfrist
   * inaktiver Kunden (Jahre, 0 = aus). Teil-Update ueber die bestehende
   * (aufgeloeste) Konfiguration; landet als Objekt in tenant.settings.datenschutz.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DatenschutzDto)
  datenschutz?: DatenschutzDto;

  /**
   * Nachfass-Konfiguration (Welle 2-B, Teil 1): Tage, ab denen ein offenes Angebot
   * als nachfassreif gilt (Default 7). Teil-Update ueber die bestehende
   * (aufgeloeste) Konfiguration; landet als Objekt in tenant.settings.nachfass.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => NachfassDto)
  nachfass?: NachfassDto;
}
