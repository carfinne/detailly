import { Injectable, Logger, Optional } from '@nestjs/common';

import { PublicMembersService } from './public-members.service';
import { BETRIEB_PAGE_CACHE_TTL_MS } from './betrieb-page.service';
import {
  gruppiereNachOrt,
  renderOrtsPageHtml,
  renderOrts404Html,
  renderOrtsSitemapXml,
  MAX_SITEMAP_URLS,
  type OrtsGruppe,
} from './orts-page.render';
import { isValidGewerk, isValidCitySlug, ortGruppeKey } from './orts-slug';

/** Ergebnis eines Ortsseiten-Renderings: HTTP-Status + fertiges HTML. */
export interface OrtsPageResult {
  status: 200 | 404;
  html: string;
}

/**
 * Orchestriert die oeffentlichen Orts-/Kategorieseiten ("<Gewerk> in <Ort>") und die
 * Orts-Sitemap: harte Parameter-Validierung -> (gecachte) Gruppierung -> reines
 * Rendern (orts-page.render). Baut auf EXAKT denselben gehaerteten Bausteinen wie
 * Paket 1 auf – hier bewusst als eigener, voll unit-testbarer Provider (main.ts holt
 * ihn per app.get() als duennen Adapter, keine Logik im Bootstrap).
 *
 * CACHE-DESIGN (bewusst anders, aber staerker als der Per-Seite-Cache von Paket 1):
 * Gecacht wird EINE Struktur – die komplette Gruppierung Map<key, OrtsGruppe> (~5 min
 * TTL, wie Liste/Sitemap). Daraus wird jede einzelne Ortsseite request-time billig
 * gerendert. Vorteile fuer die Memory-DoS-Haertung (die Lehre aus dem Paket-1-Gate):
 *  1. Ungueltiges Gewerk/citySlug (`../`, Grossbuchstaben, Sonderzeichen, unbekanntes
 *     Gewerk) -> 404 SOFORT, OHNE Gruppierung/DB/Cache (isValidGewerk + isValidCitySlug
 *     vor allem anderen) – exakt Paket-1-Regel "Muell sofort 404 ohne Arbeit".
 *  2. Ein Fehltreffer (gueltiges Format, aber keine Betriebe) erzeugt KEINEN
 *     Cache-Eintrag – es gibt gar keinen Negativ-Cache. Millionen eindeutiger
 *     Miss-citySlugs teilen sich die EINE gecachte Gruppierung (kein Wachstum) und
 *     loesen dank Cache nicht einmal je eine DB-Query aus. cacheSize bleibt <=1.
 *  3. Die Gruppierung selbst ist durch die Zahl echter (sichtbarer, opt-in) Betriebe
 *     begrenzt (jeder erzeugt <=3 Gruppen) – keine unbegrenzt wachsende Struktur.
 * Der Gruppierungs-Cache ist baseUrl-UNABHAENGIG (er haelt reine Betriebsdaten +
 * citySlug, KEINE URLs) – Basis-URLs werden erst beim Rendern injiziert; ein ENV-/
 * Host-Wechsel kann daher nie eine falsche canonical-/OG-URL ausliefern.
 *
 * Die Anfragen-Drosselung (429) liegt – wie bei /betrieb – als schlanke Roh-Middleware
 * VOR der Route (createRateLimitMiddleware in main.ts).
 */
@Injectable()
export class OrtsPageService {
  private readonly logger = new Logger(OrtsPageService.name);
  private cache: { wert: Map<string, OrtsGruppe>; gueltigBis: number } | null = null;

