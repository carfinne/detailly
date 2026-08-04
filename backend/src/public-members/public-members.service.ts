import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';

import { Betriebstyp, Tenant, TenantStatus } from '../tenants/entities/tenant.entity';
import {
  Subscription,
  OEFFENTLICH_SICHTBARE_ABO_STATUS,
} from '../subscriptions/entities/subscription.entity';
import {
  initialeAusName,
  resolveMitgliedProfil,
  type MitgliedProfilConfig,
} from '../common/mitglied-profil';
import { sanitizeLogoUrl } from '../common/logo-url';
import { SucheMitgliederDto } from './dto/suche-mitglieder.dto';

/**
 * VOLLE Kontaktdaten eines Betriebs fuer den Google-Kartentreffer (PostalAddress +
 * Telefon). Verlaesst das Backend NUR, wenn der Betrieb (a) die SEPARATE Kontakt-
 * daten-Einwilligung (settings.mitgliedProfil.kontaktdatenZeigen) gesetzt hat UND
 * (b) ein oeffentlich sichtbares Abo (active/pilot) hat – dieselbe Schranke wie die
 * Leitregion (plzRegion).
 *
 * DATENQUELLE (bewusste Entscheidung): Alle Adress-Komponenten stammen aus den
 * ECHTEN Stammdaten-Spalten des Tenants (street/postalCode/city/country) – NICHT aus
 * dem Freitext `mitgliedProfil.stadt`. Nur so passen Strasse, komplette PLZ und Ort
 * garantiert ZUSAMMEN (konsistente, kartenfaehige Adresse); eine Mischung aus
 * Freitext-Stadt und echter Strasse waere inkonsistent und schadet dem Kartentreffer
 * mehr als sie nuetzt. Der Freitext `stadt` steuert weiterhin NUR Ueberschrift/Orts-
 * gruppierung (unveraendert), nie die PostalAddress.
 */
export interface PublicKontakt {
  /** Strasse + Hausnummer (tenant.street) oder null. */
  strasse: string | null;
  /** Vollstaendige PLZ (tenant.postalCode) oder null – hier bewusst KOMPLETT. */
  plz: string | null;
  /** Ort (tenant.city, NICHT der Freitext mitgliedProfil.stadt) oder null. */
  ort: string | null;
  /** Land-Code (tenant.country, z. B. "DE") oder null. */
  land: string | null;
  /** Telefonnummer (tenant.phone) oder null. */
  telefon: string | null;
}

/**
 * OEFFENTLICH sichtbare Mitglieds-Karte (STRIKTE Whitelist). Enthaelt AUSSCHLIESSLICH
 * zur Veroeffentlichung freigegebene Felder. Standardmaessig PII-arm – NIEMALS
 * E-Mail, interne IDs oder verschluesselte settings. Die VOLLEN Kontaktdaten
 * (`kontakt`) erscheinen NUR bei separater Einwilligung (siehe unten) und fehlen
 * sonst KOMPLETT (kein Feld).
 */
