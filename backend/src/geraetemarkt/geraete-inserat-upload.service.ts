import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import type { Readable } from 'stream';
import { basename, extname } from 'path';
import { storage } from '../common/storage';
import { GeraeteInserat } from './entities/geraete-inserat.entity';
import { GeraeteInseratBild } from './entities/geraete-inserat-bild.entity';
import { SICHTBARE_STATUS } from './geraetemarkt.constants';

/** Eine per Multer (memoryStorage) hochgeladene Datei – nur der Puffer zaehlt. */
export interface HochgeladenesBild {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

/** Erkannter Bildtyp anhand der Magic-Bytes (nur echte Raster-Bilder). */
interface BildTyp {
  ext: 'jpg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
}

/** Max. Bildgroesse (5 MB) – identisch zum Multer-Limit im Controller. */
export const MAX_BILD_BYTES = 5 * 1024 * 1024;

/** Pro-Inserat-Quota fuer die Galerie. */
export const MAX_BILDER_PRO_INSERAT = 8;

/** Ordner unterhalb private-uploads/, in dem die Inserat-Bilder liegen. */
const BILDER_ORDNER = 'geraetemarkt-images';

/**
 * Bild-Handling fuer Geraete-Inserate (PR2). Adaptiert das gehaertete Muster der
 * Marktplatz-Uploads, aber TENANT-scoped statt dealer-scoped: jedes Inserat
 * gehoert einem `tenantId` (Verkaeufer-Betrieb).
 *
 * Ablage: JPEG/PNG/WebP per Magic-Byte, UNVERSCHLUESSELT unter
 * private-uploads/geraetemarkt-images/. Der Gebrauchtmarkt ist ein oeffentlicher
 * Katalog (viele Bilder je Ansicht); ein Entschluesseln je Request waere CPU-teuer.
 * Sicherheit kommt NICHT aus der Verschluesselung, sondern aus (a) keinem
 * oeffentlichen Mount und (b) der zugriffsgeschuetzten Streaming-Route.
 *
 * Kern-Haertung (wie Vorbild): memoryStorage-Upload (Groessenlimit im
 * FileInterceptor greift VOR dem Dekodieren), serverseitig generierte Dateinamen
 * (UUID -> kein Traversal beim Schreiben) und ein STRENGES Prefix-Resolve beim Lesen.
 *
 * Zugriff:
 *  - Upload/Loeschen: STRIKT am EIGENEN Inserat (`{ id, tenantId }`); fremd/fehlt -> 404.
 *  - Stream: fuer jeden eingeloggten Tenant lesbar, aber nur bei SICHTBAREM Inserat
 *    (Moderation/Status/Ablauf), das eigene Inserat sieht der Besitzer immer.
 */
@Injectable()
export class GeraeteInseratUploadService {
  private readonly logger = new Logger(GeraeteInseratUploadService.name);

  constructor(
    @InjectRepository(GeraeteInserat)
    private readonly inseratRepo: Repository<GeraeteInserat>,
    @InjectRepository(GeraeteInseratBild)
    private readonly bildRepo: Repository<GeraeteInseratBild>,
  ) {}