  constructor(
    private readonly members: PublicMembersService,
    /**
     * Zeitquelle (in Tests injizierbar). `@Optional()`: Nest kann einen Funktions-Typ
     * nicht als Provider aufloesen -> Default (Date.now) greift; Tests uebergeben eine
     * kontrollierte Uhr direkt an `new(...)`.
     */
    @Optional() private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Liefert die fertige HTML-Seite fuer (gewerk, citySlug) (Status 200) oder eine
   * saubere 404-Seite. Reihenfolge (Memory-DoS-Haertung): (1) Gewerk gegen die feste
   * Whitelist + citySlug-Format pruefen -> bei Muell sofort 404 OHNE Gruppierung/DB;
   * (2) (gecachte) Gruppierung holen; (3) Gruppe nachschlagen; nur eine Gruppe mit
   * >=1 Betrieb ergibt 200, sonst 404 (ohne jeden Cache-Eintrag).
   */
  async renderPage(gewerk: string, citySlug: string, baseUrl: string): Promise<OrtsPageResult> {
    // (1) Streng validieren BEVOR Gruppierung/DB/Cache beruehrt werden.
    if (!isValidGewerk(gewerk) || !isValidCitySlug(citySlug)) {
      return { status: 404, html: renderOrts404Html({ baseUrl }) };
    }

    // (2) Gruppierung (eine gecachte, gedeckelte Struktur).
    const gruppen = await this.ladeGruppen();

    // (3) Nur eine Gruppe mit >=1 Betrieb ergibt eine echte Seite.
    const gruppe = gruppen.get(ortGruppeKey(gewerk, citySlug));
    if (!gruppe || gruppe.betriebe.length === 0) {
      return { status: 404, html: renderOrts404Html({ baseUrl }) };
    }

    return { status: 200, html: renderOrtsPageHtml(gruppe, { baseUrl }) };
  }

  /**
   * Liefert die dynamische Orts-Sitemap (alle (gewerk, citySlug)-Seiten mit >=1
   * sichtbarem Betrieb) als XML-String. Nutzt DIESELBE gecachte Gruppierung wie die
   * Seiten. Kappt defensiv auf MAX_SITEMAP_URLS und loggt die Kappung (statt still
   * abzuschneiden) – identisch zur Betriebs-Sitemap.
   */
  async renderSitemap(baseUrl: string): Promise<string> {
    const gruppen = await this.ladeGruppen();
    let eintraege = [...gruppen.values()].map((g) => ({ gewerk: g.gewerk, citySlug: g.citySlug }));
    if (eintraege.length > MAX_SITEMAP_URLS) {
      this.logger.warn(
        `Orts-Sitemap gekappt: ${eintraege.length} URLs > Limit ${MAX_SITEMAP_URLS}. ` +
          'Nur die ersten Eintraege werden ausgeliefert (ggf. Sitemap-Index einfuehren).',
      );
      eintraege = eintraege.slice(0, MAX_SITEMAP_URLS);
    }
    return renderOrtsSitemapXml(eintraege, { baseUrl });
  }

  /** Aktuelle Cache-Groesse (0 oder 1) – fuer Tests der Memory-Haertung. */
  get cacheSize(): number {
    return this.cache ? 1 : 0;
  }

  /**
   * Holt die (gecachte) Gruppierung. Nur GUELTIGE, positive Daten landen im Cache
   * (eine einzige Struktur); ein abgelaufener Eintrag wird neu geladen. Quelle sind
   * ausschliesslich die SICHTBAREN opt-in-Betriebe (Wiederverwendung der EINEN
   * Opt-in-Quelle im PublicMembersService) – so verweist eine Ortsseite nie auf eine
   * Betriebs-Einzelseite, die 404 liefert.
   */
  private async ladeGruppen(): Promise<Map<string, OrtsGruppe>> {
    const jetzt = this.now();
    if (this.cache && jetzt < this.cache.gueltigBis) return this.cache.wert;

    const mitglieder = await this.members.ladeSichtbareOptinMitglieder();
    const gruppen = gruppiereNachOrt(mitglieder);
    this.cache = { wert: gruppen, gueltigBis: jetzt + BETRIEB_PAGE_CACHE_TTL_MS };
    return gruppen;
  }
}
