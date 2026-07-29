import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import type { Readable } from 'stream';
import { basename, extname } from 'path';
import { encryptBuffer, decryptBuffer } from '../common/crypto/encryption';
import { storage } from '../common/storage';
import { MarketplaceProduct } from './entities/marketplace-product.entity';
import { MarketplaceProductImage } from './entities/marketplace-product-image.entity';
import { HochgeladenesDokument } from './kyb.service';

/** Erkannter Bildtyp anhand der Magic-Bytes (nur echte Raster-Bilder). */
interface BildTyp {
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Max. Bildgroesse (5 MB) – identisch zum Multer-Limit im Controller. */
export const MAX_BILD_BYTES = 5 * 1024 * 1024;

/** Max. SDB-Groesse (10 MB, PDF) – identisch zum Multer-Limit im Controller. */
export const MAX_SDB_BYTES = 10 * 1024 * 1024;

/** Pro-Produkt-Quota fuer die Galerie (zusaetzlich zum Primaerbild am Produkt). */
export const MAX_BILDER_PRO_PRODUKT = 8;

/**
 * Datei-Handling fuer Marktplatz-Produkte (PR3): Galerie-Bilder + Sicherheits-
 * datenblatt (SDB). Analog zur KybService, aber mit BEWUSST unterschiedlicher
 * Ablage-Strategie je Datei-Art:
 *
 *  - BILDER (MarketplaceProductImage): JPEG/PNG/WebP per Magic-Byte, UNVERSCHLUESSELT
 *    unter private-uploads/marketplace-images/. Der Katalog laedt viele Bilder; ein
 *    Entschluesseln je Request waere CPU-teuer. Sicherheit kommt NICHT aus der
 *    Verschluesselung, sondern aus (a) keinem oeffentlichen Mount und (b) der
 *    zugriffsgeschuetzten Streaming-Route (nur eingeloggte Tenants / eigener Haendler).
 *
 *  - SDB (MarketplaceProduct.sdbDatei): NUR PDF per Magic-Byte, VERSCHLUESSELT at rest
 *    (encryptBuffer, gleiche AES-256-GCM-Kette wie KYB) unter private-uploads/
 *    marketplace-sdb/, mit sha256 ueber den Klartext. Downloads als attachment + nosniff.
 *
 * GEMEINSAM mit KYB: memoryStorage-Upload (Groessenlimit im FileInterceptor greift
 * VOR dem Dekodieren), serverseitig generierte Dateinamen (nie der Client-Name ->
 * kein Traversal beim Schreiben) und ein STRENGES Prefix-Resolve beim Lesen.
 *
 * Diese Klasse macht KEINE Zugriffskontrolle ueber den Dealer hinaus: die dealer-
 * gescopeten Methoden laden das Produkt STRIKT ueber `{ id, dealerId }` (fremde ->
 * 404); die Buy-Side-Methoden bekommen ein bereits als aktiv aufgeloestes Produkt
 * vom MarketplaceService.
 */
@Injectable()
export class MarketplaceUploadService {
  private readonly logger = new Logger(MarketplaceUploadService.name);

  constructor(
    @InjectRepository(MarketplaceProduct)
    private readonly productRepo: Repository<MarketplaceProduct>,
    @InjectRepository(MarketplaceProductImage)
    private readonly imageRepo: Repository<MarketplaceProductImage>,
  ) {}

  // ---------------------------------------------------------------------------
  // Galerie-Bilder (unverschluesselt, zugriffsgeschuetzt gestreamt)
  // ---------------------------------------------------------------------------

  /**
   * Legt ein oder mehrere Galerie-Bilder fuer ein EIGENES Produkt des Dealers an.
   * Prueft Magic-Byte + Groesse je Datei, respektiert die Pro-Produkt-Quota und
   * vergibt fortlaufende sortIndex-Werte. Fremdes/fehlendes Produkt -> 404.
   */
  async bilderHochladen(
    dealerId: string,
    productId: string,
    dateien: HochgeladenesDokument[],
  ): Promise<MarketplaceProductImage[]> {
    const product = await this.scopeProductForDealer(dealerId, productId);

    const liste = (dateien ?? []).filter((d) => d?.buffer && d.buffer.length > 0);
    if (liste.length === 0) {
      throw new BadRequestException('Bitte mindestens ein Bild (JPEG, PNG oder WebP) hochladen.');
    }

    const vorhanden = await this.imageRepo.count({ where: { productId: product.id } });
    if (vorhanden + liste.length > MAX_BILDER_PRO_PRODUKT) {
      throw new BadRequestException(
        `Maximal ${MAX_BILDER_PRO_PRODUKT} Bilder je Produkt (bereits ${vorhanden} vorhanden).`,
      );
    }

    // Alle Dateien ZUERST validieren (kein halb-geschriebener Batch bei einer
    // faulen Datei) und danach auf die Platte + in die DB schreiben.
    const geprueft = liste.map((datei) => {
      const buffer = datei.buffer as Buffer;
      if (buffer.length > MAX_BILD_BYTES) {
        throw new BadRequestException('Ein Bild ist zu groß (max. 5 MB).');
      }
      const typ = this.erkenneBildTyp(buffer);
      if (!typ) {
        throw new BadRequestException('Nur echte JPEG-, PNG- oder WebP-Bilder sind erlaubt.');
      }
      return { buffer, typ };
    });

    const letzte = await this.imageRepo.find({
      where: { productId: product.id },
      order: { sortIndex: 'DESC' },
      take: 1,
    });
    let index = letzte.length ? letzte[0].sortIndex + 1 : 0;

    const gespeichert: MarketplaceProductImage[] = [];
    for (const { buffer, typ } of geprueft) {
      // Dateiname IMMER serverseitig generieren – nie der Client-Name (Traversal).
      const dateiname = `${crypto.randomUUID()}.${typ.ext}`;
      // Ablage ueber den Storage-Adapter (privater Bucket = private-uploads/).
      await storage.put('private', `marketplace-images/${dateiname}`, buffer);
      const bild = await this.imageRepo.save(
        this.imageRepo.create({
          productId: product.id,
          datei: `/private-uploads/marketplace-images/${dateiname}`,
          sortIndex: index,
        }),
      );
      index += 1;
      gespeichert.push(bild);
    }
    return gespeichert;
  }

