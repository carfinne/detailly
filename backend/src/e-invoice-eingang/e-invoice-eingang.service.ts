import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { promises as fsp } from 'fs';
import { basename, extname, join, resolve, sep } from 'path';
import { encryptBuffer, decryptBuffer } from '../common/crypto/encryption';
import { clampPageQuery, PaginatedResult } from '../common/util/pagination';
import {
  IncomingInvoice,
  IncomingInvoiceFormat,
  IncomingInvoiceStatus,
} from './entities/incoming-invoice.entity';
import { readEInvoiceXml, EInvoiceFields } from './xml-reader';
import { extractEmbeddedInvoiceXml, isPdf } from './pdf-embedded-xml';

/** Hochgeladene Datei (Multer, memoryStorage) – nur die genutzten Felder. */
export interface HochgeladeneEingangsDatei {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

/** Max. Dateigroesse (10 MB) – identisch zum Multer-Limit im Controller. */
export const MAX_EINGANG_BYTES = 10 * 1024 * 1024;

type ErkannterTyp = { ext: 'pdf' | 'xml'; mime: 'application/pdf' | 'application/xml' };

/**
 * E-Rechnungs-Eingang (Empfang + Lesen strukturierter Rechnungen, §14 UStG).
 *
 * Zustaendig fuer:
 *  - Datei-Handling: Magic-Byte-Pruefung (PDF/XML) + Groessenlimit + sha256 +
 *    AES-256-GCM-Verschluesselung AT REST unter private-uploads/erechnung/ +
 *    Dubletten-Erkennung (409). Muster: kyb.service.
 *  - Auslesen: reiner XML-Reader (UBL/CII); hybrides PDF/A-3 -> zlib-Extraktion
 *    des eingebetteten XML. Schlaegt das Auslesen fehl, wird das Original
 *    TROTZDEM archiviert (Status NICHT_LESBAR) – die Empfangs-/Lese-Pflicht
 *    bleibt erfuellt (Roh-Download + Anzeige).
 *
 * Mandantentrennung strikt: jede Query tenant-scoped; der Datei-Resolver bleibt
 * innerhalb private-uploads/erechnung/ (kein Directory-Traversal).
 */
@Injectable()
export class EInvoiceEingangService {
  private readonly logger = new Logger(EInvoiceEingangService.name);

  constructor(
    @InjectRepository(IncomingInvoice)
    private readonly repo: Repository<IncomingInvoice>,
  ) {}

  // ---------------------------------------------------------------------------
  // Upload + Verarbeitung
  // ---------------------------------------------------------------------------

  /**
   * Nimmt eine hochgeladene E-Rechnung entgegen: validiert, archiviert das
   * Original verschluesselt, liest die Kopf-/Summen-Felder aus und speichert den
   * Datensatz. Wirft 400 (fehlend/zu gross/falscher Typ) bzw. 409 (Dublette).
   */
  async verarbeiteUpload(
    tenantId: string,
    userId: string | undefined,
    datei?: HochgeladeneEingangsDatei,
  ): Promise<IncomingInvoice> {
    const buffer = datei?.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Bitte eine E-Rechnung als XML oder PDF hochladen.');
    }
    if (buffer.length > MAX_EINGANG_BYTES) {
      throw new BadRequestException('Die Datei ist zu groß (max. 10 MB).');
    }
    const typ = this.erkenneTyp(buffer);
    if (!typ) {
      throw new BadRequestException('Nur E-Rechnungen im XML- oder PDF-Format sind erlaubt.');
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dublette = await this.repo.findOne({ where: { tenantId, dokumentHash: hash } });
    if (dublette) {
      throw new ConflictException('Diese Datei wurde bereits importiert.');
    }

    // Auslesen (nie werfend): XML direkt, hybrides PDF via zlib-Extraktion.
    const { fields, format } = this.leseFelder(buffer, typ);

    // Original IMMER archivieren (GoBD) – auch bei nicht lesbaren Belegen.
    const archivDatei = await this.archiviere(buffer, typ.ext);

    const status = this.leiteStatusAb(fields);
    const entity = this.repo.create({
      tenantId,
      status,
      format,
      archivDatei,
      dokumentHash: hash,
      mimeType: typ.mime,
      dateiGroesse: buffer.length,
      originalDateiname: this.saubereDateiname(datei?.originalname) ?? null,
      hochgeladenVonUserId: userId ?? null,
      parseFehler: this.parseFehlerText(status, fields),
      ...this.mappeFelder(fields),
    });
    return this.repo.save(entity);
  }

