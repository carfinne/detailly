import { Injectable, Optional } from '@nestjs/common';

import { PublicMembersService } from './public-members.service';
import {
  renderBetriebPageHtml,
  render404Html,
  renderBetriebeSitemapXml,
} from './betrieb-page.render';

/** Ergebnis eines Seiten-Renderings: HTTP-Status + fertiges HTML. */
export interface BetriebPageResult {
  status: 200 | 404;
  html: string;
}

/** TTL des In-Memory-Caches: 5 Minuten (deckt sich mit max-age=300 der Liste). */
export const BETRIEB_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEintrag<T> {
  wert: T;
  gueltigBis: number;
}

/**
 * Orchestriert die oeffentlichen Betriebs-Einzelseiten und die Betriebs-Sitemap:
 * DB-Lookup (PublicMembersService) -> reines Rendern (betrieb-page.render) mit
 * einem KURZEN In-Memory-Cache (~5 min). Der Cache schuetzt die DB vor
 * Crawler-Last und deckt sich mit dem bestehenden max-age=300 der Mitgliederliste.
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
  ) {}

  /**
   * Liefert die fertige HTML-Seite fuer einen Slug (Status 200) oder eine saubere
   * 404-Seite. Ergebnis (200 UND 404) wird ~5 min gecacht: ein Slug-Spam trifft
   * die DB nicht wiederholt, ein neuer Betrieb erscheint innerhalb der TTL.
   * `baseUrl` fliesst in den Cache-Key ein, damit ein ENV-/Host-Wechsel nie eine
   * Seite mit falscher canonical-/OG-URL aus dem Cache liefert.
   */
  async renderSlug(slug: string, baseUrl: string): Promise<BetriebPageResult> {
    const key = `page:${baseUrl}:${slug}`;
    const cached = this.lese<BetriebPageResult>(key);
    if (cached) return cached;

    const mitglied = await this.members.findePublicBySlug(slug);
    const result: BetriebPageResult = mitglied
      ? { status: 200, html: renderBetriebPageHtml(mitglied, { baseUrl }) }
      : { status: 404, html: render404Html({ baseUrl }) };

    this.schreibe(key, result);
    return result;
  }

  /**
   * Liefert die dynamische Betriebs-Sitemap (alle live sichtbaren /betrieb/<slug>/)
   * als XML-String, ~5 min gecacht.
   */
  async renderSitemap(baseUrl: string): Promise<string> {
    const key = `sitemap:${baseUrl}`;
    const cached = this.lese<string>(key);
    if (cached) return cached;

    const slugs = await this.members.listeSlugsFuerSitemap();
    const xml = renderBetriebeSitemapXml(slugs, { baseUrl });
    this.schreibe(key, xml);
    return xml;
  }

  private lese<T>(key: string): T | null {
    const e = this.cache.get(key);
    if (!e) return null;
    if (this.now() >= e.gueltigBis) {
      this.cache.delete(key);
      return null;
    }
    return e.wert as T;
  }

  private schreibe<T>(key: string, wert: T): void {
    this.cache.set(key, { wert, gueltigBis: this.now() + BETRIEB_PAGE_CACHE_TTL_MS });
  }
}
