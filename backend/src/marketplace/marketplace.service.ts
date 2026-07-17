import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Like, MoreThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { MarketplaceDealer } from './entities/marketplace-dealer.entity';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceClick } from './entities/marketplace-click.entity';
import { MarketplaceOrder, MarketplaceOrderStatus } from './entities/marketplace-order.entity';
import { MarketplaceOrderItem } from './entities/marketplace-order-item.entity';
import { MarketplaceCategory } from './entities/marketplace-category.entity';
import { MarketplaceReview } from './entities/marketplace-review.entity';
import { berechneRankingScore, bestandStatus } from './catalog-ranking.util';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { withUniqueRetry } from '../common/unique-retry';
import { MailService } from '../mailer/mail.service';
import { User, UserRole } from '../users/entities/user.entity';
import { AuthService } from '../auth/auth.service';
import { KybService, HochgeladenesDokument } from './kyb.service';
import { MarketplaceUploadService } from './marketplace-upload.service';
import {
  CreateDealerDto,
  UpdateDealerDto,
  CreateProductDto,
  UpdateProductDto,
  CreateMarketplaceOrderDto,
  CreateReviewDto,
  PortalProductDto,
  UpdatePortalProductDto,
  HaendlerBewerbungDto,
  MARKTPLATZ_BEREICHE,
} from './dto/marketplace.dto';

/** Kaufmaennisch auf 2 Nachkommastellen runden (Preise/Provisionen). */
const rund2 = (n: number) => Math.round(n * 100) / 100;

/** Erlaubte Katalog-Sortierungen (Default: 'empfohlen' = Ranking-Score). */
export type CatalogSort = 'empfohlen' | 'preis' | 'neu' | 'klicks';
const CATALOG_SORTS: CatalogSort[] = ['empfohlen', 'preis', 'neu', 'klicks'];

/** Unbekannte/leere Sort-Eingabe faellt auf die Empfehlung zurueck. */
export function normalizeCatalogSort(sort?: string): CatalogSort {
  return CATALOG_SORTS.includes(sort as CatalogSort) ? (sort as CatalogSort) : 'empfohlen';
}

/**
 * Select-Projektion des Listen-Katalogs: nur die fuer Karten/Filter/Ranking
 * noetigen Spalten. SCHWERE Detail-Felder (anwendungshinweise/technischeDaten)
 * und interne SDB-Metadaten (sdbHash/sdbHochgeladenAm) bleiben BEWUSST draussen.
 */
const CATALOG_SELECT: (keyof MarketplaceProduct)[] = [
  'id',
  'dealerId',
  'name',
  'beschreibung',
  'bereich',
  'marke',
  'kategorie',
  'categoryId',
  'herkunftsland',
  'preis',
  'preisHinweis',
  'bestellbar',
  'affiliateUrl',
  'inhaltMenge',
  'versandKosten',
  'versandHinweis',
  'lieferzeitTage',
  'bestand',
  'istHighlight',
  'sdbDatei',
  'bewertungSchnitt',
  'bewertungAnzahl',
  'klicks',
  'bildUrl',
  'createdAt',
];

/** Groesse der Highlight-/Top-Ranking-Teilmenge im Katalog. */
const HIGHLIGHTS_TOP_N = 8;

/** Anzahl Reviews in der Detail-Bewertungsvorschau (neueste zuerst). */
const REVIEW_VORSCHAU = 5;

/** Paginierung der oeffentlichen Bewertungsliste (GET reviews). */
const REVIEW_LIST_LIMIT_DEFAULT = 20;
const REVIEW_LIST_LIMIT_MAX = 50;

/** Minimal-Form eines angereicherten Katalog-Produkts fuer die Sortierung. */
interface KatalogSortItem {
  preis: number | null;
  klicks: number | null;
  createdAt: Date | string | null;
  rankingScore: number;
  id: string;
}

