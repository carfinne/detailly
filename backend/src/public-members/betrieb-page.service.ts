import { Injectable, Logger, Optional } from '@nestjs/common';

import { PublicMembersService } from './public-members.service';
import {
  renderBetriebPageHtml,
  render404Html,
  renderBetriebeSitemapXml,
  isValidSlug,
  MAX_SITEMAP_URLS,
} from './betrieb-page.render';

/** Ergebnis eines Seiten-Renderings: HTTP-Status + fertiges HTML. */
export interface BetriebPageResult {
  status: 200 | 404;
  html: string;
}

/** TTL des In-Memory-Caches: 5 Minuten (deckt sich mit max-age=300 der Liste). */
export const BETRIEB_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Harte Obergrenze der Cache-Eintraege (Defense-in-Depth gegen Memory-DoS). Nur
 * ERFOLGREICHE Renders (200) + die Sitemap landen im Cache; 404 werden bewusst NIE
 * gecacht (sonst koennte ein Angreifer mit Millionen eindeutiger Slugs den Cache
 * unbegrenzt aufblaehen). Der Positiv-Cache ist durch die Zahl echter Betriebe
 * ohnehin begrenzt – diese Deckelung mit LRU-Verdraengung ist die zusaetzliche
 * Absicherung, falls doch einmal sehr viele verschiedene GUELTIGE Seiten laufen.
 */
export const BETRIEB_PAGE_CACHE_MAX_ENTRIES = 5000;

interface CacheEintrag<T> {
  wert: T;
  gueltigBis: number;
}

/**
 * Orchestriert die oeffentlichen Betriebs-Einzelseiten und die Betriebs-Sitemap:
 * Slug-Validierung -> DB-Lookup (PublicMembersService) -> reines Rendern
 * (betrieb-page.render) mit einem KURZEN, GEDECKELTEN In-Memory-Cache (~5 min).
 * Der Cache schuetzt die DB vor Crawler-Last und deckt sich mit dem bestehenden
 * max-age=300 der Mitgliederliste.
 *
 * Memory-DoS-Haertung (HIGH-1):
 *  1. Ungueltige Slugs (`../`, Grossbuchstaben, >80 Zeichen, Sonderzeichen) -> 404
 *     OHNE DB-Query und OHNE Cache-Eintrag (isValidSlug, vor allem anderen).
 *  2. 404/Negativ-Ergebnisse werden NIE gecacht -> der unbegrenzt-wachsende
 *     Vektor (Millionen eindeutiger Miss-Slugs) ist damit weg. Ein 404 ist ein
 *     billiger, indizierter Slug-Gleichheits-Lookup.
 *  3. Positiv-Cache hart gedeckelt (BETRIEB_PAGE_CACHE_MAX_ENTRIES) + LRU-Verdraengung.
 * Die eigentliche Anfragen-Drosselung (429) liegt als schlanke Roh-Middleware VOR
 * den Routen (common/http/fixed-window-rate-limiter) – der Nest-ThrottlerGuard
 * greift fuer Roh-Express-Routen in main.ts NICHT.
 *
 * BEWUSST ein Nest-Provider (kein Code in main.ts): so ist die Cache-/Lookup-/
 * Render-Orchestrierung voll unit-testbar (gemockter PublicMembersService), und
 * die Bootstrap-Datei main.ts bleibt ein duenner Adapter (get(service) -> send).
 *
 * Ehrliche Grenze der Frische: ein neu freigeschalteter/abgemeldeter Betrieb
 * erscheint/verschwindet mit bis zu ~5 min Verzoegerung (Cache-TTL) – derselbe
 * Kompromiss wie beim Listen-Cache. Zeit wird ueber `now()` injizierbar gehalten.
 */
@Injectable()
export class BetriebPageService {
  private readonly logger = new Logger(BetriebPageService.name);
  private readonly cache = new Map<string, CacheEintrag<unknown>>();

  constructor(
    private readonly members: PublicMembersService,
    /**
     * Zeitquelle (in Tests injizierbar, damit TTL/Cache deterministisch testbar).
     * `@Optional()`: Nest kann einen Funktions-Typ nicht als Provider aufloesen ->
     * im DI-Container bleibt der Parameter undefined und der Default (Date.now)
     * greift; Unit-Tests uebergeben eine kontrollierte Uhr direkt an `new(...)`.
     */
    @Optional() private readonly now: () => number = () => Date.now(),
    /** Max. Cache-Eintraege (in Tests klein setzbar, um die Verdraengung zu pruefen). */
    @Optional() private readonly maxEntries: number = BETRIEB_PAGE_CACHE_MAX_ENTRIES,
  ) {}