  /** Loescht ein Galerie-Bild eines EIGENEN Produkts (Datei best effort + DB-Zeile). */
  async bildLoeschen(
    dealerId: string,
    productId: string,
    imageId: string,
  ): Promise<{ ok: true }> {
    const product = await this.scopeProductForDealer(dealerId, productId);
    const bild = await this.imageRepo.findOne({ where: { id: imageId, productId: product.id } });
    if (!bild) throw new NotFoundException('Bild nicht gefunden');
    const key = this.bildKey(bild.datei);
    if (key) {
      try {
        await storage.delete('private', key);
      } catch (err) {
        this.logger.debug(`Bild-Datei nicht loeschbar (${(err as Error).message}).`);
      }
    }
    await this.imageRepo.delete({ id: bild.id });
    return { ok: true };
  }

  /** Galerie-Bilder (nur id + sortIndex) je Produkt – fuer Katalog/Portal-Anreicherung. */
  async bilderFuerProdukte(
    productIds: string[],
  ): Promise<Map<string, { id: string; sortIndex: number }[]>> {
    const map = new Map<string, { id: string; sortIndex: number }[]>();
    if (productIds.length === 0) return map;
    const bilder = await this.imageRepo.find({
      where: { productId: In(productIds) },
      order: { sortIndex: 'ASC' },
    });
    for (const b of bilder) {
      const liste = map.get(b.productId) ?? [];
      liste.push({ id: b.id, sortIndex: b.sortIndex });
      map.set(b.productId, liste);
    }
    return map;
  }

  /** Dealer-Vorschau: Bild eines EIGENEN Produkts streamen (scope 404). */
  async bildAnzeigenFuerDealer(
    dealerId: string,
    productId: string,
    imageId: string,
  ): Promise<{ stream: Readable; mime: string }> {
    const product = await this.scopeProductForDealer(dealerId, productId);
    return this.bildStream(product, imageId);
  }

  /**
   * Streamt ein Galerie-Bild eines BEREITS aufgeloesten Produkts (Buy-Side: der
   * MarketplaceService hat Produkt-/Dealer-Aktivitaet vorab geprueft). Das Bild
   * MUSS zu diesem Produkt gehoeren (Membership via `{ id, productId }`).
   */
  async bildStream(
    product: MarketplaceProduct,
    imageId: string,
  ): Promise<{ stream: Readable; mime: string }> {
    const bild = await this.imageRepo.findOne({ where: { id: imageId, productId: product.id } });
    if (!bild) throw new NotFoundException('Bild nicht gefunden');
    const key = this.bildKey(bild.datei);
    if (!key || !(await storage.exists('private', key))) {
      throw new NotFoundException('Bild-Datei nicht gefunden');
    }
    return { stream: await storage.getStream('private', key), mime: this.bildMime(bild.datei) };
  }

  // ---------------------------------------------------------------------------
  // Sicherheitsdatenblatt (SDB, verschluesselt at rest)
  // ---------------------------------------------------------------------------