/** Zeitstempel robust als Zahl (fehlend -> 0, aeltester Rang). */
const zeit = (d: Date | string | null): number => {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Sortiert den angereicherten Katalog IN PLACE nach der gewaehlten Option:
 *  - 'empfohlen': Ranking-Score absteigend (Tie-Break: neueste, dann id)
 *  - 'preis'    : Preis aufsteigend; Produkte OHNE Preis ans Ende
 *  - 'neu'      : createdAt absteigend
 *  - 'klicks'   : Klicks absteigend
 */
function sortiereKatalog<T extends KatalogSortItem>(items: T[], sort: CatalogSort): void {
  const cmp: Record<CatalogSort, (a: T, b: T) => number> = {
    empfohlen: (a, b) =>
      b.rankingScore - a.rankingScore ||
      zeit(b.createdAt) - zeit(a.createdAt) ||
      a.id.localeCompare(b.id),
    preis: (a, b) => {
      const pa = a.preis == null ? Infinity : Number(a.preis);
      const pb = b.preis == null ? Infinity : Number(b.preis);
      return pa - pb || a.id.localeCompare(b.id);
    },
    neu: (a, b) => zeit(b.createdAt) - zeit(a.createdAt) || a.id.localeCompare(b.id),
    klicks: (a, b) => (Number(b.klicks) || 0) - (Number(a.klicks) || 0) || a.id.localeCompare(b.id),
  };
  items.sort(cmp[sort]);
}

/**
 * B2B-Marktplatz (Detailly-kuratiert, plattform-weit). Betriebe sehen den
 * Katalog, klicken zum Haendler (Affiliate) ODER bestellen direkt in der App
 * (Provision fuer den Betreiber). Haendler pflegen Produkte + wickeln
 * Bestellungen ueber das Token-Portal ab; Pflege der Haendler selbst
 * ausschliesslich durch Plattform-Rollen (Controller-Guards).
 */
@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(MarketplaceDealer) private readonly dealerRepo: Repository<MarketplaceDealer>,
    @InjectRepository(MarketplaceProduct) private readonly productRepo: Repository<MarketplaceProduct>,
    @InjectRepository(MarketplaceClick) private readonly clickRepo: Repository<MarketplaceClick>,
    @InjectRepository(MarketplaceOrder) private readonly orderRepo: Repository<MarketplaceOrder>,
    @InjectRepository(MarketplaceOrderItem)
    private readonly orderItemRepo: Repository<MarketplaceOrderItem>,
    @InjectRepository(MarketplaceCategory)
    private readonly categoryRepo: Repository<MarketplaceCategory>,
    @InjectRepository(MarketplaceReview)
    private readonly reviewRepo: Repository<MarketplaceReview>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly kyb: KybService,
    private readonly auth: AuthService,
    private readonly upload: MarketplaceUploadService,
  ) {}

  // ---------------------------------------------------------------------------
  // Katalog (Kunden-Seite)
  // ---------------------------------------------------------------------------

  /**
   * Kompletter aktiver Katalog in EINEM Aufruf (kuratiert -> ueberschaubar
   * gross): Produkte inkl. Haendlername, Haendlerliste, Kategorien. Das
   * Frontend filtert clientseitig -> sofortige Reaktion ohne Requests.
   *
   * PR4 (Katalog-API): je Produkt kommen die Shop-relevanten Rohdaten mit
   * (Kategorie/Herkunft/Bewertung/Versand/Bild) plus ein abgeleiteter
   * `bestandStatus` und ein `rankingScore`. SCHWERE Detail-Felder
   * (anwendungshinweise/technischeDaten) bleiben BEWUSST draussen (Select-
   * Projektion) - die liefert der Detail-Endpoint. Datenladen bleibt konstant:
   * 1x Produkte, 1x Haendler, 1x Verkaufs-Aggregat, 1x Galerie-Bilder (kein N+1).
   *
   * `sort` steuert die Reihenfolge: 'empfohlen' (Default, Ranking-Score) |
   * 'preis' (aufsteigend, ohne Preis ans Ende) | 'neu' (createdAt) | 'klicks'.
   */
  async catalog(sort: CatalogSort = 'empfohlen') {
    const [produkte, haendler] = await Promise.all([
      this.productRepo.find({
        where: { aktiv: true },
        select: CATALOG_SELECT,
        // Stabile DB-Reihenfolge (neueste zuerst), damit die 1000er-Kappung
        // deterministisch bleibt; die Anzeige-Sortierung erfolgt danach in-memory.
        order: { createdAt: 'DESC' },
        take: 1000,
      }),
      // Welle 3: NUR aktiv + freigegeben - beantragte/abgelehnte Bewerbungen
      // tauchen NIE im Katalog auf (Bestand traegt den Default 'freigegeben').
      this.dealerRepo.find({ where: { aktiv: true, status: 'freigegeben' }, order: { name: 'ASC' } }),
    ]);
    const dealerById = new Map(haendler.map((d) => [d.id, d.name]));
    // Legacy-Feld (kann leer sein); die Navigation laeuft ueber bereich+marke.
    const kategorien = [...new Set(produkte.map((p) => p.kategorie).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    );
    // Nur Produkte anbietbarer Haendler; deren Verkaufszahlen + Galerie-Bild-Ids
    // in JE EINER Aggregat-/Sammelabfrage anreichern (kein Per-Produkt-Query).
    const sichtbar = produkte.filter((p) => dealerById.has(p.dealerId));
    const ids = sichtbar.map((p) => p.id);
    const [verkauftByProduct, bilderByProduct] = await Promise.all([
      this.verkaufszahlen(ids),
      this.upload.bilderFuerProdukte(ids),
    ]);

    const now = Date.now();
    const angereichert = sichtbar.map((p) => {
      const verkauft = verkauftByProduct.get(p.id) ?? 0;
      const rankingScore = berechneRankingScore(
        {
          klicks: p.klicks,
          verkauft,
          bewertungSchnitt: p.bewertungSchnitt,
          bewertungAnzahl: p.bewertungAnzahl,
          istHighlight: p.istHighlight,
          createdAt: p.createdAt,
        },
        now,
      );
      return {
        id: p.id,
        dealerId: p.dealerId,
        haendlerName: dealerById.get(p.dealerId)!,
        name: p.name,
        beschreibung: p.beschreibung,
        // Navigation/Filter
        bereich: p.bereich,
        marke: p.marke,
        kategorie: p.kategorie,
        categoryId: p.categoryId,
        herkunftsland: p.herkunftsland,
        // Preis + Vertriebsweg
        preis: p.preis,
        preisHinweis: p.preisHinweis,
        bestellbar: p.bestellbar,
        affiliateUrl: p.affiliateUrl,
        inhaltMenge: p.inhaltMenge,
        // Versand
        versandKosten: p.versandKosten,
        versandHinweis: p.versandHinweis,
        lieferzeitTage: p.lieferzeitTage,
        // Bestand -> abgeleiteter Status (Rohbestand bleibt intern)
        bestandStatus: bestandStatus(p.bestand),
        // Signale/Merkmale
        istHighlight: p.istHighlight,
        hatSdb: !!p.sdbDatei,
        bewertungSchnitt: Number(p.bewertungSchnitt) || 0,
        bewertungAnzahl: p.bewertungAnzahl ?? 0,
        klicks: p.klicks,
        verkaufsAnzahl: verkauft,
        rankingScore,
        createdAt: p.createdAt,
        // Bilder: Primaerbild am Produkt + Galerie-Ids (Stream-URLs baut die Buy-Side)
        bildUrl: p.bildUrl,
        bilder: bilderByProduct.get(p.id) ?? [],
      };
    });

    sortiereKatalog(angereichert, sort);

    // Highlights: redaktionelle Pins UNION Top-Ranking (als Id-Liste - datensparsam,
    // die vollen Produktdaten stehen bereits in `produkte`). Das Frontend baut daraus
    // die Highlight-Sektion, unabhaengig von der gewaehlten Sortierung.
    const topRanking = [...angereichert]
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, HIGHLIGHTS_TOP_N)
      .map((p) => p.id);
    const highlights = [
      ...new Set([...angereichert.filter((p) => p.istHighlight).map((p) => p.id), ...topRanking]),
    ];

    return {
      produkte: angereichert,
      haendler: haendler.map((d) => ({
        id: d.id,
        name: d.name,
        beschreibung: d.beschreibung,
        logoUrl: d.logoUrl,
        webseite: d.webseite,
      })),
      kategorien,
      highlights,
    };
  }

  /**
   * Verkaufte Einheiten je Produkt (SUM der Positions-Mengen) in EINER
   * Aggregat-Abfrage. Fliesst als Ranking-Signal ein; leere Id-Liste -> leere Map
   * (kein DB-Zugriff). Bewusst ohne Storno-Join: ein weiches Ranking-Signal, das
   * kuratierte Volumen macht die Naeherung unkritisch.
   */
  private async verkaufszahlen(productIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) return map;
    const rows = await this.orderItemRepo
      .createQueryBuilder('i')
      .select('i.productId', 'productId')
      .addSelect('SUM(i.menge)', 'verkauft')
      .where('i.productId IN (:...ids)', { ids: productIds })
      .groupBy('i.productId')
      .getRawMany<{ productId: string; verkauft: string }>();
    for (const r of rows) map.set(r.productId, Number(r.verkauft) || 0);
    return map;
  }

  /**
   * Aktive Kategorie-Taxonomie hierarchisch (Hauptkategorien mit ihren
   * Unterkategorien), nur `aktiv=true`, je Ebene nach sortIndex. Datensparsam
   * (id, slug, name, bereich, parentId, sdbPflicht, sortIndex). Eine
   * inaktive Hauptkategorie nimmt ihre (dann verwaisten) Unterkategorien mit.
   */
  async categoryTree() {
    const kategorien = await this.categoryRepo.find({
      where: { aktiv: true },
      select: ['id', 'slug', 'name', 'bereich', 'parentId', 'sdbPflicht', 'sortIndex'],
      order: { sortIndex: 'ASC' },
    });
    const haupt = kategorien.filter((k) => k.parentId == null);
    const unterByParent = new Map<string, typeof kategorien>();
    for (const k of kategorien) {
      if (k.parentId == null) continue;
      const liste = unterByParent.get(k.parentId) ?? [];
      liste.push(k);
      unterByParent.set(k.parentId, liste);
    }
    const abbild = (k: (typeof kategorien)[number]) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      bereich: k.bereich,
      parentId: k.parentId,
      sdbPflicht: k.sdbPflicht,
      sortIndex: k.sortIndex,
    });
    return haupt.map((h) => ({
      ...abbild(h),
      unterkategorien: (unterByParent.get(h.id) ?? []).map(abbild),
    }));
  }

  /**
   * Produkt-Detail fuer die Shop-Detailseite: die VOLLEN Felder (inkl.
   * anwendungshinweise/technischeDaten) + Haendlername, Galerie-Bilder, ein
   * abgeleiteter bestandStatus/hatSdb und eine Bewertungs-Vorschau (neueste
   * aktive Reviews, ohne bewertenden Betrieb/Nutzer offenzulegen). Nur aktive
   * Produkte aktiver, freigegebener Haendler (sonst 404, kein Existenz-Orakel).
   *
   * `user` (aus dem JWT) steuert die Schreib-Sicht: `eigeneBewertung` (falls der
   * Betrieb schon bewertet hat) bzw. `kannBewerten` (hat gekauft UND noch nicht
   * bewertet) – damit das Frontend Formular/Bearbeiten/Hinweis passend zeigt.
   */
  async productDetail(productId: string, user?: AuthUser) {
    const p = await this.aktivesProdukt(productId);
    const dealer = await this.dealerRepo.findOne({
      where: { id: p.dealerId },
      select: ['id', 'name', 'beschreibung', 'logoUrl', 'webseite'],
    });
    const [bilder, reviews] = await Promise.all([
      this.upload.bilderFuerProdukte([p.id]),
      this.reviewRepo.find({
        where: { productId: p.id, aktiv: true },
        order: { createdAt: 'DESC' },
        take: REVIEW_VORSCHAU,
      }),
    ]);

    // Schreib-Sicht des aufrufenden Betriebs (tenantId/userId NIE vom Client):
    // hat er schon bewertet -> eigeneBewertung; sonst pruefen, ob er kaufen durfte.
    let kannBewerten = false;
    let eigeneBewertung: ReturnType<MarketplaceService['eigeneReviewAbbild']> | null = null;
    if (user?.tenantId) {
      const eigene = await this.reviewRepo.findOne({
        where: { productId: p.id, tenantId: user.tenantId },
      });
      if (eigene) {
        eigeneBewertung = this.eigeneReviewAbbild(eigene);
      } else {
        kannBewerten = await this.hatGekauft(p.id, user.tenantId);
      }
    }

    return {
      id: p.id,
      dealerId: p.dealerId,
      haendlerName: dealer?.name ?? '—',
      haendler: dealer
        ? {
            id: dealer.id,
            name: dealer.name,
            beschreibung: dealer.beschreibung,
            logoUrl: dealer.logoUrl,
            webseite: dealer.webseite,
          }
        : null,
      name: p.name,
      beschreibung: p.beschreibung,
      bereich: p.bereich,
      marke: p.marke,
      kategorie: p.kategorie,
      categoryId: p.categoryId,
      herkunftsland: p.herkunftsland,
      preis: p.preis,
      preisHinweis: p.preisHinweis,
      bestellbar: p.bestellbar,
      affiliateUrl: p.affiliateUrl,
      inhaltMenge: p.inhaltMenge,
      versandKosten: p.versandKosten,
      versandHinweis: p.versandHinweis,
      lieferzeitTage: p.lieferzeitTage,
      bestandStatus: bestandStatus(p.bestand),
      istHighlight: p.istHighlight,
      hatSdb: !!p.sdbDatei,
      bewertungSchnitt: Number(p.bewertungSchnitt) || 0,
      bewertungAnzahl: p.bewertungAnzahl ?? 0,
      klicks: p.klicks,
      // Schwere Detail-Felder (nur hier, nicht im Listen-Katalog):
      anwendungshinweise: p.anwendungshinweise,
      technischeDaten: p.technischeDaten,
      bildUrl: p.bildUrl,
      bilder: bilder.get(p.id) ?? [],
      // Bewertungs-Vorschau OHNE bewertenden Betrieb/Nutzer (keine Cross-Tenant-PII).
      bewertungen: reviews.map((r) => this.reviewVorschauAbbild(r)),
      // Schreib-Sicht (nur mit JWT befuellt): Formular / Bearbeiten / Hinweis.
      kannBewerten,
      eigeneBewertung,
    };
  }

  // ---------------------------------------------------------------------------
  // Bewertungen (Buy-Side): nur verifizierte Kaeufer, eine je Betrieb je Produkt
  // ---------------------------------------------------------------------------

  /**
   * Kauf-Nachweis: existiert eine Bestellposition dieses Produkts, deren
   * Bestellung dem BEWERTENDEN Betrieb (tenantId aus dem JWT) gehoert und NICHT
   * storniert ist? Nur dann darf bewertet werden (verifizierter Kauf).
   */
  private async hatGekauft(productId: string, tenantId: string): Promise<boolean> {
    const treffer = await this.orderItemRepo
      .createQueryBuilder('i')
      .innerJoin(MarketplaceOrder, 'o', 'o.id = i.orderId')
      .where('i.productId = :productId', { productId })
      .andWhere('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
      .getCount();
    return treffer > 0;
  }

  /** Kaeufer-Pflicht durchsetzen; Nicht-Kaeufer -> 403 (kein Existenz-Orakel). */
  private async assertKaeufer(productId: string, tenantId: string): Promise<void> {
    if (!(await this.hatGekauft(productId, tenantId))) {
      throw new ForbiddenException('Nur Käufer können bewerten.');
    }
  }

  /**
   * Denormalisiertes Aggregat am Produkt fortschreiben: Schnitt (gerundet) +
   * Anzahl der AKTIVEN Bewertungen. Quelle bleibt marketplace_reviews; das
   * Aggregat fliesst in Katalog-Anzeige + Ranking. Ohne aktive Bewertung -> 0/0.
   */
  private async aggregatFortschreiben(
    productId: string,
  ): Promise<{ bewertungSchnitt: number; bewertungAnzahl: number }> {
    const aktive = await this.reviewRepo.find({
      where: { productId, aktiv: true },
      select: ['sterne'],
    });
    const bewertungAnzahl = aktive.length;
    const summe = aktive.reduce((s, r) => s + Number(r.sterne), 0);
    const bewertungSchnitt = bewertungAnzahl === 0 ? 0 : rund2(summe / bewertungAnzahl);
    await this.productRepo.update(productId, { bewertungSchnitt, bewertungAnzahl });
    return { bewertungSchnitt, bewertungAnzahl };
  }

  /** Oeffentliche Vorschau-Form – OHNE bewertenden Betrieb/Nutzer (keine PII). */
  private reviewVorschauAbbild(r: MarketplaceReview) {
    return { sterne: r.sterne, text: r.text, verifiziert: r.verifiziert, createdAt: r.createdAt };
  }

  /** Eigene Bewertung (fuer den Autor): zusaetzlich aktiv (Moderationsstatus). */
  private eigeneReviewAbbild(r: MarketplaceReview) {
    return {
      sterne: r.sterne,
      text: r.text,
      verifiziert: r.verifiziert,
      aktiv: r.aktiv,
      createdAt: r.createdAt,
    };
  }

  /** Limit der Bewertungsliste robust klemmen (Default 20, Max 50). */
  private clampReviewLimit(v?: string | number): number {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) return REVIEW_LIST_LIMIT_DEFAULT;
    return Math.min(n, REVIEW_LIST_LIMIT_MAX);
  }

  /** Offset der Bewertungsliste robust klemmen (Default 0). */
  private clampReviewOffset(v?: string | number): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Oeffentliche Bewertungsliste eines Produkts: nur `aktiv=true`, paginiert,
   * neueste zuerst, mit "Verifizierter Kauf"-Flag und OHNE bewertenden
   * Betrieb/Nutzer (keine Cross-Tenant-PII). Produkt muss sichtbar sein (404).
   */
  async listReviews(productId: string, limit?: string | number, offset?: string | number) {
    await this.aktivesProdukt(productId);
    const take = this.clampReviewLimit(limit);
    const skip = this.clampReviewOffset(offset);
    const [rows, total] = await this.reviewRepo.findAndCount({
      where: { productId, aktiv: true },
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return {
      total,
      limit: take,
      offset: skip,
      bewertungen: rows.map((r) => this.reviewVorschauAbbild(r)),
    };
  }

  /**
   * Bewertung anlegen. Voraussetzungen: sichtbares Produkt (404 sonst) UND
   * nachgewiesener Kauf (403 sonst). Genau EINE Bewertung je Betrieb je Produkt:
   * existiert bereits eine -> 409 (Nachbesserung laeuft ueber updateReview/PUT).
   * tenantId/userId kommen aus dem JWT, `verifiziert=true` (Kauf-Nachweis).
   */
  async createReview(user: AuthUser, productId: string, dto: CreateReviewDto) {
    const product = await this.aktivesProdukt(productId);
    await this.assertKaeufer(product.id, user.tenantId);
    const existing = await this.reviewRepo.findOne({
      where: { productId: product.id, tenantId: user.tenantId },
    });
    if (existing) {
      throw new ConflictException('Sie haben dieses Produkt bereits bewertet.');
    }
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        productId: product.id,
        tenantId: user.tenantId,
        userId: user.id,
        sterne: dto.sterne,
        text: dto.text?.trim() || null,
        verifiziert: true,
        aktiv: true,
      }),
    );
    const aggregat = await this.aggregatFortschreiben(product.id);
    return { ...this.eigeneReviewAbbild(review), ...aggregat };
  }

  /**
   * Eigene Bewertung aendern (Upsert-Semantik): existiert eine -> aktualisieren;
   * existiert keine -> anlegen (dann greift ebenfalls die Kaeufer-Pflicht). Der
   * Kauf-Nachweis (`verifiziert`) und der urspruengliche Autor bleiben erhalten.
   */
  async updateReview(user: AuthUser, productId: string, dto: CreateReviewDto) {
    const product = await this.aktivesProdukt(productId);
    let review = await this.reviewRepo.findOne({
      where: { productId: product.id, tenantId: user.tenantId },
    });
    if (review) {
      review.sterne = dto.sterne;
      review.text = dto.text?.trim() || null;
    } else {
      await this.assertKaeufer(product.id, user.tenantId);
      review = this.reviewRepo.create({
        productId: product.id,
        tenantId: user.tenantId,
        userId: user.id,
        sterne: dto.sterne,
        text: dto.text?.trim() || null,
        verifiziert: true,
        aktiv: true,
      });
    }
    const saved = await this.reviewRepo.save(review);
    const aggregat = await this.aggregatFortschreiben(product.id);
    return { ...this.eigeneReviewAbbild(saved), ...aggregat };
  }

  /**
   * Eigene Bewertung loeschen (strikt auf den eigenen Betrieb gescoped; fremde
   * -> 404, kein Orakel). Danach das Aggregat neu berechnen.
   */
  async deleteReview(user: AuthUser, productId: string) {
    const review = await this.reviewRepo.findOne({
      where: { productId, tenantId: user.tenantId },
    });
    if (!review) throw new NotFoundException('Bewertung nicht gefunden');
    await this.reviewRepo.remove(review);
    const aggregat = await this.aggregatFortschreiben(productId);
    return { ok: true as const, ...aggregat };
  }

  /**
   * Klick auf "Zum Haendler": zaehlt (Einzelklick + atomarer Zaehler) und gibt
   * den Affiliate-Link zurueck – die URL kommt vom Server, nie vom Client.
   */
  async klick(user: AuthUser, productId: string): Promise<{ affiliateUrl: string }> {
    const product = await this.productRepo.findOne({ where: { id: productId, aktiv: true } });
    // Bestellbare Produkte ohne Affiliate-Link haben keinen "Zum Haendler"-Weg.
    if (!product || !product.affiliateUrl) throw new NotFoundException('Produkt nicht gefunden');
    await Promise.all([
      this.clickRepo.save(
        this.clickRepo.create({
          productId: product.id,
          dealerId: product.dealerId,
          tenantId: user.tenantId,
        }),
      ),
      this.productRepo.increment({ id: product.id }, 'klicks', 1),
    ]);
    return { affiliateUrl: product.affiliateUrl };
  }

  // ---------------------------------------------------------------------------
  // In-App-Bestellungen (Betrieb)
  // ---------------------------------------------------------------------------

  /**
   * Bestellung aus dem Warenkorb. Der Korb wird JE HAENDLER in eigene
   * Bestellungen aufgeteilt (jeder Haendler wickelt eigenstaendig ab). Preise
   * und Provisionssatz kommen ausschliesslich vom Server (Snapshot) - der
   * Client liefert nur productId + menge.
   */
  async createOrders(user: AuthUser, dto: CreateMarketplaceOrderDto): Promise<MarketplaceOrder[]> {
    // Doppelte Positionen desselben Produkts zusammenfassen.
    const mengeByProduct = new Map<string, number>();
    for (const p of dto.positionen) {
      mengeByProduct.set(p.productId, (mengeByProduct.get(p.productId) ?? 0) + p.menge);
    }

    const produkte = await this.productRepo.find({
      where: { id: In([...mengeByProduct.keys()]), aktiv: true, bestellbar: true },
    });
    if (produkte.length !== mengeByProduct.size) {
      throw new BadRequestException('Mindestens ein Produkt ist nicht (mehr) bestellbar.');
    }
    const ohnePreis = produkte.find((p) => p.preis == null);
    if (ohnePreis) {
      throw new BadRequestException(`"${ohnePreis.name}" hat keinen festen Preis und ist nicht direkt bestellbar.`);
    }

    const dealerIds = [...new Set(produkte.map((p) => p.dealerId))];
    const dealers = await this.dealerRepo.find({
      where: { id: In(dealerIds), aktiv: true, status: 'freigegeben' },
    });
    if (dealers.length !== dealerIds.length) {
      throw new BadRequestException('Mindestens ein Haendler ist nicht mehr aktiv.');
    }
    const dealerById = new Map(dealers.map((d) => [d.id, d]));

    // Kontakt-/Lieferdaten-Snapshot, identisch fuer alle Teil-Bestellungen.
    const snapshot = {
      tenantId: user.tenantId,
      createdByUserId: user.id,
      kontaktName: dto.kontaktName.trim(),
      kontaktEmail: dto.kontaktEmail.trim(),
      kontaktTelefon: dto.kontaktTelefon?.trim() || null,
      lieferFirma: dto.lieferFirma?.trim() || null,
      lieferStrasse: dto.lieferStrasse?.trim() || null,
      lieferPlz: dto.lieferPlz?.trim() || null,
      lieferOrt: dto.lieferOrt?.trim() || null,
      lieferLand: dto.lieferLand?.trim() || 'DE',
      notiz: dto.notiz?.trim() || null,
    };

    // B5: Der Nummernkreis MP-<Jahr>-<lfd> liegt auf einem GLOBALEN UNIQUE-Index.
    // Ohne withUniqueRetry crashen parallele Bestellungen am Index (500, Bestellung
    // verloren). Retry umschliesst die GESAMTE Transaktion (mehrere Teil-Belege je
    // Haendler), sodass bei Kollision der komplette Nummernblock neu gezogen wird.
    const orders = await withUniqueRetry(() =>
      this.dataSource.transaction(async (em) => {
      const orderRepo = em.getRepository(MarketplaceOrder);
      const itemRepo = em.getRepository(MarketplaceOrderItem);
      const jahr = new Date().getFullYear();
      // Plattformweiter Nummernkreis MP-<Jahr>-<lfd>, PRO JAHR gezaehlt (Jahres-Reset).
      let lfd = await orderRepo.count({ where: { nummer: Like(`MP-${jahr}-%`) } });

      const ergebnis: MarketplaceOrder[] = [];
      for (const dealerId of dealerIds) {
        const dealer = dealerById.get(dealerId)!;
        const dealerProdukte = produkte.filter((p) => p.dealerId === dealerId);

        let summeBrutto = 0;
        let summeProvision = 0;
        const items = dealerProdukte.map((p) => {
          const menge = mengeByProduct.get(p.id)!;
          const zeilenSumme = rund2(Number(p.preis) * menge);
          const provisionBetrag = rund2((zeilenSumme * Number(dealer.provisionSatz)) / 100);
          summeBrutto = rund2(summeBrutto + zeilenSumme);
          summeProvision = rund2(summeProvision + provisionBetrag);
          return itemRepo.create({
            dealerId,
            productId: p.id,
            produktName: p.name,
            einzelpreis: Number(p.preis),
            menge,
            zeilenSumme,
            provisionSatz: Number(dealer.provisionSatz),
            provisionBetrag,
          });
        });

        lfd += 1;
        const order = await orderRepo.save(
          orderRepo.create({
            ...snapshot,
            nummer: `MP-${jahr}-${String(lfd).padStart(4, '0')}`,
            dealerId,
            status: MarketplaceOrderStatus.EINGEGANGEN,
            summeBrutto,
            summeProvision,
          }),
        );
        for (const item of items) item.orderId = order.id;
        await itemRepo.save(items);
        ergebnis.push(order);
      }
      return ergebnis;
      }),
    );

    // Haendler benachrichtigen - fire-and-forget, Bestellung haengt NIE an SMTP.
    for (const order of orders) {
      const dealer = dealerById.get(order.dealerId);
      if (!dealer?.kontaktEmail) continue;
      void this.mail
        .send({
          to: dealer.kontaktEmail,
          subject: `Neue Marktplatz-Bestellung ${order.nummer}`,
          text:
            `Hallo ${dealer.name},\n\n` +
            `ueber den Detailly-Marktplatz ist die Bestellung ${order.nummer} eingegangen ` +
            `(Summe ${Number(order.summeBrutto).toFixed(2)} EUR).\n` +
            `Details und Abwicklung in eurem Haendler-Portal.`,
        })
        .catch((err) => this.logger.warn(`Bestell-Mail fehlgeschlagen: ${err?.message ?? err}`));
    }

    return this.ordersMitPositionen(orders.map((o) => o.id));
  }

  /** Bestellungen des eigenen Betriebs (inkl. Positionen + Haendlername). */
  async listOrdersForTenant(tenantId: string) {
    const orders = await this.orderRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return this.anreichern(orders);
  }

  /** Bestellungen (per Id) inkl. Positionen + Haendlername nachladen. */
  private async ordersMitPositionen(ids: string[]) {
    if (ids.length === 0) return [];
    const orders = await this.orderRepo.find({ where: { id: In(ids) } });
    return this.anreichern(orders);
  }

  /** Positionen + Haendlernamen an eine Bestell-Liste haengen. */
  private async anreichern(orders: MarketplaceOrder[]) {
    if (orders.length === 0) return [];
    const [items, dealers] = await Promise.all([
      this.orderItemRepo.find({ where: { orderId: In(orders.map((o) => o.id)) } }),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return orders.map((o) => ({
      ...o,
      haendlerName: nameById.get(o.dealerId) ?? '—',
      positionen: items.filter((i) => i.orderId === o.id),
    }));
  }

  // ---------------------------------------------------------------------------
  // Haendler-Portal – zwei Zugangswege, EINE Logik
  // ---------------------------------------------------------------------------
  // (1) Capability-Token in der URL (Bestandshaendler, kein Login) und
  // (2) authentifiziertes Login-Konto (role=haendler, dealerId aus dem JWT).
  // Beide Wege loesen zuerst den Dealer auf und rufen dann DIESELBEN dealer-
  // basierten Kernmethoden – so ist die Scoping-Logik nur EINMAL vorhanden.
  // ---------------------------------------------------------------------------

  /**
   * Haendler per Portal-Token aufloesen. Format-Check VOR dem DB-Zugriff
   * (Anti-Enumeration, wie Freigabe-/Kalender-Token); unbekannt -> 404 ohne
   * Hinweis, ob der Token je existierte.
   */
  private async dealerByToken(token: string): Promise<MarketplaceDealer> {
    const clean = (token ?? '').trim().toLowerCase();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) throw new NotFoundException('Portal nicht gefunden');
    const dealer = await this.dealerRepo.findOne({
      where: { uploadToken: clean, aktiv: true, status: 'freigegeben' },
    });
    if (!dealer) throw new NotFoundException('Portal nicht gefunden');
    return dealer;
  }

  /**
   * Haendler per (authentifizierter) dealerId aufloesen. Die Id kommt IMMER aus
   * dem JWT (JwtStrategy) – NIE aus dem Client. Nur aktiv+freigegebene Dealer
   * bekommen Portal-Zugang; unbekannt/gesperrt -> 404 (kein Existenz-Orakel).
   */
  private async dealerByIdScoped(dealerId: string | undefined): Promise<MarketplaceDealer> {
    if (!dealerId) throw new NotFoundException('Portal nicht gefunden');
    const dealer = await this.dealerRepo.findOne({
      where: { id: dealerId, aktiv: true, status: 'freigegeben' },
    });
    if (!dealer) throw new NotFoundException('Portal nicht gefunden');
    return dealer;
  }

  // --- Kernlogik: strikt auf den bereits aufgeloesten Dealer gescoped ---------

  /** Portal-Startseite: Haendler-Profil + eigene Produkte + eigene Bestellungen. */
  private async overviewForDealer(dealer: MarketplaceDealer) {
    const [produkte, orders] = await Promise.all([
      this.productRepo.find({ where: { dealerId: dealer.id }, order: { createdAt: 'DESC' } }),
      this.orderRepo.find({
        where: { dealerId: dealer.id },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
    ]);
    const items = orders.length
      ? await this.orderItemRepo.find({ where: { orderId: In(orders.map((o) => o.id)) } })
      : [];
    // Galerie-Bild-Ids je Produkt, damit das Portal Bilder anzeigen/loeschen kann.
    const bilderByProduct = await this.upload.bilderFuerProdukte(produkte.map((p) => p.id));
    return {
      haendler: {
        id: dealer.id,
        name: dealer.name,
        logoUrl: dealer.logoUrl,
        provisionSatz: dealer.provisionSatz,
      },
      produkte: produkte.map((p) => ({ ...p, bilder: bilderByProduct.get(p.id) ?? [] })),
      bestellungen: orders.map((o) => ({
        ...o,
        positionen: items.filter((i) => i.orderId === o.id),
      })),
    };
  }

  /** Haendler legt ein eigenes Produkt an (dealerId kommt aus dem aufgeloesten Dealer). */
  private async createProductForDealer(
    dealer: MarketplaceDealer,
    dto: PortalProductDto,
  ): Promise<MarketplaceProduct> {
    this.assertVertriebsweg(dto);
    return this.productRepo.save(this.productRepo.create({ ...dto, dealerId: dealer.id }));
  }

  /** Haendler bearbeitet ein EIGENES Produkt (fremde -> 404, kein Orakel). */
  private async updateProductForDealer(
    dealer: MarketplaceDealer,
    productId: string,
    dto: UpdatePortalProductDto,
  ): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({
      where: { id: productId, dealerId: dealer.id },
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    Object.assign(product, dto);
    this.assertVertriebsweg(product);
    return this.productRepo.save(product);
  }

  /**
   * Haendler setzt den Status einer EIGENEN Bestellung. Erlaubte Uebergaenge
   * (kein Zuruecksetzen, kein Ent-Stornieren):
   * eingegangen -> bestaetigt|storniert; bestaetigt -> versendet|storniert.
   */
  private async setOrderStatusForDealer(
    dealer: MarketplaceDealer,
    orderId: string,
    status: MarketplaceOrderStatus,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId, dealerId: dealer.id } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');

    const erlaubt: Record<MarketplaceOrderStatus, MarketplaceOrderStatus[]> = {
      [MarketplaceOrderStatus.EINGEGANGEN]: [
        MarketplaceOrderStatus.BESTAETIGT,
        MarketplaceOrderStatus.STORNIERT,
      ],
      [MarketplaceOrderStatus.BESTAETIGT]: [
        MarketplaceOrderStatus.VERSENDET,
        MarketplaceOrderStatus.STORNIERT,
      ],
      [MarketplaceOrderStatus.VERSENDET]: [],
      [MarketplaceOrderStatus.STORNIERT]: [],
    };
    if (!erlaubt[order.status].includes(status)) {
      throw new BadRequestException(`Statuswechsel ${order.status} -> ${status} ist nicht erlaubt.`);
    }
    order.status = status;
    await this.orderRepo.save(order);
    return order;
  }

  /** Mindestens ein Vertriebsweg: bestellbar (mit Preis) ODER Affiliate-Link. */
  private assertVertriebsweg(p: { bestellbar?: boolean; preis?: number; affiliateUrl?: string }) {
    if (p.bestellbar && p.preis == null) {
      throw new BadRequestException('Bestellbare Produkte brauchen einen festen Preis.');
    }
    if (!p.bestellbar && !p.affiliateUrl) {
      throw new BadRequestException(
        'Produkt braucht einen Vertriebsweg: "bestellbar" (mit Preis) oder einen Affiliate-Link.',
      );
    }
  }

  // --- Zugangsweg (1): Capability-Token (Bestandshaendler, kein Login) --------

  /** Portal-Uebersicht per Token. */
  async portalOverview(token: string) {
    return this.overviewForDealer(await this.dealerByToken(token));
  }

  /** Produkt anlegen per Token. */
  async portalCreateProduct(token: string, dto: PortalProductDto): Promise<MarketplaceProduct> {
    return this.createProductForDealer(await this.dealerByToken(token), dto);
  }

  /** Eigenes Produkt bearbeiten per Token. */
  async portalUpdateProduct(
    token: string,
    productId: string,
    dto: UpdatePortalProductDto,
  ): Promise<MarketplaceProduct> {
    return this.updateProductForDealer(await this.dealerByToken(token), productId, dto);
  }

  /** Bestellstatus einer eigenen Bestellung setzen per Token. */
  async portalSetOrderStatus(token: string, orderId: string, status: MarketplaceOrderStatus) {
    return this.setOrderStatusForDealer(await this.dealerByToken(token), orderId, status);
  }

  // --- Zugangsweg (2): authentifiziertes Login-Konto (dealerId aus dem JWT) ---

  /** Portal-Uebersicht fuer den eingeloggten Haendler. */
  async portalOverviewById(dealerId: string | undefined) {
    return this.overviewForDealer(await this.dealerByIdScoped(dealerId));
  }

  /** Produkt anlegen als eingeloggter Haendler. */
  async portalCreateProductById(
    dealerId: string | undefined,
    dto: PortalProductDto,
  ): Promise<MarketplaceProduct> {
    return this.createProductForDealer(await this.dealerByIdScoped(dealerId), dto);
  }

  /** Eigenes Produkt bearbeiten als eingeloggter Haendler. */
  async portalUpdateProductById(
    dealerId: string | undefined,
    productId: string,
    dto: UpdatePortalProductDto,
  ): Promise<MarketplaceProduct> {
    return this.updateProductForDealer(await this.dealerByIdScoped(dealerId), productId, dto);
  }

  /** Bestellstatus einer eigenen Bestellung setzen als eingeloggter Haendler. */
  async portalSetOrderStatusById(
    dealerId: string | undefined,
    orderId: string,
    status: MarketplaceOrderStatus,
  ) {
    return this.setOrderStatusForDealer(await this.dealerByIdScoped(dealerId), orderId, status);
  }

  // ---------------------------------------------------------------------------
  // Uploads (PR3): Galerie-Bilder + SDB – beide Zugangswege, EIN Datei-Worker
  // ---------------------------------------------------------------------------
  // Der Dealer wird wie ueberall zuerst aufgeloest (Token bzw. JWT-dealerId), dann
  // scopet der MarketplaceUploadService das Produkt hart auf `{ id, dealerId }`
  // (fremdes Produkt -> 404). Die Datei-Logik liegt NUR im Upload-Service.

  // --- Bilder (dealer-seitig) -------------------------------------------------

  async portalBilderUpload(token: string, productId: string, dateien: HochgeladenesDokument[]) {
    const dealer = await this.dealerByToken(token);
    return this.upload.bilderHochladen(dealer.id, productId, dateien);
  }

  async portalBilderUploadById(
    dealerId: string | undefined,
    productId: string,
    dateien: HochgeladenesDokument[],
  ) {
    const dealer = await this.dealerByIdScoped(dealerId);
    return this.upload.bilderHochladen(dealer.id, productId, dateien);
  }

  async portalBildLoeschen(token: string, productId: string, imageId: string) {
    const dealer = await this.dealerByToken(token);
    return this.upload.bildLoeschen(dealer.id, productId, imageId);
  }

  async portalBildLoeschenById(dealerId: string | undefined, productId: string, imageId: string) {
    const dealer = await this.dealerByIdScoped(dealerId);
    return this.upload.bildLoeschen(dealer.id, productId, imageId);
  }

  async portalBildAnzeigen(token: string, productId: string, imageId: string) {
    const dealer = await this.dealerByToken(token);
    return this.upload.bildAnzeigenFuerDealer(dealer.id, productId, imageId);
  }

  async portalBildAnzeigenById(dealerId: string | undefined, productId: string, imageId: string) {
    const dealer = await this.dealerByIdScoped(dealerId);
    return this.upload.bildAnzeigenFuerDealer(dealer.id, productId, imageId);
  }

  // --- SDB (dealer-seitig) ----------------------------------------------------

  async portalSdbUpload(token: string, productId: string, datei?: HochgeladenesDokument) {
    const dealer = await this.dealerByToken(token);
    return this.upload.sdbHochladen(dealer.id, productId, datei);
  }

  async portalSdbUploadById(
    dealerId: string | undefined,
    productId: string,
    datei?: HochgeladenesDokument,
  ) {
    const dealer = await this.dealerByIdScoped(dealerId);
    return this.upload.sdbHochladen(dealer.id, productId, datei);
  }

  async portalSdbAnzeigen(token: string, productId: string) {
    const dealer = await this.dealerByToken(token);
    return this.upload.sdbAnzeigenFuerDealer(dealer.id, productId);
  }

  async portalSdbAnzeigenById(dealerId: string | undefined, productId: string) {
    const dealer = await this.dealerByIdScoped(dealerId);
    return this.upload.sdbAnzeigenFuerDealer(dealer.id, productId);
  }

  // --- Buy-Side (jeder eingeloggte Tenant, nur AKTIVE Produkte aktiver Haendler)

  /**
   * Loest ein Produkt fuer die Buy-Side auf: es muss aktiv sein UND zu einem
   * aktiven, freigegebenen Haendler gehoeren (gleiche Sichtbarkeit wie der
   * Katalog). Sonst 404 – kein Existenz-Orakel.
   */
  private async aktivesProdukt(productId: string): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({ where: { id: productId, aktiv: true } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    const dealer = await this.dealerRepo.findOne({
      where: { id: product.dealerId, aktiv: true, status: 'freigegeben' },
    });
    if (!dealer) throw new NotFoundException('Produkt nicht gefunden');
    return product;
  }

  /** Buy-Side: Galerie-Bild eines aktiven Produkts streamen. */
  async bildAnzeigenAktiv(productId: string, imageId: string) {
    return this.upload.bildStream(await this.aktivesProdukt(productId), imageId);
  }

  /** Buy-Side: SDB eines aktiven Produkts entschluesselt laden (fehlt -> 404). */
  async sdbAnzeigenAktiv(productId: string) {
    return this.upload.sdbLaden(await this.aktivesProdukt(productId));
  }

  // ---------------------------------------------------------------------------
  // Grosshaendler-Bewerbung (oeffentlich) + Betreiber-Review (Welle 3)
  // ---------------------------------------------------------------------------

  /**
   * Nimmt eine oeffentliche Grosshaendler-Bewerbung entgegen. Es entsteht ein
   * Dealer mit status='beantragt' + aktiv=false und OHNE Portal-Token - erst
   * die Betreiber-Freigabe schaltet frei (KEINE Selbst-Freischaltung). Es wird
   * bewusst KEINE Mail automatisch verschickt (Review-before-send). Antwortet
   * ohne Echo der Eingaben.
   *
   * Welle 5 (KYB): Die Gewerbeanmeldung ist PFLICHT. Sie wird VOR dem Speichern
   * geprueft (Magic-Byte/Groesse) und verschluesselt abgelegt; sha256 + Pfad landen
   * am Dealer. Die assistierte Vorpruefung laeuft danach FIRE-AND-FORGET (die
   * Antwort an den Bewerber haengt nie am 60s-Vision-Call).
   */
  async createBewerbung(
    dto: HaendlerBewerbungDto,
    dokument?: HochgeladenesDokument,
  ): Promise<{ ok: true }> {
    // Honeypot: gefuellt => Bot. Erfolg vortaeuschen, NICHTS speichern (auch keine
    // Datei) - gleiches Muster wie die Online-Terminanfrage.
    if (dto.website && dto.website.trim().length > 0) return { ok: true };

    const email = dto.kontaktEmail.trim().toLowerCase();

    // Doppel-Bewerbungs-Guard ZUERST (vor dem Datei-Write): dieselbe E-Mail mit
    // OFFENEM Antrag -> 409, ohne verwaiste Dokument-Datei auf der Platte.
    const offen = await this.dealerRepo.findOne({
      where: { kontaktEmail: email, status: 'beantragt' },
    });
    if (offen) {
      throw new ConflictException(
        'Für diese E-Mail-Adresse liegt bereits eine Bewerbung vor. Wir melden uns, sobald sie geprüft ist.',
      );
    }

    // Dokument pruefen + verschluesselt ablegen (wirft 400 bei fehlend/zu gross/
    // falschem Typ). Ohne gueltiges Dokument entsteht KEINE Bewerbung.
    const { pfad, hash } = await this.kyb.speichereDokument(dokument);

    // Sortiment auf die festen Marktplatz-Bereiche eindampfen (kein Freitext).
    const sortiment = (dto.sortiment ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => MARKTPLATZ_BEREICHE.includes(s));

    const saved = await this.dealerRepo.save(
      this.dealerRepo.create({
        name: dto.name.trim(),
        ansprechpartner: dto.ansprechpartner.trim(),
        kontaktEmail: email,
        ustIdNr: dto.ustIdNr.trim(),
        telefon: dto.telefon?.trim() || undefined,
        webseite: dto.webseite?.trim() || undefined,
        adresse: dto.adresse?.trim() || undefined,
        sortiment: sortiment.length ? sortiment.join(',') : undefined,
        nachricht: dto.nachricht?.trim() || undefined,
        gewerbeanmeldungDatei: pfad,
        dokumentHash: hash,
        status: 'beantragt',
        aktiv: false,
        beantragtAm: new Date(),
        // KEIN uploadToken - der entsteht erst bei der Freigabe.
      }),
    );

    // Assistierte Vorpruefung im Hintergrund (Ampel + Abweichungen). Fehler werden
    // im Service abgefangen; die Bewerbung ist bereits erfolgreich gespeichert.
    void this.kyb.pruefeBewerbung(saved.id);

    return { ok: true };
  }

  /**
   * Laedt + entschluesselt die Gewerbeanmeldung eines Dealers fuer die
   * guard-geschuetzte Review-Vorschau (nur Plattform-Rollen, s. Controller).
   */
  async dokumentAnzeigen(id: string): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer || !dealer.gewerbeanmeldungDatei) {
      throw new NotFoundException('Kein Dokument vorhanden');
    }
    return this.kyb.ladeDokument(dealer.gewerbeanmeldungDatei);
  }

  /** Ist der Plattform-SMTP konfiguriert? (Gleiche Bedingung wie MailService-Transporter.) */
  private mailKonfiguriert(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  /** Basis-URL fuer Links nach draussen (gleiches Muster wie BookingRequestsService). */
  private appBaseUrl(): string {
    const url =
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    return url.replace(/\/$/, '');
  }

  // ---------------------------------------------------------------------------
  // Haendler-Login-Onboarding (PR2): bei der Freigabe ein echtes Konto anlegen
  // ---------------------------------------------------------------------------

  /** E-Mail wie ueberall normalisieren (trim + lowercase); leer -> null. */
  private normEmail(e?: string | null): string | null {
    const v = (e ?? '').trim().toLowerCase();
    return v || null;
  }

  /**
   * Kollisions-Check VOR jeder Freigabe-Mutation: existiert bereits ein User mit
   * der Kontakt-Adresse des Haendlers, der NICHT genau das Konto DIESES Haendlers
   * ist (z. B. ein Betriebs-/Plattform-User oder ein anderer Haendler), bricht die
   * Freigabe mit einem klaren 409 ab. Der idempotente Fall (schon das Haendler-
   * Konto dieses Dealers) ist erlaubt (erneute Freigabe / Token-Rotation).
   */
  private async assertHaendlerEmailFrei(dealer: MarketplaceDealer): Promise<void> {
    const email = this.normEmail(dealer.kontaktEmail);
    if (!email) return; // ohne Kontakt-E-Mail entsteht kein Login-Konto (Token-Portal bleibt)
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing && !(existing.role === UserRole.HAENDLER && existing.dealerId === dealer.id)) {
      throw new ConflictException('E-Mail bereits vergeben');
    }
  }

  /**
   * Legt (idempotent) das Haendler-Login-Konto an: role=haendler, tenantId NULL,
   * dealerId gesetzt, Zufalls-Passwort (nie kommuniziert). Danach die
   * "Passwort setzen"-Einladung ueber den BESTEHENDEN Reset-Flow – fire-and-forget
   * (die Freigabe haengt nie am SMTP; das Konto ist der kritische Teil). Existiert
   * bereits ein Konto (idempotent oder – theoretisch – Kollision, die schon in
   * assertHaendlerEmailFrei abgefangen wurde), passiert nichts.
   */
  private async onboardHaendlerUser(dealer: MarketplaceDealer): Promise<void> {
    const email = this.normEmail(dealer.kontaktEmail);
    if (!email) return;
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) return;

    const passwordHash = await this.auth.hashPassword(crypto.randomBytes(24).toString('hex'));
    await this.userRepo.save(
      this.userRepo.create({
        email,
        passwordHash,
        firstName: dealer.ansprechpartner?.trim() || dealer.name,
        lastName: dealer.name,
        role: UserRole.HAENDLER,
        dealerId: dealer.id,
        tenantId: null as unknown as string,
        isActive: true,
      }),
    );
    // Einladung ueber den Reset-Flow (Review-before-send: vom Betreiber im
    // Freigabe-Vorgang ausgeloest). Fehler nur loggen – das Konto besteht bereits.
    void this.auth
      .requestPasswordReset(email)
      .catch((e) => this.logger.warn(`Haendler-Einladung fehlgeschlagen: ${(e as Error)?.message ?? e}`));
  }

  /**
   * Betreiber gibt eine Bewerbung frei: status='freigegeben' + aktiv, Provision
   * (im Review anpassbar, sonst bleibt der gespeicherte Satz/Default 10) und ein
   * frischer Portal-Token. Der Rohwert des Tokens wird NUR hier zurueckgegeben.
   * `mailKonfiguriert` sagt dem Frontend, ob "Link per Mail senden" moeglich ist
   * (sonst Link-Kopier-Dialog).
   */
  async freigeben(
    id: string,
    provisionSatz?: number,
    geprueftVonUserId?: string,
  ): Promise<{
    haendler: { id: string; name: string; kontaktEmail: string | null; provisionSatz: number };
    uploadToken: string;
    portalPfad: string;
    mailKonfiguriert: boolean;
  }> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');

    // KYB-Gate (Welle 5): eine BEWORBENE Freigabe setzt eine gesichtete
    // Gewerbeanmeldung voraus. Direkt (vom Betreiber) angelegte Haendler sind nie
    // 'beantragt' und daher nicht betroffen.
    if (dealer.status === 'beantragt' && !dealer.gewerbeanmeldungDatei) {
      throw new BadRequestException('Freigabe erst nach Upload der Gewerbeanmeldung möglich.');
    }

    // E-Mail-Kollision VOR jeder Mutation pruefen: gehoert die Kontakt-Adresse
    // bereits einem Betriebs-/Plattform-User (oder einem anderen Haendler), wird
    // gar nichts freigegeben (sauberer Abbruch, kein Halb-Zustand).
    await this.assertHaendlerEmailFrei(dealer);

    const token = crypto.randomBytes(24).toString('hex'); // 192 Bit, passt zum Format-Check
    dealer.status = 'freigegeben';
    dealer.aktiv = true;
    if (provisionSatz != null) dealer.provisionSatz = provisionSatz;
    if (geprueftVonUserId) dealer.kybGeprueftVonUserId = geprueftVonUserId;
    await this.dealerRepo.save(dealer);
    // Token separat per update (Spalte ist select:false - save() wuerde sie nicht anfassen).
    await this.dealerRepo.update(dealer.id, { uploadToken: token });

    // Login-Konto (role=haendler, tenantId null, dealerId gesetzt) anlegen und die
    // Passwort-setzen-Einladung ueber den bestehenden Reset-Flow ausloesen. Der
    // Token-Zugang oben bleibt zusaetzlich bestehen (Rueckwaerts-Kompatibilitaet).
    await this.onboardHaendlerUser(dealer);

    return {
      haendler: {
        id: dealer.id,
        name: dealer.name,
        kontaktEmail: dealer.kontaktEmail ?? null,
        provisionSatz: Number(dealer.provisionSatz),
      },
      uploadToken: token,
      portalPfad: `/haendler?t=${token}`,
      mailKonfiguriert: this.mailKonfiguriert(),
    };
  }

  /**
   * Betreiber lehnt eine Bewerbung ab. DSGVO/PII-Sparsamkeit: eine abgelehnte
   * Bewerbung begruendet keine Geschaeftsbeziehung -> nachricht + adresse werden
   * SOFORT genullt (Muster: BookingRequestsService.reject). Name/E-Mail bleiben
   * fuer den Doppel-Bewerbungs-Kontext des Betreibers stehen; ein evtl.
   * vorhandener Token wird entzogen.
   */
  async ablehnen(id: string, geprueftVonUserId?: string): Promise<MarketplaceDealer> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    dealer.status = 'abgelehnt';
    dealer.aktiv = false;
    dealer.nachricht = null as unknown as string;
    dealer.adresse = null as unknown as string;
    // KYB (Welle 5): Ablehnungs-Uhr fuer die 90-Tage-Dokument-Retention setzen und
    // den bescheidenden Plattform-Mitarbeiter festhalten. Das Dokument bleibt bis
    // zur Retention erhalten (Beleg-/Beweisinteresse in der Widerspruchsfrist).
    dealer.abgelehntAm = new Date();
    if (geprueftVonUserId) dealer.kybGeprueftVonUserId = geprueftVonUserId;
    const saved = await this.dealerRepo.save(dealer);
    await this.dealerRepo.update(dealer.id, { uploadToken: null as unknown as string });
    return saved;
  }

  /**
   * Verschickt den Portal-Link an die Kontakt-Adresse des Haendlers - IMMER nur
   * als vom Betreiber BESTAETIGTE Aktion (Review-before-send; der Aufruf kommt
   * ausschliesslich aus dem Freigabe-Dialog). Ohne SMTP -> klarer 400, das
   * Frontend zeigt dann den Link-Kopier-Dialog.
   */
  async sendPortalLinkMail(id: string): Promise<{ ok: true; to: string }> {
    if (!this.mailKonfiguriert()) {
      throw new BadRequestException(
        'Kein Mail-Versand konfiguriert (SMTP). Bitte den Link kopieren und manuell übermitteln.',
      );
    }
    // Token mitladen (select:false) - der Link wird SERVERSEITIG gebaut, nie vom Client geliefert.
    const dealer = await this.dealerRepo
      .createQueryBuilder('d')
      .addSelect('d.uploadToken')
      .where('d.id = :id', { id })
      .getOne();
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    if (!dealer.uploadToken || dealer.status !== 'freigegeben' || !dealer.aktiv) {
      throw new BadRequestException('Der Händler ist nicht freigegeben oder hat keinen Portal-Link.');
    }
    const to = dealer.kontaktEmail?.trim();
    if (!to) throw new BadRequestException('Der Händler hat keine Kontakt-E-Mail hinterlegt.');

    const link = `${this.appBaseUrl()}/haendler?t=${dealer.uploadToken}`;
    const anrede = dealer.ansprechpartner?.trim()
      ? `Hallo ${dealer.ansprechpartner.trim()},`
      : `Hallo ${dealer.name},`;
    try {
      await this.mail.send({
        to,
        subject: 'Ihr Zugang zum Detailly-Marktplatz',
        text:
          `${anrede}\n\n` +
          `willkommen im Detailly-Marktplatz! Ihre Bewerbung wurde freigegeben.\n\n` +
          `Über Ihren persönlichen Portal-Link pflegen Sie Ihre Produkte und wickeln Bestellungen ab:\n` +
          `${link}\n\n` +
          `Bitte behandeln Sie den Link vertraulich - er ist Ihr Zugang (kein separates Passwort).\n\n` +
          `Mit freundlichen Grüßen\nIhr Detailly-Team`,
      });
    } catch (e) {
      this.logger.warn(`Portal-Link-Mail fehlgeschlagen: ${(e as Error).message}`);
      throw new BadRequestException(MailService.describeSmtpError(e));
    }
    return { ok: true, to };
  }

  // ---------------------------------------------------------------------------
  // Pflege (Plattform-Seite)
  // ---------------------------------------------------------------------------

  listDealers(): Promise<MarketplaceDealer[]> {
    return this.dealerRepo.find({ order: { name: 'ASC' } });
  }

  createDealer(dto: CreateDealerDto): Promise<MarketplaceDealer> {
    return this.dealerRepo.save(this.dealerRepo.create({ ...dto }));
  }

  async updateDealer(id: string, dto: UpdateDealerDto): Promise<MarketplaceDealer> {
    const dealer = await this.dealerRepo.findOne({ where: { id } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    Object.assign(dealer, dto);
    return this.dealerRepo.save(dealer);
  }

  listProducts(): Promise<MarketplaceProduct[]> {
    return this.productRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createProduct(dto: CreateProductDto): Promise<MarketplaceProduct> {
    const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
    if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    this.assertVertriebsweg(dto);
    return this.productRepo.save(this.productRepo.create({ ...dto }));
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    if (dto.dealerId && dto.dealerId !== product.dealerId) {
      const dealer = await this.dealerRepo.findOne({ where: { id: dto.dealerId } });
      if (!dealer) throw new BadRequestException('Haendler existiert nicht');
    }
    Object.assign(product, dto);
    this.assertVertriebsweg(product);
    return this.productRepo.save(product);
  }

  /**
   * Portal-Token fuer einen Haendler (neu) ausstellen. Ueberschreibt einen
   * evtl. vorhandenen Token (Rotation bei Leck). Der Rohwert wird NUR hier
   * zurueckgegeben; gespeichert bleibt er Klartext (WHERE-Lookup, wie
   * calendarToken), aber select:false.
   */
  async issueUploadToken(dealerId: string): Promise<{ uploadToken: string; portalPfad: string }> {
    const dealer = await this.dealerRepo.findOne({ where: { id: dealerId } });
    if (!dealer) throw new NotFoundException('Haendler nicht gefunden');
    const token = crypto.randomBytes(24).toString('hex'); // 192 Bit, passt zum Format-Check
    await this.dealerRepo.update(dealer.id, { uploadToken: token });
    // Query-Param statt dynamischer Route: das Frontend ist ein statischer Export.
    return { uploadToken: token, portalPfad: `/haendler?t=${token}` };
  }

  /** Alle Bestellungen (optional nach Status), inkl. Positionen + Haendlername. */
  async listAllOrders(status?: MarketplaceOrderStatus) {
    const orders = await this.orderRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return this.anreichern(orders);
  }

  /** Admin-Statuswechsel ohne Uebergangs-Beschraenkung (Betreiber-Override). */
  async adminSetOrderStatus(id: string, status: MarketplaceOrderStatus) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Bestellung nicht gefunden');
    order.status = status;
    await this.orderRepo.save(order);
    return order;
  }

  /**
   * Margen-Report je Haendler: Bestellungen/Umsatz/Provision (stornierte
   * ausgenommen) + Klicks. DIE Sicht fuer den Betreiber (Finn), um je Haendler
   * nachzuvollziehen, wieviel Marge/Affiliate anfaellt.
   */
  async provisionReport() {
    const [orderAgg, klickAgg, dealers] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('o')
        .select('o.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'bestellungen')
        .addSelect('SUM(o.summeBrutto)', 'umsatz')
        .addSelect('SUM(o.summeProvision)', 'provision')
        .where('o.status != :storniert', { storniert: MarketplaceOrderStatus.STORNIERT })
        .groupBy('o.dealerId')
        .getRawMany<{ dealerId: string; bestellungen: string; umsatz: string; provision: string }>(),
      this.clickRepo
        .createQueryBuilder('k')
        .select('k.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'klicks')
        .groupBy('k.dealerId')
        .getRawMany<{ dealerId: string; klicks: string }>(),
      this.dealerRepo.find({ order: { name: 'ASC' } }),
    ]);
    const orderByDealer = new Map(orderAgg.map((r) => [r.dealerId, r]));
    const klicksByDealer = new Map(klickAgg.map((r) => [r.dealerId, Number(r.klicks)]));

    const zeilen = dealers.map((d) => {
      const o = orderByDealer.get(d.id);
      return {
        dealerId: d.id,
        name: d.name,
        aktiv: d.aktiv,
        provisionSatz: Number(d.provisionSatz),
        bestellungen: Number(o?.bestellungen ?? 0),
        umsatz: rund2(Number(o?.umsatz ?? 0)),
        provision: rund2(Number(o?.provision ?? 0)),
        klicks: klicksByDealer.get(d.id) ?? 0,
      };
    });
    return {
      zeilen,
      summe: {
        bestellungen: zeilen.reduce((s, z) => s + z.bestellungen, 0),
        umsatz: rund2(zeilen.reduce((s, z) => s + z.umsatz, 0)),
        provision: rund2(zeilen.reduce((s, z) => s + z.provision, 0)),
        klicks: zeilen.reduce((s, z) => s + z.klicks, 0),
      },
    };
  }

  /** Affiliate-Statistik: Gesamt/30 Tage + Top-Produkte/-Haendler. */
  async stats() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [gesamt, letzte30Tage, topProdukteRaw, topHaendlerRaw, dealers] = await Promise.all([
      this.clickRepo.count(),
      this.clickRepo.count({ where: { createdAt: MoreThanOrEqual(cutoff) } }),
      this.productRepo.find({ where: { aktiv: true }, order: { klicks: 'DESC' }, take: 5 }),
      this.clickRepo
        .createQueryBuilder('k')
        .select('k.dealerId', 'dealerId')
        .addSelect('COUNT(*)', 'klicks')
        .groupBy('k.dealerId')
        .orderBy('klicks', 'DESC')
        .limit(5)
        .getRawMany<{ dealerId: string; klicks: string }>(),
      this.dealerRepo.find({ select: ['id', 'name'] }),
    ]);
    const nameById = new Map(dealers.map((d) => [d.id, d.name]));
    return {
      gesamt,
      letzte30Tage,
      topProdukte: topProdukteRaw.map((p) => ({
        name: p.name,
        haendler: nameById.get(p.dealerId) ?? '—',
        klicks: Number(p.klicks),
      })),
      topHaendler: topHaendlerRaw.map((r) => ({
        name: nameById.get(r.dealerId) ?? '—',
        klicks: Number(r.klicks),
      })),
    };
  }
}