  /**
   * Liefert die fertige HTML-Seite fuer einen Slug (Status 200) oder eine saubere
   * 404-Seite. Reihenfolge (Memory-DoS-Haertung): (1) Slug-Format pruefen -> bei
   * Muell sofort 404, ohne DB/Cache; (2) Positiv-Cache lesen; (3) DB-Lookup;
   * (4) NUR ein 200 wird gecacht. `baseUrl` fliesst in den Cache-Key ein, damit ein
   * ENV-/Host-Wechsel nie eine Seite mit falscher canonical-/OG-URL ausliefert.
   */
  async renderSlug(slug: string, baseUrl: string): Promise<BetriebPageResult> {
    // (1) Streng validieren BEVOR DB oder Cache beruehrt werden.
    if (!isValidSlug(slug)) {
      return { status: 404, html: render404Html({ baseUrl }) };
    }

    // (2) Nur erfolgreiche (200) Seiten liegen ueberhaupt im Cache.
    const key = `page:${baseUrl}:${slug}`;
    const cached = this.lese<BetriebPageResult>(key);
    if (cached) return cached;

    // (3) DB-Lookup (Opt-in + active/pilot; sonst null).
    const mitglied = await this.members.findePublicBySlug(slug);
    if (!mitglied) {
      // (4a) 404 NICHT cachen -> kein unbegrenzt wachsender Negativ-Cache.
      return { status: 404, html: render404Html({ baseUrl }) };
    }

    // (4b) Nur den Erfolg cachen (gedeckelt + LRU).
    const result: BetriebPageResult = { status: 200, html: renderBetriebPageHtml(mitglied, { baseUrl }) };
    this.schreibe(key, result);
    return result;
  }

  /**
   * Liefert die dynamische Betriebs-Sitemap (alle live sichtbaren /betrieb/<slug>/)
   * als XML-String, ~5 min gecacht. Kappt defensiv auf MAX_SITEMAP_URLS und loggt
   * die Kappung (statt still abzuschneiden).
   */
  async renderSitemap(baseUrl: string): Promise<string> {
    const key = `sitemap:${baseUrl}`;
    const cached = this.lese<string>(key);
    if (cached) return cached;

    const alle = await this.members.listeSlugsFuerSitemap();
    let slugs = alle;
    if (alle.length > MAX_SITEMAP_URLS) {
      this.logger.warn(
        `Betriebs-Sitemap gekappt: ${alle.length} URLs > Limit ${MAX_SITEMAP_URLS}. ` +
          'Nur die ersten Eintraege werden ausgeliefert (ggf. Sitemap-Index einfuehren).',
      );
      slugs = alle.slice(0, MAX_SITEMAP_URLS);
    }
    const xml = renderBetriebeSitemapXml(slugs, { baseUrl });
    this.schreibe(key, xml);
    return xml;
  }

  /** Aktuelle Cache-Groesse (fuer Tests der Memory-Haertung). */
  get cacheSize(): number {
    return this.cache.size;
  }

  /**
   * Leert den gesamten Seiten-/Sitemap-Cache SOFORT. Wird nach einer Aenderung am
   * oeffentlichen Auftritt eines Betriebs aufgerufen (Karten-/Kontaktdaten-Opt-in
   * oder Stammdaten wie Adresse/Telefon), damit insbesondere ein WIDERRUF der
   * Kontaktdaten-Einwilligung sofort wirkt – statt erst nach der 5-min-TTL noch bis
   * zu ~5 min alte PII (Adresse/Telefon) auszuliefern. Profil-Aenderungen sind selten
   * und der Positiv-Cache ist klein, daher ist ein vollstaendiges Leeren unkritisch
   * (die naechste Anfrage rendert frisch aus der DB). Die 5-min-TTL bleibt als
   * garantierte Obergrenze bestehen (Defense-in-Depth).
   */
  leereCache(): void {
    this.cache.clear();
  }

  /** Liest aus dem Cache; abgelaufene Eintraege werden entfernt. LRU: Treffer ans Ende. */
  private lese<T>(key: string): T | null {
    const e = this.cache.get(key);
    if (!e) return null;
    if (this.now() >= e.gueltigBis) {
      this.cache.delete(key);
      return null;
    }
    // LRU: bei Zugriff ans Ende schieben (juengste zuletzt -> aeltester zuerst verdraengt).
    this.cache.delete(key);
    this.cache.set(key, e);
    return e.wert as T;
  }

  /** Schreibt in den Cache; verdraengt bei Ueberschreiten des Maximums LRU-artig. */
  private schreibe<T>(key: string, wert: T): void {
    // Falls bereits vorhanden: alten Eintrag entfernen (Neu-Einfuegen ans Ende).
    this.cache.delete(key);
    // Deckelung: solange voll, den aeltesten (ersten) Eintrag verdraengen.
    while (this.cache.size >= this.maxEntries) {
      const aeltester = this.cache.keys().next().value;
      if (aeltester === undefined) break;
      this.cache.delete(aeltester);
    }
    this.cache.set(key, { wert, gueltigBis: this.now() + BETRIEB_PAGE_CACHE_TTL_MS });
  }
}