  /**
   * Legt/ersetzt das SDB (PDF) eines EIGENEN Produkts ab: Magic-Byte + Groesse,
   * sha256 ueber den Klartext, AES-256-GCM-Verschluesselung unter private-uploads/
   * marketplace-sdb/. Ein evtl. altes SDB wird best effort geloescht.
   */
  async sdbHochladen(
    dealerId: string,
    productId: string,
    datei?: HochgeladenesDokument,
  ): Promise<MarketplaceProduct> {
    const product = await this.scopeProductForDealer(dealerId, productId);

    const buffer = datei?.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Bitte das Sicherheitsdatenblatt als PDF hochladen.');
    }
    if (buffer.length > MAX_SDB_BYTES) {
      throw new BadRequestException('Die Datei ist zu groß (max. 10 MB).');
    }
    if (!this.istPdf(buffer)) {
      throw new BadRequestException('Das Sicherheitsdatenblatt muss ein PDF sein.');
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const verschluesselt = encryptBuffer(buffer);

    const dateiname = `${crypto.randomUUID()}.pdf.enc`;
    // Verschluesselt at rest im privaten Bucket (private-uploads/marketplace-sdb/).
    await storage.put('private', `marketplace-sdb/${dateiname}`, verschluesselt);

    const alt = product.sdbDatei;
    product.sdbDatei = `/private-uploads/marketplace-sdb/${dateiname}`;
    product.sdbHochgeladenAm = new Date();
    product.sdbHash = hash;
    const saved = await this.productRepo.save(product);

    // Vorgaenger best effort entsorgen (nachdem das neue SDB sicher verbucht ist).
    if (alt) {
      const altKey = this.sdbKey(alt);
      if (altKey) {
        try {
          await storage.delete('private', altKey);
        } catch (err) {
          this.logger.debug(`Altes SDB nicht loeschbar (${(err as Error).message}).`);
        }
      }
    }
    return saved;
  }

  /** Dealer-Vorschau: SDB eines EIGENEN Produkts entschluesselt laden (scope 404). */
  async sdbAnzeigenFuerDealer(
    dealerId: string,
    productId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const product = await this.scopeProductForDealer(dealerId, productId);
    return this.sdbLaden(product);
  }

  /**
   * Laedt + entschluesselt das SDB eines BEREITS aufgeloesten Produkts. Ohne
   * hinterlegtes SDB -> 404 (kein Existenz-Orakel). Wirft LAUT bei Manipulation
   * (DecryptionError aus decryptBuffer), nie Chiffretext-Muell.
   */
  async sdbLaden(product: MarketplaceProduct): Promise<{ buffer: Buffer; filename: string }> {
    if (!product.sdbDatei) throw new NotFoundException('Kein Sicherheitsdatenblatt vorhanden');
    const key = this.sdbKey(product.sdbDatei);
    if (!key) throw new NotFoundException('Sicherheitsdatenblatt nicht gefunden');
    let roh: Buffer;
    try {
      roh = await storage.get('private', key);
    } catch {
      throw new NotFoundException('Sicherheitsdatenblatt-Datei nicht gefunden');
    }
    return { buffer: decryptBuffer(roh), filename: 'sicherheitsdatenblatt.pdf' };
  }

  // ---------------------------------------------------------------------------
  // Interne Helfer (Scope, Magic-Byte, Traversal-sicheres Resolve)
  // ---------------------------------------------------------------------------

  /**
   * Laedt ein Produkt STRIKT im Besitz des Dealers (`{ id, dealerId }`). Ein
   * fremdes oder nicht existentes Produkt -> 404 (kein Existenz-Orakel). Die
   * dealerId kommt IMMER aus dem aufgeloesten Dealer (JWT/Token), nie vom Client.
   */
  private async scopeProductForDealer(
    dealerId: string,
    productId: string,
  ): Promise<MarketplaceProduct> {
    const product = await this.productRepo.findOne({ where: { id: productId, dealerId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden');
    return product;
  }

  /**
   * Magic-Byte-Erkennung fuer JPEG/PNG/WebP. Verhindert, dass SVG/HTML/Polyglot
   * mit Bild-Endung als "Bild" durchrutscht (kein SVG!). Es zaehlen ausschliesslich
   * die tatsaechlichen Datei-Signaturen, nie MIME-Header oder Endung.
   */
  private erkenneBildTyp(b: Buffer): BildTyp | null {
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
      return { ext: 'jpg', mime: 'image/jpeg' };
    }
    if (
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
    ) {
      return { ext: 'png', mime: 'image/png' };
    }
    // WebP: "RIFF" (0-3) | Groesse (4-7) | "WEBP" (8-11).
    if (
      b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    ) {
      return { ext: 'webp', mime: 'image/webp' };
    }
    return null;
  }

  /** Magic-Byte-Pruefung fuer PDF (%PDF). */
  private istPdf(b: Buffer): boolean {
    return b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  }

  /** Content-Type eines Galerie-Bildes aus der (serverseitig gesetzten) Endung. */
  private bildMime(pfad: string): string {
    switch (extname(pfad).toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }

  /** Traversal-sicherer Storage-Key innerhalb marketplace-images/. */
  private bildKey(pfad: string): string | null {
    return this.keyIn('marketplace-images', pfad);
  }

  /** Traversal-sicherer Storage-Key innerhalb marketplace-sdb/. */
  private sdbKey(pfad: string): string | null {
    return this.keyIn('marketplace-sdb', pfad);
  }

  /**
   * Bildet den (traversal-sicheren) Storage-Key STRENG innerhalb <ordner>/ im
   * privaten Bucket. Es wird NUR der Dateiname (basename) verwendet; ein ../-
   * Segment kann den Ordner nicht verlassen. Der Adapter fuehrt zusaetzlich einen
   * eigenen Praefix-Check. Liefert null bei leerem Dateinamen.
   */
  private keyIn(ordner: string, pfad: string): string | null {
    const datei = basename(pfad ?? '');
    if (!datei) return null;
    return `${ordner}/${datei}`;
  }
}