  /** Liest die Felder je nach Typ; bestimmt das Quellformat. Nie werfend. */
  private leseFelder(
    buffer: Buffer,
    typ: ErkannterTyp,
  ): { fields: EInvoiceFields; format: IncomingInvoiceFormat } {
    if (typ.ext === 'xml') {
      const fields = readEInvoiceXml(this.entferneBom(buffer).toString('utf8'));
      const format =
        fields.syntax === 'ubl'
          ? IncomingInvoiceFormat.UBL
          : fields.syntax === 'cii'
            ? IncomingInvoiceFormat.CII
            : IncomingInvoiceFormat.UNBEKANNT;
      return { fields, format };
    }
    // PDF: eingebettetes XML extrahieren (kann null sein -> Fallback).
    const xml = extractEmbeddedInvoiceXml(buffer);
    if (!xml) return { fields: { syntax: 'unbekannt' }, format: IncomingInvoiceFormat.UNBEKANNT };
    const fields = readEInvoiceXml(xml);
    const format =
      fields.syntax === 'unbekannt'
        ? IncomingInvoiceFormat.UNBEKANNT
        : IncomingInvoiceFormat.CII_PDF;
    return { fields, format };
  }

  /** GELESEN nur mit allen Kernfeldern; sonst TEILWEISE / NICHT_LESBAR. */
  private leiteStatusAb(fields: EInvoiceFields): IncomingInvoiceStatus {
    if (fields.syntax === 'unbekannt') return IncomingInvoiceStatus.NICHT_LESBAR;
    const kernVollstaendig =
      !!fields.rechnungsnummer && !!fields.verkaeuferName && fields.bruttoBetrag != null;
    return kernVollstaendig ? IncomingInvoiceStatus.GELESEN : IncomingInvoiceStatus.TEILWEISE;
  }

  /** Menschenlesbarer Hinweis bei nicht/teilweise lesbaren Belegen. */
  private parseFehlerText(status: IncomingInvoiceStatus, fields: EInvoiceFields): string | null {
    if (status === IncomingInvoiceStatus.GELESEN) return null;
    if (status === IncomingInvoiceStatus.NICHT_LESBAR) {
      return 'Kein lesbares E-Rechnungs-XML gefunden. Der Beleg ist archiviert und als Original abrufbar.';
    }
    const fehlt: string[] = [];
    if (!fields.rechnungsnummer) fehlt.push('Rechnungsnummer');
    if (!fields.verkaeuferName) fehlt.push('Verkäufer');
    if (fields.bruttoBetrag == null) fehlt.push('Bruttobetrag');
    return `Teilweise ausgelesen – es fehlen: ${fehlt.join(', ')}.`;
  }

  /** Uebersetzt die ausgelesenen Felder in die Entity-Spalten. */
  private mappeFelder(f: EInvoiceFields): Partial<IncomingInvoice> {
    return {
      rechnungsnummer: f.rechnungsnummer ?? null,
      rechnungsdatum: this.toDate(f.rechnungsdatum),
      faelligkeitsdatum: this.toDate(f.faelligkeitsdatum),
      leistungsdatum: this.toDate(f.leistungsdatum),
      nettoBetrag: f.nettoBetrag ?? null,
      mwstBetrag: f.mwstBetrag ?? null,
      bruttoBetrag: f.bruttoBetrag ?? null,
      waehrung: f.waehrung || 'EUR',
      leitwegId: f.leitwegId ?? null,
      verkaeuferName: f.verkaeuferName ?? null,
      verkaeuferAnschrift: f.verkaeuferAnschrift ?? null,
      verkaeuferUstId: f.verkaeuferUstId ?? null,
      verkaeuferSteuernummer: f.verkaeuferSteuernummer ?? null,
      iban: f.iban ?? null,
      bic: f.bic ?? null,
    };
  }

