import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MarketplaceOrderStatus } from '../entities/marketplace-order.entity';

/** Nur http/https – die Links werden als href gerendert (kein javascript: o. ae.). */
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

/** Feste Marktplatz-Bereiche (Haupt-Navigation im Katalog). */
export const MARKTPLATZ_BEREICHE = ['folierung', 'aufbereitung', 'ppf', 'sonstiges'];

// ---------------------------------------------------------------------------
// technischeDaten: flache Merkmal->Wert-Map (in der Entity als simple-json/jsonb).
// Robuste Whitelist gegen DoS/Mass-Assignment: NUR ein flaches Objekt aus kurzen
// String-Keys auf primitive Werte – kein Nesting, keine Arrays, begrenzte Anzahl
// und Laenge. Ungueltiges Format -> 400 (die globale ValidationPipe).
// ---------------------------------------------------------------------------
export const TECH_DATEN_MAX_KEYS = 40;
export const TECH_DATEN_MAX_KEY_LEN = 60;
export const TECH_DATEN_MAX_VALUE_LEN = 500;

/** Custom-Validator: prueft, dass `technischeDaten` eine flache, begrenzte Merkmal-Map ist. */
export function IsFlacheMerkmalMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isFlacheMerkmalMap',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'technischeDaten muss ein flaches Objekt aus kurzen Text-Merkmalen sein (kein Verschachteln, keine Arrays).',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          // null/undefined deckt das begleitende @IsOptional ab.
          if (value === null || value === undefined) return true;
          if (typeof value !== 'object' || Array.isArray(value)) return false;
          const eintraege = Object.entries(value as Record<string, unknown>);
          if (eintraege.length > TECH_DATEN_MAX_KEYS) return false;
          for (const [k, v] of eintraege) {
            if (typeof k !== 'string' || k.length === 0 || k.length > TECH_DATEN_MAX_KEY_LEN) {
              return false;
            }
            const primitiv = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
            if (!primitiv) return false;
            if (typeof v === 'string' && v.length > TECH_DATEN_MAX_VALUE_LEN) return false;
            if (typeof v === 'number' && !Number.isFinite(v)) return false;
          }
          return true;
        },
      },
    });
  };
}

