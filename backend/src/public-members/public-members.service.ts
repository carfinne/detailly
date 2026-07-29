import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { Betriebstyp, Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import {
  Subscription,
  OEFFENTLICH_SICHTBARE_ABO_STATUS,
} from '../subscriptions/entities/subscription.entity';
import { initialeAusName, resolveMitgliedProfil } from '../common/mitglied-profil';
import { sanitizeLogoUrl } from '../common/logo-url';
import { SucheMitgliederDto } from './dto/suche-mitglieder.dto';

/**
 * OEFFENTLICH sichtbare Mitglieds-Karte (STRIKTE Whitelist). Enthaelt AUSSCHLIESSLICH
 * zur Veroeffentlichung freigegebene, PII-arme Felder – NIEMALS E-Mail, Adresse,
 * Telefon, interne IDs oder verschluesselte settings.
 */
export interface PublicMitglied {
  firmenname: string;
  /** Ausrichtung (labels.betriebstyp.* im Frontend). */
  betriebstyp: Betriebstyp;
  stadt: string | null;
  kurzbeschreibung: string | null;
  /** Eigene Webseite (nur sicheres http/https-Schema) oder null. */
  webseite: string | null;
  /** Oeffentliches Logo (http/https-URL ODER validiertes data:image-Raster) oder null. */
  logoUrl: string | null;
  /** 1–2-Buchstaben-Monogramm als Fallback, wenn kein Logo vorliegt. */
  initiale: string;
  /**
   * GROBE Leitregion (erste 2 Ziffern der PLZ, z. B. "10" fuer Berlin) – bewusst
   * NIE die volle PLZ/Adresse. Nur gesetzt, wenn der Betrieb (a) der Anzeige
   * zugestimmt hat UND (b) ein oeffentlich sichtbares Abo hat (active ODER pilot –
   * OEFFENTLICH_SICHTBARE_ABO_STATUS, nicht trial). Sonst `null`. Es gibt bewusst
   * KEIN oeffentliches `zahlend`-Flag – der sichtbare Status wird ausschliesslich
   * implizit ueber das Vorhandensein von `plzRegion` sichtbar. Die Karte plottet
   * nur Eintraege mit `plzRegion`.
   */
  plzRegion: string | null;
}

/**
 * EINE Seite der oeffentlichen Betriebs-Suche (paginierte Teilmenge von
 * PublicMitglied). Enthaelt AUSSCHLIESSLICH dieselbe PII-arme Whitelist wie die
 * Mitgliederliste plus reine Pagination-Metadaten (keine zusaetzlichen Felder).
 */
export interface PublicMitgliederSeite {
  items: PublicMitglied[];
  /** Gesamtzahl der Treffer (VOR Pagination) – fuer Seiten-Anzeige/„keine Treffer". */
  total: number;
  page: number;
  pageSize: number;
}

/** Default-/Max-Seitengroesse der oeffentlichen Suche (deckt sich mit dem DTO). */
const SUCHE_PAGE_SIZE_DEFAULT = 12;
const SUCHE_PAGE_SIZE_MAX = 48;

/**
 * Normalisiert einen Suchtext fuer den Vergleich: klein, getrimmt und
 * diakritik-tolerant (verbreitete deutsche Umlaute werden gefaltet). So matcht
 * "muenchen" auch "Muenchen"/"Munchen". Rein/serverseitig, kein PII. Bewusst
 * ASCII-only im Quelltext (keine kombinierenden Zeichen), robust ueber Tools.
 */
function normalize(v: string | null | undefined): string {
  return (v ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

/**
 * Grobe Leitregion aus einer PLZ: die ersten 2 Ziffern, aber NUR wenn die PLZ mit
 * (mindestens) 2 Ziffern beginnt – sonst null. Bewusst datensparsam: es verlaesst
 * NIE die volle PLZ das Backend, nur die 2-stellige Leitregion.
 */
function plzRegionAusPostalCode(postalCode: string | null | undefined): string | null {
  const treffer = /^(\d{2})/.exec((postalCode ?? '').trim());
  return treffer ? treffer[1] : null;
}

@Injectable()
export class PublicMembersService {
  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  /**
   * Liefert plattformweit ALLE Betriebe, die der oeffentlichen Anzeige zugestimmt
   * haben (`settings.mitgliedProfil.zeigen === true`). BEWUSST OHNE Tenant-Scope –
   * das ist ein oeffentliches, tenant-neutrales Verzeichnis; es fliessen aber NUR
   * die vom jeweiligen Betrieb selbst freigegebenen, PII-armen Felder nach aussen
   * (strikte Whitelist in `PublicMitglied`), nie sensible/andere Tenant-Daten.
   *
   * WICHTIG: `settings` ist verschluesseltes JSON (nicht SQL-durchsuchbar), daher
   * wird der `zeigen`-Filter in der Anwendung ausgewertet (Muster wie
   * PublicBookingService). Inaktive Betriebe werden ausgeschlossen. Die Sortierung
   * ist deterministisch (Name), damit die Antwort cache-freundlich stabil bleibt.
   */
  async listMitglieder(): Promise<PublicMitglied[]> {
    return this.ladeOptinMitglieder();
  }

  /**
   * OEFFENTLICHE, paginierte Betriebs-Suche auf GENAU derselben Opt-in-Menge und
   * Whitelist wie die Mitgliederliste (Wiederverwendung von `ladeOptinMitglieder`,
   * KEINE Duplikation der Sicherheits-/Whitelist-Logik). Filtert rein IN-MEMORY –
   * das ist noetig, weil `settings` (Opt-in) verschluesselt und nicht SQL-suchbar
   * ist; die Ausgabe ist ueber Pagination begrenzt.
   *
   * Filter (alle optional, additiv):
   *  - `q`          Freitext auf Firmenname ODER Ort (case-/umlaut-tolerant).
   *  - `plzRegion`  exakte 2-stellige Leitregion (nur Betriebe mit sichtbarem Abo
   *                 haben ueberhaupt eine `plzRegion`).
   *  - `betriebstyp` exaktes Gewerk (bereits oeffentliches Feld).
   *
   * Liefert IMMER dieselbe PII-arme Whitelist plus Pagination-Metadaten. Widerruft
   * ein Betrieb sein Opt-in (`zeigen=false`), verschwindet er hier sofort mit –
   * dieselbe EINE Opt-in-Quelle wie Karte und Liste.
   */
  async sucheMitglieder(dto: SucheMitgliederDto): Promise<PublicMitgliederSeite> {
    const alle = await this.ladeOptinMitglieder();

    const q = normalize(dto.q);
    const region = dto.plzRegion?.trim();
    const typ = dto.betriebstyp;

    const treffer = alle.filter((m) => {
      if (q && !(normalize(m.firmenname).includes(q) || normalize(m.stadt).includes(q))) return false;
      if (region && m.plzRegion !== region) return false;
      if (typ && m.betriebstyp !== typ) return false;
      return true;
    });

    const total = treffer.length;
    const pageSize = clampInt(dto.pageSize, SUCHE_PAGE_SIZE_DEFAULT, 1, SUCHE_PAGE_SIZE_MAX);
    // Seite defensiv begrenzen: eine zu hohe Seite liefert eine leere Liste, keinen Fehler.
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(clampInt(dto.page, 1, 1, Number.MAX_SAFE_INTEGER), maxPage);
    const start = (page - 1) * pageSize;
    const items = treffer.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  /**
   * Gemeinsamer Kern von Liste UND Suche: baut die PII-arme Whitelist aller
   * zustimmenden Betriebe. `plzRegion` NUR fuer Betriebe mit oeffentlich sichtbarem
   * Abo (active ODER pilot – OEFFENTLICH_SICHTBARE_ABO_STATUS), sonst null. So
   * zeigen Karte, Liste und Suche exakt dieselbe Betriebs-Menge.
   */
  private async ladeOptinMitglieder(): Promise<PublicMitglied[]> {
    const tenants = await this.tenantRepo.find({
      where: { status: Not(TenantStatus.INACTIVE) },
      // Nur die serverseitig benoetigten Felder. `settings` wird zum Entschluesseln/
      // Filtern gebraucht, `postalCode` NUR zur Ableitung der 2-stelligen Leitregion –
      // beide verlassen das Backend NIE im Rohzustand (keine volle PLZ/Adresse).
      select: ['id', 'name', 'betriebstyp', 'logoUrl', 'postalCode', 'settings'],
      order: { name: 'ASC' },
    });

    // Erst die Opt-in-Betriebe herausfiltern; nur fuer diese wird der Abo-Status gebraucht.
    const optin = tenants.filter((t) => {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      return resolveMitgliedProfil(s.mitgliedProfil).zeigen;
    });

    // Oeffentlich sichtbare (active ODER pilot) Tenants BATCH laden (ein einziges find
    // mit tenantId IN (...), kein N+1). Nur die zwei benoetigten Spalten. Leere Liste
    // -> gar keine Query.
    const sichtbar = new Set<string>();
    if (optin.length > 0) {
      const subs = await this.subscriptionRepo.find({
        where: {
          tenantId: In(optin.map((t) => t.id)),
          status: In([...OEFFENTLICH_SICHTBARE_ABO_STATUS]),
        },
        select: ['tenantId', 'status'],
      });
      for (const sub of subs) sichtbar.add(sub.tenantId);
    }

    return optin.map((t) => {
      const s = (t.settings ?? {}) as Record<string, unknown>;
      const profil = resolveMitgliedProfil(s.mitgliedProfil);
      return {
        firmenname: t.name,
        betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
        stadt: profil.stadt || null,
        kurzbeschreibung: profil.kurzbeschreibung || null,
        webseite: profil.webseite || null,
        logoUrl: sanitizeLogoUrl(t.logoUrl),
        initiale: initialeAusName(t.name),
        // Leitregion NUR fuer Betriebe mit sichtbarem Abo (active/pilot) – sonst null.
        plzRegion: sichtbar.has(t.id) ? plzRegionAusPostalCode(t.postalCode) : null,
      };
    });
  }
}

/**
 * Kappt eine (moeglicherweise fehlende) Ganzzahl defensiv auf [min, max] und
 * faellt bei fehlendem/kaputtem Wert auf `fallback` zurueck. Rein/serverseitig.
 */
function clampInt(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(Math.max(n, min), max);
}