  private toDate(iso?: string): Date | null {
    if (!iso) return null;
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ---------------------------------------------------------------------------
  // Lesen (Liste / Detail / Original-Download) – strikt tenant-scoped
  // ---------------------------------------------------------------------------

  /** Paginierte Liste der Eingangsrechnungen des Betriebs (neueste zuerst). */
  async findAll(
    tenantId: string,
    query: { page?: number; limit?: number },
  ): Promise<PaginatedResult<IncomingInvoice>> {
    const { page, limit, skip, take } = clampPageQuery(query);
    const [data, total] = await this.repo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, page, limit };
  }

  /** Einzelner Beleg des eigenen Betriebs – 404 bei Fremd-Tenant/unbekannt. */
  async findOne(tenantId: string, id: string): Promise<IncomingInvoice> {
    const beleg = await this.repo.findOne({ where: { id, tenantId } });
    if (!beleg) throw new NotFoundException('Eingangsrechnung nicht gefunden');
    return beleg;
  }

  /**
   * Laedt + entschluesselt das archivierte Original fuer den Roh-Download.
   * Mandantensicher (erst der DB-Satz muss zum Tenant gehoeren) + Traversal-fest.
   */
  async ladeOriginal(
    tenantId: string,
    id: string,
  ): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const beleg = await this.findOne(tenantId, id);
    const abs = this.resolveDatei(beleg.archivDatei);
    if (!abs) throw new NotFoundException('Original nicht gefunden');
    let roh: Buffer;
    try {
      roh = await fsp.readFile(abs);
    } catch {
      throw new NotFoundException('Original-Datei nicht gefunden');
    }
    const buffer = decryptBuffer(roh);
    const ext = extname(basename(abs).replace(/\.enc$/i, '')).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : 'application/xml';
    return { buffer, mime, filename: `eingangsrechnung${ext}` };
  }

  // ---------------------------------------------------------------------------
  // Datei-Ablage (verschluesselt at rest)
  // ---------------------------------------------------------------------------

  /** Verschluesselt + speichert die Datei unter private-uploads/erechnung/. */
  private async archiviere(buffer: Buffer, ext: 'pdf' | 'xml'): Promise<string> {
    const verzeichnis = join(process.cwd(), 'private-uploads', 'erechnung');
    await fsp.mkdir(verzeichnis, { recursive: true });
    const dateiname = `${crypto.randomUUID()}.${ext}.enc`;
    await fsp.writeFile(join(verzeichnis, dateiname), encryptBuffer(buffer));
    return `/private-uploads/erechnung/${dateiname}`;
  }

  /** Loest den Disk-Pfad STRENG innerhalb private-uploads/erechnung/ auf. */
  private resolveDatei(pfad: string): string | null {
    const datei = basename(pfad ?? '');
    if (!datei) return null;
    const dir = resolve(process.cwd(), 'private-uploads', 'erechnung');
    const kandidat = resolve(dir, datei);
    if (kandidat !== dir && !kandidat.startsWith(dir + sep)) return null;
    return kandidat;
  }

  // ---------------------------------------------------------------------------
  // Magic-Byte-Erkennung + kleine Helfer
  // ---------------------------------------------------------------------------

  /** Erkennt PDF (`%PDF`) oder XML (fuehrendes `<`/`<?xml`, BOM-tolerant). */
  private erkenneTyp(b: Buffer): ErkannterTyp | null {
    if (isPdf(b)) return { ext: 'pdf', mime: 'application/pdf' };
    const kopf = this.entferneBom(b.subarray(0, 512)).toString('utf8').trimStart();
    if (kopf.startsWith('<?xml') || kopf.startsWith('<')) {
      return { ext: 'xml', mime: 'application/xml' };
    }
    return null;
  }

  /** Entfernt ein fuehrendes UTF-8-BOM (EF BB BF), falls vorhanden. */
  private entferneBom(b: Buffer): Buffer {
    if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return b.subarray(3);
    return b;
  }

  /** Saeubert den Original-Dateinamen (nur basename, Laenge begrenzt). */
  private saubereDateiname(name?: string): string | undefined {
    if (!name) return undefined;
    const clean = basename(name).slice(0, 255).trim();
    return clean || undefined;
  }
}
