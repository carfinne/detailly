import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync } from 'fs';
import { basename, extname, resolve, sep } from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { storage, storageBaseDir } from '../common/storage';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  assertSameTenant,
  findOneScoped,
  withTenant,
} from '../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FEATURE_SCHAUFENSTER } from '../subscriptions/plan-catalog';
import { sanitizeLogoUrl } from '../common/logo-url';
import { Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import {
  ShowcaseGewerk,
  ShowcaseItem,
} from './entities/showcase-item.entity';
import { CreateShowcaseItemDto } from './dto/create-showcase-item.dto';
import { UpdateShowcaseItemDto } from './dto/update-showcase-item.dto';
import { PublishShowcaseItemDto } from './dto/publish-showcase-item.dto';

/** Default-Wortlaut der Consent-Bestaetigung, falls der Betrieb keinen eigenen liefert. */
const CONSENT_DEFAULT_HINWEIS =
  'Der Betrieb bestaetigt, dass das schriftliche Einverstaendnis des Kunden zur ' +
  'Veroeffentlichung der Vorher-/Nachher-Bilder vorliegt.';

/**
 * Loest den Disk-Pfad STRENG innerhalb von <cwd>/private-uploads/schaufenster/<tenantId>/
 * auf. Es wird NUR der Dateiname (basename) des gespeicherten Pfads verwendet,
 * damit ein manipulierter DB-Wert oder ein ../-Segment nicht aus dem Tenant-
 * Ordner ausbrechen kann (Directory-Traversal). Praefix-Check inkl. Trenner.
 * Liefert null, wenn ausserhalb (identisches Muster wie InspectionPhotoController).
 *
 * BEWUSST pur + exportiert -> direkt unit-testbar (Traversal-Sicherheit).
 */
export function resolveShowcaseFile(
  tenantId: string,
  gespeicherterPfad: string,
  baseDir: string = storageBaseDir(),
): string | null {
  if (!gespeicherterPfad) return null;
  const tenantDir = resolve(baseDir, 'private-uploads', 'schaufenster', tenantId);
  const dateiname = basename(gespeicherterPfad);
  const kandidat = resolve(tenantDir, dateiname);
  if (kandidat !== tenantDir && !kandidat.startsWith(tenantDir + sep)) {
    return null;
  }
  return kandidat;
}

/** Bildvariante des Bild-Ausliefer-Endpunkts. */
export type ShowcaseBildVariante = 'vorher' | 'nachher';

/** Betreiber-Sicht eines Eintrags (inkl. interner Felder – NUR fuer den eigenen Tenant). */
export interface ShowcaseItemView {
  id: string;
  titel: string;
  beschreibung: string | null;
  gewerk: ShowcaseGewerk;
  veroeffentlicht: boolean;
  shareToken: string | null;
  reihenfolge: number | null;
  kundeEinverstaendnis: boolean;
  einverstaendnisAm: string | null;
  bildVorher: string;
  bildNachher: string;
  createdAt: string;
  updatedAt: string;
}

/** Oeffentliche Betriebs-Meta (STRIKTE Whitelist – kein PII, keine internen IDs). */
export interface PublicShowcaseBetrieb {
  name: string;
  logoUrl: string | null;
}

/**
 * Oeffentliche Sicht eines Eintrags – PII-FREI. KEIN Kundenname, Kennzeichen,
 * keine Auftragsnummer, keine interne ID (ausser dem shareToken). Bild-URLs
 * zeigen auf den token-scoped Public-Endpunkt.
 */
export interface PublicShowcaseItem {
  shareToken: string;
  titel: string;
  beschreibung: string | null;
  gewerk: ShowcaseGewerk;
  bildVorher: string;
  bildNachher: string;
}

export interface PublicShowcaseGallery {
  betrieb: PublicShowcaseBetrieb;
  items: PublicShowcaseItem[];
}

@Injectable()
export class ShowcaseService {
  private readonly logger = new Logger(ShowcaseService.name);

  constructor(
    @InjectRepository(ShowcaseItem)
    private readonly repo: Repository<ShowcaseItem>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  // ===========================================================================
  // Betreiber (tenant-scoped, hinter @RequiresFeature('schaufenster'))
  // ===========================================================================

  /** Alle Eintraege des eigenen Betriebs (Reihenfolge, dann Anlage). */
  async list(user: AuthUser): Promise<ShowcaseItemView[]> {
    const items = await this.repo.find({
      where: { tenantId: user.tenantId },
      order: { reihenfolge: 'ASC', createdAt: 'ASC' },
    });
    return items.map((i) => this.toOperatorView(i));
  }

  /** Einzelner Eintrag (tenant-scoped). */
  async findOne(user: AuthUser, id: string): Promise<ShowcaseItemView> {
    const item = await findOneScoped(this.repo, user, id, 'Eintrag nicht gefunden');
    return this.toOperatorView(item);
  }

  /** Legt einen neuen (unveroeffentlichten) Eintrag an. */
  async create(user: AuthUser, dto: CreateShowcaseItemDto): Promise<ShowcaseItemView> {
    const vorherPfad = await this.speichereBild(user.tenantId, dto.vorherBild);
    const nachherPfad = await this.speichereBild(user.tenantId, dto.nachherBild);

    const item = this.repo.create(
      withTenant(user, {
        titel: dto.titel.trim().slice(0, 120),
        beschreibung: dto.beschreibung?.trim() || null,
        gewerk: dto.gewerk,
        vorherPfad,
        nachherPfad,
        reihenfolge: dto.reihenfolge ?? null,
        veroeffentlicht: false,
        kundeEinverstaendnis: false,
      }),
    );
    const saved = await this.repo.save(item);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'create',
      entityType: 'ShowcaseItem',
      entityId: saved.id,
      payload: { titel: saved.titel, gewerk: saved.gewerk },
    });
    return this.toOperatorView(saved);
  }

  /** Aktualisiert Textfelder/Reihenfolge und ersetzt optional die Bilder. */
  async update(
    user: AuthUser,
    id: string,
    dto: UpdateShowcaseItemDto,
  ): Promise<ShowcaseItemView> {
    const item = await findOneScoped(this.repo, user, id, 'Eintrag nicht gefunden');

    if (dto.titel !== undefined) item.titel = dto.titel.trim().slice(0, 120);
    if (dto.beschreibung !== undefined) item.beschreibung = dto.beschreibung.trim() || null;
    if (dto.gewerk !== undefined) item.gewerk = dto.gewerk;
    if (dto.reihenfolge !== undefined) item.reihenfolge = dto.reihenfolge;

    // Bilder nur ersetzen, wenn eine neue Data-URL kommt. Alte Datei danach
    // best-effort entfernen (Speichersparsamkeit; blockiert nie).
    if (dto.vorherBild) {
      const alt = item.vorherPfad;
      item.vorherPfad = await this.speichereBild(user.tenantId, dto.vorherBild);
      void this.loescheDatei(user.tenantId, alt);
    }
    if (dto.nachherBild) {
      const alt = item.nachherPfad;
      item.nachherPfad = await this.speichereBild(user.tenantId, dto.nachherBild);
      void this.loescheDatei(user.tenantId, alt);
    }

    const saved = await this.repo.save(item);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'update',
      entityType: 'ShowcaseItem',
      entityId: saved.id,
    });
    return this.toOperatorView(saved);
  }

  /**
   * Veroeffentlicht ODER zieht einen Eintrag zurueck.
   *
   * RECHTLICHE DURCHSETZUNG: `veroeffentlicht=true` erfordert die Consent-
   * Bestaetigung (`kundeEinverstaendnis=true`) – sonst 400. Beim ersten
   * Veroeffentlichen wird ein shareToken erzeugt (stabil bei erneutem
   * Veroeffentlichen). Zurueckziehen setzt nur `veroeffentlicht=false`; der
   * oeffentliche Zugriff faellt sofort auf 404 (Query filtert veroeffentlicht).
   */
  async setPublish(
    user: AuthUser,
    id: string,
    dto: PublishShowcaseItemDto,
  ): Promise<ShowcaseItemView> {
    const item = await findOneScoped(this.repo, user, id, 'Eintrag nicht gefunden');

    if (dto.veroeffentlicht) {
      const consent = dto.kundeEinverstaendnis === true || item.kundeEinverstaendnis === true;
      if (!consent) {
        throw new BadRequestException(
          'Ohne Bestaetigung des Kunden-Einverstaendnisses kann der Eintrag nicht ' +
            'veroeffentlicht werden. Bitte bestaetigen Sie, dass das schriftliche ' +
            'Einverstaendnis des Kunden zur Bildveroeffentlichung vorliegt.',
        );
      }
      // Consent-Nachweis festhalten (erst bei explizit neuer Bestaetigung; ein
      // bereits gesetzter Zeitstempel bleibt erhalten).
      if (dto.kundeEinverstaendnis === true || !item.kundeEinverstaendnis) {
        item.kundeEinverstaendnis = true;
        item.einverstaendnisAm = new Date();
        item.einverstaendnisHinweis =
          dto.einverstaendnisHinweis?.trim() || item.einverstaendnisHinweis || CONSENT_DEFAULT_HINWEIS;
      }
      if (!item.shareToken) item.shareToken = this.makeShareToken();
      item.veroeffentlicht = true;
    } else {
      item.veroeffentlicht = false;
    }

    const saved = await this.repo.save(item);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: dto.veroeffentlicht ? 'publish' : 'unpublish',
      entityType: 'ShowcaseItem',
      entityId: saved.id,
      payload: { veroeffentlicht: saved.veroeffentlicht },
    });
    return this.toOperatorView(saved);
  }

  /** Loescht einen Eintrag (inkl. der beiden Bild-Kopien). */
  async remove(user: AuthUser, id: string): Promise<{ success: true }> {
    const item = await findOneScoped(this.repo, user, id, 'Eintrag nicht gefunden');
    await this.repo.remove(item);
    void this.loescheDatei(user.tenantId, item.vorherPfad);
    void this.loescheDatei(user.tenantId, item.nachherPfad);
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'delete',
      entityType: 'ShowcaseItem',
      entityId: id,
    });
    return { success: true };
  }

  /**
   * Betreiber-Bildpfad (tenant-scoped, guard-geschuetzt) – fuer die Vorschau im
   * Verwaltungs-UI, AUCH wenn der Eintrag noch NICHT veroeffentlicht ist (dann
   * gibt es kein shareToken/keinen Public-Endpunkt). findOneScoped wirft NotFound
   * bei Fremd-/Nichtexistenz; der Pfad wird traversal-sicher aufgeloest.
   */
  async resolveOperatorImagePath(
    user: AuthUser,
    id: string,
    variante: ShowcaseBildVariante,
  ): Promise<string> {
    const item = await findOneScoped(this.repo, user, id, 'Eintrag nicht gefunden');
    const gespeicherterPfad = variante === 'vorher' ? item.vorherPfad : item.nachherPfad;
    const abs = this.resolveTenantFile(user.tenantId, gespeicherterPfad);
    if (!abs || !existsSync(abs)) throw new NotFoundException('Bild nicht gefunden');
    return abs;
  }

  // ===========================================================================
  // Oeffentlich (kein Auth – Zugang ist der Slug/Token; PII-frei)
  // ===========================================================================

  /**
   * Oeffentliche Galerie eines Betriebs (alle veroeffentlichten Eintraege).
   * Tenant NUR aus dem Slug (aktiv). Ohne Tarif-Feature -> 404 (kein Orakel,
   * gleiche Antwort wie "Betrieb existiert nicht"). Payload strikt PII-frei.
   */
  async publicGallery(slug: string): Promise<PublicShowcaseGallery> {
    const tenant = await this.resolvePublicTenant(slug);
    const items = await this.repo.find({
      where: { tenantId: tenant.id, veroeffentlicht: true },
      order: { reihenfolge: 'ASC', createdAt: 'ASC' },
    });
    return {
      betrieb: { name: tenant.name, logoUrl: sanitizeLogoUrl(tenant.logoUrl) },
      items: items.map((i) => this.toPublicView(slug, i)),
    };
  }

  /**
   * Einzelner veroeffentlichter Eintrag per Slug + shareToken (PII-frei).
   * Ungueltiges/unbekanntes/zurueckgezogenes Token -> 404 (kein Orakel).
   */
  async publicItem(slug: string, shareToken: string): Promise<{
    betrieb: PublicShowcaseBetrieb;
    item: PublicShowcaseItem;
  }> {
    const tenant = await this.resolvePublicTenant(slug);
    const item = await this.resolvePublishedByToken(tenant.id, shareToken);
    return {
      betrieb: { name: tenant.name, logoUrl: sanitizeLogoUrl(tenant.logoUrl) },
      item: this.toPublicView(slug, item),
    };
  }

  /**
   * Loest den absoluten Disk-Pfad des veroeffentlichten Bildes auf (traversal-
   * sicher). Nur veroeffentlichte Eintraege des per Slug aufgeloesten Betriebs;
   * unbekanntes Token / zurueckgezogen / Feature fehlt -> 404. Der Controller
   * streamt die Datei; hier wird NUR der Pfad geliefert (rein, gut testbar).
   */
  async resolvePublicImagePath(
    slug: string,
    shareToken: string,
    variante: ShowcaseBildVariante,
  ): Promise<string> {
    const tenant = await this.resolvePublicTenant(slug);
    const item = await this.resolvePublishedByToken(tenant.id, shareToken);
    const gespeicherterPfad = variante === 'vorher' ? item.vorherPfad : item.nachherPfad;
    const abs = this.resolveTenantFile(tenant.id, gespeicherterPfad);
    if (!abs || !existsSync(abs)) {
      throw new NotFoundException('Bild nicht gefunden');
    }
    return abs;
  }

  /** Minimaler Content-Type aus der Dateiendung (PNG/JPG/WebP). */
  contentType(pfad: string): string {
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

  // ===========================================================================
  // Interne Helfer
  // ===========================================================================

  /**
   * Loest den Betrieb per Slug auf UND prueft das Tarif-Feature. Unbekannt/
   * inaktiv ODER Feature fehlt -> 404 (gleiche Antwort, kein Orakel). Das Gate
   * liegt bewusst HIER, damit ALLE oeffentlichen Pfade (Galerie/Einzel/Bild)
   * dieselbe Regel teilen.
   */
  private async resolvePublicTenant(slug: string): Promise<Tenant> {
    const clean = (slug || '').trim();
    if (!clean) throw new NotFoundException('Betrieb nicht gefunden');
    const tenant = await this.tenantRepo.findOne({
      where: { slug: clean },
      select: ['id', 'name', 'logoUrl', 'status'],
    });
    if (!tenant || tenant.status === TenantStatus.INACTIVE) {
      throw new NotFoundException('Betrieb nicht gefunden');
    }
    const hatFeature = await this.subscriptions.hasFeatureForTenant(
      tenant.id,
      FEATURE_SCHAUFENSTER,
    );
    if (!hatFeature) throw new NotFoundException('Betrieb nicht gefunden');
    return tenant;
  }

  /**
   * Laedt einen VEROEFFENTLICHTEN Eintrag per (tenantId, shareToken). Token-
   * Format wird VOR dem DB-Treffer geprueft (begrenzt Enumeration). Unbekannt /
   * zurueckgezogen -> 404. `assertSameTenant` als Defense-in-Depth.
   */
  private async resolvePublishedByToken(
    tenantId: string,
    shareToken: string,
  ): Promise<ShowcaseItem> {
    const clean = (shareToken || '').trim();
    if (!/^[a-f0-9]{32,64}$/.test(clean)) {
      throw new NotFoundException('Eintrag nicht gefunden');
    }
    const item = await this.repo.findOne({
      where: { shareToken: clean, tenantId, veroeffentlicht: true },
    });
    if (!item) throw new NotFoundException('Eintrag nicht gefunden');
    assertSameTenant({ tenantId } as AuthUser, item.tenantId);
    return item;
  }

  /** Nicht-erratbares Freigabe-Token (randomBytes(24) hex -> 48 Zeichen). */
  private makeShareToken(): string {
    return randomBytes(24).toString('hex');
  }

  /** Betreiber-Projektion (interne + Bild-Endpunkt-Pfade). */
  private toOperatorView(i: ShowcaseItem): ShowcaseItemView {
    return {
      id: i.id,
      titel: i.titel,
      beschreibung: i.beschreibung ?? null,
      gewerk: i.gewerk,
      veroeffentlicht: i.veroeffentlicht,
      shareToken: i.shareToken ?? null,
      reihenfolge: i.reihenfolge ?? null,
      kundeEinverstaendnis: i.kundeEinverstaendnis,
      einverstaendnisAm: i.einverstaendnisAm ? new Date(i.einverstaendnisAm).toISOString() : null,
      // Betreiber-Vorschau nutzt den GUARD-geschuetzten, tenant-scoped Bild-
      // Endpunkt (AuthedImage) – funktioniert AUCH fuer noch unveroeffentlichte
      // Eintraege (dann gibt es kein shareToken/keinen Public-Endpunkt).
      bildVorher: `/schaufenster/${i.id}/bild/vorher`,
      bildNachher: `/schaufenster/${i.id}/bild/nachher`,
      createdAt: new Date(i.createdAt).toISOString(),
      updatedAt: new Date(i.updatedAt).toISOString(),
    };
  }

  /** Oeffentliche Projektion – strikt PII-frei (Whitelist). */
  private toPublicView(slug: string, i: ShowcaseItem): PublicShowcaseItem {
    return {
      shareToken: i.shareToken as string,
      titel: i.titel,
      beschreibung: i.beschreibung ?? null,
      gewerk: i.gewerk,
      bildVorher: this.publicBildPfad(slug, i.shareToken as string, 'vorher'),
      bildNachher: this.publicBildPfad(slug, i.shareToken as string, 'nachher'),
    };
  }

  /** API-Pfad (relativ zu /api/v1) des oeffentlichen, token-scoped Bild-Endpunkts. */
  private publicBildPfad(
    slug: string,
    shareToken: string,
    variante: ShowcaseBildVariante,
  ): string {
    return `/public/schaufenster/${encodeURIComponent(slug)}/${shareToken}/bild/${variante}`;
  }

  /**
   * Schreibt eine Bild-Data-URL als EIGENE Kopie unter
   * private-uploads/schaufenster/<tenantId>/<uuid>.<ext>. Validiert Format +
   * Magic-Bytes + Groesse (Muster wie Inspektion/Orders-Foto-Upload). Dieses
   * Verzeichnis ist NICHT statisch gemountet.
   */
  private async speichereBild(tenantId: string, datenUrl: string): Promise<string> {
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(datenUrl ?? '');
    if (!match) {
      throw new BadRequestException('Ungueltiges Bildformat (nur PNG/JPG/WebP als Data-URL).');
    }
    const endung = match[1] === 'jpeg' ? 'jpg' : match[1];
    const inhalt = Buffer.from(match[2], 'base64');
    if (inhalt.byteLength > 8 * 1024 * 1024) {
      throw new BadRequestException('Bild zu gross (max. 8 MB).');
    }
    const passt =
      (match[1] === 'png' &&
        inhalt.length >= 8 &&
        inhalt.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (match[1] === 'jpeg' &&
        inhalt.length >= 3 &&
        inhalt[0] === 0xff &&
        inhalt[1] === 0xd8 &&
        inhalt[2] === 0xff) ||
      (match[1] === 'webp' &&
        inhalt.length >= 12 &&
        inhalt.subarray(0, 4).toString('latin1') === 'RIFF' &&
        inhalt.subarray(8, 12).toString('latin1') === 'WEBP');
    if (!passt) {
      throw new BadRequestException('Bilddaten passen nicht zum angegebenen Format.');
    }
    const dateiname = `${randomUUID()}.${endung}`;
    // Ablage ueber den Storage-Adapter (privater Bucket = private-uploads/,
    // NICHT statisch gemountet). Tenant-Ordner fuer physische Trennung.
    await storage.put('private', `schaufenster/${tenantId}/${dateiname}`, inhalt);
    return `/private-uploads/schaufenster/${tenantId}/${dateiname}`;
  }

  /** Loescht eine Bild-Kopie best-effort (traversal-sicher, blockiert nie). */
  private async loescheDatei(tenantId: string, gespeicherterPfad: string): Promise<void> {
    const dateiname = basename(gespeicherterPfad ?? '');
    if (!dateiname) return;
    const key = `schaufenster/${tenantId}/${dateiname}`;
    try {
      if (await storage.exists('private', key)) await storage.delete('private', key);
    } catch (e) {
      this.logger.warn(`Schaufenster-Bild-Loeschung fehlgeschlagen: ${(e as Error).message}`);
    }
  }

  /**
   * Loest den Disk-Pfad STRENG innerhalb von private-uploads/schaufenster/<tenantId>/
   * auf. Es wird NUR der Dateiname (basename) des gespeicherten Pfads verwendet,
   * damit ein manipulierter DB-Wert oder ein ../-Segment nicht aus dem Tenant-
   * Ordner ausbrechen kann. Praefix-Check inkl. Trenner. Liefert null, wenn
   * ausserhalb (identisches Muster wie InspectionPhotoController.resolveTenantFile).
   */
  private resolveTenantFile(tenantId: string, gespeicherterPfad: string): string | null {
    return resolveShowcaseFile(tenantId, gespeicherterPfad);
  }
}