export class CreateDealerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  webseite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  @ApiPropertyOptional({ description: 'Kontakt fuer Bestell-Benachrichtigungen' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail?: string;

  @ApiPropertyOptional({ description: 'Betreiber-Provision in Prozent (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  provisionSatz?: number;
}

export class UpdateDealerDto extends PartialType(CreateDealerDto) {}

export class CreateProductDto {
  @ApiProperty({ description: 'Haendler (MarketplaceDealer.id)' })
  @IsString()
  dealerId: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: MARKTPLATZ_BEREICHE, description: 'Bereich (Haupt-Navigation im Katalog)' })
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich: string;

  @ApiPropertyOptional({ description: 'Marke/Hersteller, z. B. "3M", "Koch Chemie" (Schnellfilter)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marke?: string;

  @ApiPropertyOptional({ description: 'Legacy-Kategorie (durch bereich+marke abgeloest)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kategorie?: string;

  @ApiPropertyOptional({ description: 'Detailly-Affiliate-Link zum Haendler-Shop (optional bei bestellbaren Produkten)' })
  @IsOptional()
  @IsUrl(URL_OPTS)
  affiliateUrl?: string;

  @ApiPropertyOptional({ description: 'Direkt in der App bestellbar (braucht preis)' })
  @IsOptional()
  @IsBoolean()
  bestellbar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  preis?: number;

  @ApiPropertyOptional({ description: 'z. B. "pro Rolle", "ab"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preisHinweis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  bildUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

// ---------------------------------------------------------------------------
// In-App-Bestellung (Betrieb)
// ---------------------------------------------------------------------------

export class OrderItemInputDto {
  @ApiProperty({ description: 'MarketplaceProduct.id' })
  @IsString()
  @MaxLength(64)
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(999)
  menge: number;
}

export class CreateMarketplaceOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  kontaktName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kontaktTelefon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieferFirma?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  lieferStrasse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  lieferPlz?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lieferOrt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lieferLand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notiz?: string;

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  positionen: OrderItemInputDto[];
}

// ---------------------------------------------------------------------------
// Produkt-Bewertung (Buy-Side): nur verifizierte Kaeufer, eine je Betrieb
// ---------------------------------------------------------------------------

/**
 * Bewertung schreiben/aendern. sterne 1–5 (Pflicht), text optional. Strikte
 * Whitelist: tenantId/userId/verifiziert/aktiv kommen NIE aus dem Body – sie
 * werden serverseitig gesetzt (JWT bzw. Kauf-Nachweis). Zusammen mit der
 * globalen ValidationPipe (whitelist + forbidNonWhitelisted) ist Mass-Assignment
 * ausgeschlossen.
 */
export class CreateReviewDto {
  @ApiProperty({ description: 'Sterne 1–5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  sterne: number;

  @ApiPropertyOptional({ description: 'Bewertungstext (optional)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}

// ---------------------------------------------------------------------------
// Haendler-Portal (Token-Zugriff): eigene Produkte + Bestellstatus
// ---------------------------------------------------------------------------

/** Produktpflege durch den Haendler selbst - ohne dealerId (kommt aus dem Token). */
export class PortalProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: MARKTPLATZ_BEREICHE, description: 'Bereich (Haupt-Navigation im Katalog)' })
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich: string;

  @ApiPropertyOptional({ description: 'Marke/Hersteller, z. B. "3M", "Koch Chemie" (Schnellfilter)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  marke?: string;

  @ApiPropertyOptional({ description: 'Legacy-Kategorie (durch bereich+marke abgeloest)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  kategorie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  preis?: number;

  @ApiPropertyOptional({ description: 'z. B. "pro Rolle", "ab"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preisHinweis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  bildUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  affiliateUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  beschreibung?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bestellbar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  // --- PR9: fuer den Haendler freigegebene Katalog-Felder ---------------------
  // BEWUSST NICHT hier: istHighlight (Betreiber-Kuration, PR7) und
  // sdbDatei/bewertung* (nur ueber Upload/System). Alle Felder @IsOptional; leere
  // Uebergabe (null) laesst der Service unveraendert bzw. setzt zurueck.

  @ApiPropertyOptional({
    description: 'Unterkategorie-Id aus der Taxonomie (muss existieren + aktiv sein); null = keine',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Herkunftsland als ISO-3166-1 alpha-2 (z. B. "DE"); serverseitig gross geschrieben',
  })
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/, {
    message: 'herkunftsland muss ein ISO-3166-1-alpha-2-Code sein (z. B. DE).',
  })
  herkunftsland?: string;

  @ApiPropertyOptional({ description: 'Versandkosten (brutto); 0 = kostenlos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  versandKosten?: number;

  @ApiPropertyOptional({ description: 'Hinweis zum Versand (Freitext)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  versandHinweis?: string;

  @ApiPropertyOptional({ description: 'Lieferzeit in Tagen' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lieferzeitTage?: number;

  @ApiPropertyOptional({ description: 'Lagerbestand; null = unbekannt/unbegrenzt' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  bestand?: number | null;

  @ApiPropertyOptional({ description: 'Anwendungshinweise (Freitext)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  anwendungshinweise?: string;

  @ApiPropertyOptional({ description: 'Technische Daten als flache Merkmal->Wert-Map' })
  @IsOptional()
  @IsFlacheMerkmalMap()
  technischeDaten?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({ description: 'Inhalts-/Gebindemenge (Freitext, z. B. "500 ml", "5 L")' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  inhaltMenge?: string;
}

export class UpdatePortalProductDto extends PartialType(PortalProductDto) {}

export class OrderStatusDto {
  @ApiProperty({ enum: MarketplaceOrderStatus })
  @IsIn(Object.values(MarketplaceOrderStatus))
  status: MarketplaceOrderStatus;
}

// ---------------------------------------------------------------------------
// Grosshaendler-Bewerbung (oeffentlich) + Betreiber-Review (Welle 3)
// ---------------------------------------------------------------------------

/**
 * Oeffentliche Grosshaendler-Bewerbung. STRIKTE Whitelist wie bei der
 * Online-Terminanfrage: KEIN status/aktiv/provisionSatz/Token aus dem Body –
 * zusammen mit der globalen ValidationPipe (whitelist+forbidNonWhitelisted)
 * ist Mass-Assignment ausgeschlossen. Pflicht laut Betreiber-Entscheidung:
 * Firma, Ansprechpartner, E-Mail und USt-IdNr (B2B-Seriositaets-Check).
 */
export class HaendlerBewerbungDto {
  @ApiProperty({ description: 'Firmenname' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: 'Ansprechpartner (Vor- und Nachname)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ansprechpartner: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  kontaktEmail: string;

  /** Pflichtfeld (Betreiber-Entscheidung); Format prueft der Betreiber im Review. */
  @ApiProperty({ description: 'USt-IdNr., z. B. DE123456789' })
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  ustIdNr: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTS)
  webseite?: string;

  @ApiPropertyOptional({ description: 'Anschrift (Freitext)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  adresse?: string;

  @ApiPropertyOptional({ description: 'Sortiment als CSV der Marktplatz-Bereiche' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sortiment?: string;

  @ApiPropertyOptional({ description: 'Nachricht an das Detailly-Team' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  nachricht?: string;

  /**
   * Honeypot (wie CreateBookingRequestDto.website): per CSS versteckt, Menschen
   * lassen es leer. Gefuellt -> still verwerfen, Erfolg vortaeuschen. Wird NIE
   * gespeichert.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

/** Betreiber-Freigabe einer Bewerbung; Provision im Review anpassbar (Default 10 %). */
export class DealerFreigabeDto {
  @ApiPropertyOptional({ description: 'Betreiber-Provision in Prozent (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  provisionSatz?: number;
}

// ---------------------------------------------------------------------------
// Betreiber-Admin (PR7): Kategorie-CRUD, Highlight-Kuration, Moderation
// ---------------------------------------------------------------------------

/** Slug-Format: klein, alphanumerisch, mit Bindestrich getrennt (URL-/Filter-Anker). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Kategorie anlegen (Haupt- oder Unterkategorie). STRIKTE Whitelist: der Slug
 * ist plattform-weit eindeutig (Service prueft, Konflikt -> 409); der `bereich`
 * einer Unterkategorie wird serverseitig vom Parent abgeleitet (nie aus dem Body).
 */
export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ description: 'Plattform-weit eindeutiger Slug (a-z, 0-9, Bindestrich)' })
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_RE, { message: 'slug darf nur a-z, 0-9 und Bindestriche enthalten' })
  slug: string;

  @ApiPropertyOptional({
    enum: MARKTPLATZ_BEREICHE,
    description: 'Bereich – bei Hauptkategorie Pflicht, bei Unterkategorie vom Parent abgeleitet',
  })
  @IsOptional()
  @IsIn(MARKTPLATZ_BEREICHE)
  bereich?: string;

  @ApiPropertyOptional({ description: 'Id der Hauptkategorie (leer = neue Hauptkategorie)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortIndex?: number;

  @ApiPropertyOptional({ description: 'Chemie-Kategorie: SDB am Produkt Pflicht' })
  @IsOptional()
  @IsBoolean()
  sdbPflicht?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;
}

/**
 * Kategorie bearbeiten: nur name/sortIndex/aktiv/sdbPflicht/parentId. Der Slug
 * bleibt fix (URL-/Filter-Anker). `parentId=null` macht die Kategorie zur
 * Hauptkategorie; ein gesetzter Wert haengt sie unter eine Hauptkategorie.
 */
export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aktiv?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sdbPflicht?: boolean;

  @ApiPropertyOptional({ description: 'null = Hauptkategorie; Id = unter diese Hauptkategorie', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string | null;
}

/** Highlight-Kuration: Produkt redaktionell hervorheben (setzen/entfernen). */
export class HighlightDto {
  @ApiProperty()
  @IsBoolean()
  istHighlight: boolean;
}

/** Bewertungs-Moderation: aktiv=true einblenden, false ausblenden (nicht loeschen). */
export class ReviewModerationDto {
  @ApiProperty({ description: 'true = sichtbar, false = ausgeblendet' })
  @IsBoolean()
  aktiv: boolean;
}