export interface PublicMitglied {
  firmenname: string;
  /**
   * Oeffentlicher, umlautfester URL-Slug (Tenant.slug) – die stabile Kennung der
   * auffindbaren Betriebs-Einzelseite (/betrieb/<slug>). Selbst kein PII (aus dem
   * Firmennamen abgeleitet, bereits Teil der oeffentlichen Seiten-URL).
   */
  slug: string;
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
  /**
   * VOLLE Kontaktdaten (PostalAddress + Telefon) fuer den Google-Kartentreffer.
   * NUR gesetzt, wenn der Betrieb (a) die SEPARATE Kontaktdaten-Einwilligung
   * (kontaktdatenZeigen) erteilt hat UND (b) ein sichtbares Abo (active/pilot) hat.
   * Ohne Einwilligung FEHLT das Feld komplett -> die Ausgabe ist byte-genau so
   * PII-arm wie bisher (kein Feld mehr). Optional per `?`, damit ein fehlendes Opt-in
   * das Feld nicht einmal als `null` in der Antwort erscheinen laesst.
   */
  kontakt?: PublicKontakt;
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
   * Laedt GENAU EINEN Betrieb fuer seine oeffentliche Einzelseite (/betrieb/<slug>)
   * per Slug – oder `null`. Wendet EXAKT dieselben Sicherheitsregeln wie die Liste
   * an (dieselben Helfer, keine Duplikation): (a) Betrieb nicht inaktiv, (b) Opt-in
   * (settings.mitgliedProfil.zeigen === true), (c) oeffentlich sichtbares Abo
   * (active ODER pilot – OEFFENTLICH_SICHTBARE_ABO_STATUS). Faellt eine dieser
   * Bedingungen weg (z. B. Opt-out oder Abo-Ende), gibt es die Seite sofort nicht
   * mehr -> `null` (der Aufrufer liefert 404). Es verlaesst NUR die PII-arme
   * Whitelist (PublicMitglied) das Backend, nie Adresse/Telefon/E-Mail/interne IDs.
   */
  async findePublicBySlug(slug: string): Promise<PublicMitglied | null> {
    const clean = (slug ?? '').trim();
    if (!clean) return null;

    const tenant = await this.tenantRepo.findOne({
      where: { slug: clean, status: Not(TenantStatus.INACTIVE) },
      // Dieselbe Projektion wie die Liste (+ slug); settings wird nur zum
      // Entschluesseln/Filtern geladen, postalCode zur 2-stelligen Leitregion. Die
      // Adress-/Telefon-Spalten (street/city/country/phone) werden geladen, verlassen
      // das Backend aber NUR bei aktiver Kontaktdaten-Einwilligung (zuPublicMitglied).
      select: ['id', 'name', 'slug', 'betriebstyp', 'logoUrl', 'street', 'postalCode', 'city', 'country', 'phone', 'settings'],
    });
    if (!tenant) return null;

    const s = (tenant.settings ?? {}) as Record<string, unknown>;
    const profil = resolveMitgliedProfil(s.mitgliedProfil);
    if (!profil.zeigen) return null; // kein Opt-in -> keine oeffentliche Seite

    // Oeffentlich sichtbares Abo (active/pilot) ist Pflicht fuer eine Einzelseite.
    const sub = await this.subscriptionRepo.findOne({
      where: {
        tenantId: tenant.id,
        status: In([...OEFFENTLICH_SICHTBARE_ABO_STATUS]),
      },
      select: ['tenantId', 'status'],
    });
    if (!sub) return null;

    // sichtbar=true (nur hier erreicht) -> Leitregion darf gesetzt werden.
    return this.zuPublicMitglied(tenant, profil, true);
  }

  /**
   * Slugs aller Betriebe, die eine LIVE oeffentliche Einzelseite haben (Opt-in UND
   * active/pilot) – Basis der dynamischen Betriebs-Sitemap. Nutzt denselben Kern
   * wie Liste/Suche (ladeOptinEintraege), filtert aber strikt auf `sichtbar`, damit
   * die Sitemap NIE auf eine 404-Seite verweist (ein bloss Opt-in-Betrieb ohne
   * sichtbares Abo hat keine Einzelseite).
   */
  async listeSlugsFuerSitemap(): Promise<string[]> {
    const eintraege = await this.ladeOptinEintraege();
    return eintraege.filter((e) => e.sichtbar).map((e) => e.mitglied.slug);
  }