  /**
   * Legt ein oder mehrere Galerie-Bilder fuer ein EIGENES Inserat des Betriebs an.
   * Prueft Magic-Byte + Groesse je Datei, respektiert die Pro-Inserat-Quota und
   * vergibt fortlaufende sortIndex-Werte. Fremdes/fehlendes Inserat -> 404.
   */
  async bilderHochladen(
    tenantId: string,
    inseratId: string,
    dateien: HochgeladenesBild[],
  ): Promise<GeraeteInseratBild[]> {
    const inserat = await this.scopeInseratFuerTenant(tenantId, inseratId);

    const liste = (dateien ?? []).filter((d) => d?.buffer && d.buffer.length > 0);
    if (liste.length === 0) {
      throw new BadRequestException('Bitte mindestens ein Bild (JPEG, PNG oder WebP) hochladen.');
    }

    const vorhanden = await this.bildRepo.count({ where: { inseratId: inserat.id } });
    if (vorhanden + liste.length > MAX_BILDER_PRO_INSERAT) {
      throw new BadRequestException(
        `Maximal ${MAX_BILDER_PRO_INSERAT} Bilder je Inserat (bereits ${vorhanden} vorhanden).`,
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

    const letzte = await this.bildRepo.find({
      where: { inseratId: inserat.id },
      order: { sortIndex: 'DESC' },
      take: 1,
    });
    let index = letzte.length ? letzte[0].sortIndex + 1 : 0;

    const gespeichert: GeraeteInseratBild[] = [];
    for (const { buffer, typ } of geprueft) {
      // Dateiname IMMER serverseitig generieren – nie der Client-Name (Traversal).
      const dateiname = `${crypto.randomUUID()}.${typ.ext}`;
      // Ablage ueber den Storage-Adapter (privater Bucket = private-uploads/).
      await storage.put('private', `${BILDER_ORDNER}/${dateiname}`, buffer);
      const bild = await this.bildRepo.save(
        this.bildRepo.create({
          inseratId: inserat.id,
          datei: `/private-uploads/${BILDER_ORDNER}/${dateiname}`,
          sortIndex: index,
        }),
      );
      index += 1;
      gespeichert.push(bild);
    }
    return gespeichert;
  }

  /** Loescht ein Galerie-Bild eines EIGENEN Inserats (Datei best effort + DB-Zeile). */
  async bildLoeschen(
    tenantId: string,
    inseratId: string,
    bildId: string,
  ): Promise<{ ok: true }> {
    const inserat = await this.scopeInseratFuerTenant(tenantId, inseratId);
    const bild = await this.bildRepo.findOne({ where: { id: bildId, inseratId: inserat.id } });
    if (!bild) throw new NotFoundException('Bild nicht gefunden');
    const key = this.bildKey(bild.datei);
    if (key) {
      try {
        await storage.delete('private', key);
      } catch (err) {
        this.logger.debug(`Bild-Datei nicht loeschbar (${(err as Error).message}).`);
      }
    }
    await this.bildRepo.delete({ id: bild.id });
    return { ok: true };
  }

  /**
   * Streamt ein Galerie-Bild fuer einen eingeloggten Tenant. Das eigene Inserat
   * sieht der Besitzer immer; ein FREMDES Inserat nur, wenn es sichtbar ist
   * (Moderation/Status/Ablauf) – sonst 404 (kein Existenz-Orakel). Das Bild MUSS
   * zum Inserat gehoeren (Membership via `{ id, inseratId }`).
   */
  async bildStreamen(
    tenantId: string,
    inseratId: string,
    bildId: string,
  ): Promise<{ stream: Readable; mime: string }> {
    const inserat = await this.inseratRepo.findOne({ where: { id: inseratId } });
    if (!inserat) throw new NotFoundException('Inserat nicht gefunden');
    const eigen = inserat.tenantId === tenantId;
    if (!eigen && !this.istSichtbar(inserat)) {
      throw new NotFoundException('Inserat nicht gefunden');
    }
    const bild = await this.bildRepo.findOne({ where: { id: bildId, inseratId: inserat.id } });
    if (!bild) throw new NotFoundException('Bild nicht gefunden');
    const key = this.bildKey(bild.datei);
    if (!key || !(await storage.exists('private', key))) {
      throw new NotFoundException('Bild-Datei nicht gefunden');
    }
    return { stream: await storage.getStream('private', key), mime: this.bildMime(bild.datei) };
  }

  // ---------------------------------------------------------------------------
  // Interne Helfer (Scope, Sichtbarkeit, Magic-Byte, Traversal-sicheres Resolve)
  // ---------------------------------------------------------------------------

  /**
   * Laedt ein Inserat STRIKT im Besitz des Betriebs (`{ id, tenantId }`). Ein
   * fremdes oder nicht existentes Inserat -> 404 (kein Existenz-Orakel). Die
   * tenantId kommt IMMER aus dem JWT, nie vom Client.
   */
  private async scopeInseratFuerTenant(
    tenantId: string,
    inseratId: string,
  ): Promise<GeraeteInserat> {
    const inserat = await this.inseratRepo.findOne({ where: { id: inseratId, tenantId } });
    if (!inserat) throw new NotFoundException('Inserat nicht gefunden');
    return inserat;
  }

  /** Sichtbarkeit wie im Browse-Filter (PR1): moderiert ok + Status + nicht abgelaufen. */
  private istSichtbar(i: GeraeteInserat): boolean {
    if (i.moderationStatus !== 'ok') return false;
    if (!SICHTBARE_STATUS.includes(i.status as (typeof SICHTBARE_STATUS)[number])) return false;
    if (i.ablaufAm && i.ablaufAm.getTime() <= Date.now()) return false;
    return true;
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

  /**
   * Bildet den (traversal-sicheren) Storage-Key STRENG innerhalb
   * geraetemarkt-images/ im privaten Bucket. Es wird NUR der Dateiname (basename)
   * verwendet; ein ../-Segment kann den Ordner nicht verlassen. Der Adapter
   * fuehrt zusaetzlich einen eigenen Praefix-Check. Liefert null bei leerem Namen.
   */
  private bildKey(pfad: string): string | null {
    const datei = basename(pfad ?? '');
    if (!datei) return null;
    return `${BILDER_ORDNER}/${datei}`;
  }
}