  /**
   * Die PII-arme Whitelist ALLER Betriebe, die eine LIVE oeffentliche Einzelseite
   * haben (Opt-in UND active/pilot) – Basis der Orts-/Kategorieseiten (Paket 2). Nutzt
   * denselben EINEN Opt-in-Kern (ladeOptinEintraege) und filtert strikt auf `sichtbar`
   * wie listeSlugsFuerSitemap. So enthaelt jede Ortsseite ausschliesslich Betriebe mit
   * einer echten Einzelseite -> der interne Link /betrieb/<slug>/ trifft nie auf 404.
   */
  async ladeSichtbareOptinMitglieder(): Promise<PublicMitglied[]> {
    const eintraege = await this.ladeOptinEintraege();
    return eintraege.filter((e) => e.sichtbar).map((e) => e.mitglied);
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
   * Gemeinsamer Kern von Liste UND Suche: die PII-arme Whitelist aller
   * zustimmenden Betriebe. `plzRegion` NUR fuer Betriebe mit oeffentlich sichtbarem
   * Abo (active ODER pilot – OEFFENTLICH_SICHTBARE_ABO_STATUS), sonst null. So
   * zeigen Karte, Liste und Suche exakt dieselbe Betriebs-Menge.
   */
  private async ladeOptinMitglieder(): Promise<PublicMitglied[]> {
    return (await this.ladeOptinEintraege()).map((e) => e.mitglied);
  }

  /**
   * EIN Quell-Kern fuer Liste, Suche UND Sitemap: laedt alle Opt-in-Betriebe als
   * PII-arme Whitelist PLUS je Eintrag ein internes `sichtbar`-Flag (active/pilot).
   * `sichtbar` verlaesst das Backend NIE als Feld (kein oeffentliches „zahlend");
   * es steuert nur (a) die Leitregion (plzRegion) und (b) die Sitemap-Aufnahme.
   * Keine Duplikation der Sicherheitsregeln – dieselben Helfer wie ueberall.
   */
  private async ladeOptinEintraege(): Promise<{ mitglied: PublicMitglied; sichtbar: boolean }[]> {
    const tenants = await this.tenantRepo.find({
      where: { status: Not(TenantStatus.INACTIVE) },
      // Nur die serverseitig benoetigten Felder (+ slug fuer die Einzelseite/Sitemap).
      // `settings` wird zum Entschluesseln/Filtern gebraucht, `postalCode` zur
      // Ableitung der 2-stelligen Leitregion. Die Adress-/Telefon-Spalten
      // (street/city/country/phone) werden geladen, verlassen das Backend aber NUR
      // bei aktiver Kontaktdaten-Einwilligung (zuPublicMitglied); ohne Einwilligung
      // verlaesst nie eine volle PLZ/Adresse das Backend.
      select: ['id', 'name', 'slug', 'betriebstyp', 'logoUrl', 'street', 'postalCode', 'city', 'country', 'phone', 'settings'],
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
      const istSichtbar = sichtbar.has(t.id);
      return { mitglied: this.zuPublicMitglied(t, profil, istSichtbar), sichtbar: istSichtbar };
    });
  }

  /**
   * EINZIGE Stelle, die einen Tenant + aufgeloestes Profil in die oeffentliche
   * PII-arme Whitelist (PublicMitglied) uebersetzt – von Liste/Suche UND der
   * Einzelseite genutzt, damit alle exakt dieselben Felder ausgeben. `sichtbar`
   * (active/pilot) steuert allein, ob die 2-stellige Leitregion gesetzt wird.
   */
  private zuPublicMitglied(
    t: Tenant,
    profil: MitgliedProfilConfig,
    sichtbar: boolean,
  ): PublicMitglied {
    const mitglied: PublicMitglied = {
      firmenname: t.name,
      slug: t.slug,
      betriebstyp: t.betriebstyp ?? Betriebstyp.KOMPLETT,
      stadt: profil.stadt || null,
      kurzbeschreibung: profil.kurzbeschreibung || null,
      webseite: profil.webseite || null,
      logoUrl: sanitizeLogoUrl(t.logoUrl),
      initiale: initialeAusName(t.name),
      // Leitregion NUR fuer Betriebe mit sichtbarem Abo (active/pilot) – sonst null.
      plzRegion: sichtbar ? plzRegionAusPostalCode(t.postalCode) : null,
    };

    // VOLLE Kontaktdaten NUR bei (a) SEPARATER Einwilligung (kontaktdatenZeigen) UND
    // (b) sichtbarem Abo (gleiche Schranke wie plzRegion). Ohne Einwilligung wird das
    // Feld GAR NICHT gesetzt -> die Antwort bleibt byte-genau so PII-arm wie bisher.
    // Adresse ausschliesslich aus den ECHTEN Stammdaten (konsistente PostalAddress).
    if (profil.kontaktdatenZeigen && sichtbar) {
      const kontakt = baueKontakt(t);
      if (kontakt) mitglied.kontakt = kontakt;
    }
    return mitglied;
  }
}

/**
 * Trimmt einen Rohwert; leer -> null. Verhindert, dass leere Adressfelder als
 * "" nach aussen gelangen (sauberes JSON-LD/HTML).
 */
function nullBeiLeer(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s === '' ? null : s;
}

/**
 * Baut die VOLLEN Kontaktdaten aus den ECHTEN Tenant-Stammdaten (street/postalCode/
 * city/country/phone). Gibt null zurueck, wenn KEIN inhaltliches Adress-/Telefon-Feld
 * belegt ist (der Betrieb hat zwar eingewilligt, aber nichts hinterlegt -> nichts zu
 * zeigen). `land` allein zaehlt bewusst NICHT als Inhalt (hat immer einen Default).
 */
function baueKontakt(t: Tenant): PublicKontakt | null {
  const kontakt: PublicKontakt = {
    strasse: nullBeiLeer(t.street),
    plz: nullBeiLeer(t.postalCode),
    ort: nullBeiLeer(t.city),
    land: nullBeiLeer(t.country),
    telefon: nullBeiLeer(t.phone),
  };
  const hatInhalt = kontakt.strasse || kontakt.plz || kontakt.ort || kontakt.telefon;
  return hatInhalt ? kontakt : null;
}

/**
 * Kappt eine (moeglicherweise fehlende) Ganzzahl defensiv auf [min, max] und
 * faellt bei fehlendem/kaputtem Wert auf `fallback` zurueck. Rein/serverseitig.
 */
function clampInt(v: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(Math.max(n, min), max);
}
