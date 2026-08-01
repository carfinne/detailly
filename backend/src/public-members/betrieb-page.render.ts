/**
 * REINE, seiteneffektfreie Render-/Escaping-Bausteine fuer die oeffentlichen,
 * serverseitig gerenderten Betriebs-Einzelseiten (/betrieb/<slug>).
 *
 * BEWUSST ohne NestJS-DI, ohne fs/DB und ohne Fremdpaket: alles hier ist eine
 * reine Funktion (String rein -> String raus) und damit vollstaendig unit-testbar
 * (XSS-Escaping, JSON-LD, Sitemap) OHNE die App zu booten. Die Orchestrierung
 * (DB-Lookup, Cache, HTTP) liegt in BetriebPageService bzw. main.ts.
 *
 * ⚠️ SICHERHEIT (oeffentliche Seite mit nutzergesteuerten Inhalten): Firmenname,
 * Kurzbeschreibung, Stadt und Webseite gibt der Betrieb frei ein. Im hier
 * zusammengebauten HTML-String werden sie – anders als in React – NICHT
 * automatisch escaped. JEDES eingebettete Feld laeuft daher durch escapeHtml
 * (sichtbares HTML) bzw. den JSON-LD-Escaper (kein </script>-Ausbruch); die
 * Webseite-URL wird zusaetzlich erneut streng auf http/https geprueft.
 */
import { Betriebstyp } from '../tenants/entities/tenant.entity';
import type { PublicMitglied } from './public-members.service';
import {
  gewerkeFuerBetrieb,
  gewerkKategorieLabelDe,
  ortsPageCanonicalUrl,
  stadtZuSlug,
} from './orts-slug';

/**
 * PLATZHALTER-Basis-URL, falls weder PUBLIC_SITE_URL noch FRONTEND_URL gesetzt
 * sind. Spiegelt bewusst den Frontend-Platzhalter (frontend/src/lib/seo.ts) –
 * VOR Go-Live MUSS PUBLIC_SITE_URL (== NEXT_PUBLIC_SITE_URL des Frontends)
 * gesetzt werden, sonst zeigen canonical/OG auf diese Platzhalter-Domain.
 */
export const PLATZHALTER_SITE_URL = 'https://detailly.de';

/**
 * Loest die oeffentliche Basis-URL des Backends auf (ohne abschliessenden Slash):
 * PUBLIC_SITE_URL -> FRONTEND_URL -> Platzhalter. Die Bauzeit-Variable
 * NEXT_PUBLIC_SITE_URL des Frontends steht dem Backend NICHT zur Verfuegung, daher
 * eine eigene, request-time gelesene ENV.
 */
export function resolveSiteUrl(env: NodeJS.ProcessEnv): string {
  const raw = (env.PUBLIC_SITE_URL || env.FRONTEND_URL || PLATZHALTER_SITE_URL).trim();
  return raw.replace(/\/+$/, '') || PLATZHALTER_SITE_URL;
}

/**
 * Escaped einen String fuer die Einbettung in HTML-Text UND HTML-Attributwerte
 * (in doppelten Anfuehrungszeichen). `&` zuerst, damit bereits erzeugte Entities
 * nicht doppelt escaped werden. Neutralisiert `<`,`>` (Tag-Ausbruch), `"`,`'`
 * (Attribut-Ausbruch). Reicht fuer Text- und Attribut-Kontexte; NICHT fuer
 * URL-/JS-Kontexte (dafuer isSafeHttpUrl bzw. der JSON-LD-Escaper).
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escaped einen String fuer XML-Textinhalte (Sitemap <loc>). Wie escapeHtml,
 * aber ohne die HTML-only-Apostroph-Entitaet (`&#39;` ist in XML gueltig, `'`
 * darf im Textinhalt aber ohnehin roh stehen – wir escapen es der Einheitlichkeit
 * halber mit `&apos;`).
 */
export function escapeXml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serialisiert ein JSON-LD-Objekt und macht es sicher fuer die Einbettung in ein
 * <script type="application/ld+json">…</script>. JSON.stringify liefert bereits
 * gueltiges JSON (Anfuehrungszeichen etc. sind maskiert); zusaetzlich werden
 * `<`,`>`,`&` als Unicode-Escapes neutralisiert, damit KEIN `</script>` den Tag
 * vorzeitig schliessen kann (XSS-Ausbruch) und keine HTML-Entity-Verwirrung
 * entsteht. `application/ld+json` ist ein Daten-Block (kein ausfuehrbares JS) –
 * die CSP betrifft ihn nicht.
 */
export function jsonLdScriptContent(node: Record<string, unknown>): string {
  return JSON.stringify(node)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** Streng: nur echte http/https-URLs sind als klickbarer Link/Metadatum erlaubt. */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test(String(url ?? '').trim());
}

/**
 * Strenges Slug-Format: nur klein-alphanumerisch + Bindestrich, 1–80 Zeichen.
 * Unsere Slugs sind umlautgefaltet, klein, `[a-z0-9-]`, <=40 (Baseline-Migration);
 * 80 ist ein grosszuegiger Puffer. Wird VOR jedem DB-/Cache-Zugriff geprueft, damit
 * ein Angreifer mit Muell-/Traversal-Slugs (`../`, Grossbuchstaben, Sonderzeichen)
 * weder eine DB-Query ausloest noch einen Cache-Eintrag erzeugt (Memory-DoS-Schutz).
 */
export const SLUG_MAX_LENGTH = 80;
export function isValidSlug(slug: string | null | undefined): boolean {
  return /^[a-z0-9-]{1,80}$/.test(String(slug ?? ''));
}

/**
 * Harte Obergrenze der Betriebs-Sitemap. Das Sitemap-Protokoll erlaubt max. 50.000
 * URLs je Datei; wir kappen defensiv darunter und loggen die Kappung (statt still
 * abzuschneiden). Bis dahin ist die Menge ohnehin durch echte Betriebe begrenzt.
 */
export const MAX_SITEMAP_URLS = 50000;

/**
 * Deutsches Gewerk-Label je Betriebstyp. Spiegelt bewusst die Frontend-i18n-
 * Labels (labels.betriebstyp.*.label in dictionaries/de.ts). Die serverseitige
 * Seite ist die KANONISCHE deutsche Locale (siehe Modul-Doku im Controller/
 * Bericht), daher deutsche Fixtexte statt i18n.
 */
export function gewerkLabelDe(typ: Betriebstyp): string {
  switch (typ) {
    case Betriebstyp.AUFBEREITUNG:
      return 'Fahrzeugaufbereitung';
    case Betriebstyp.FOLIERUNG:
      return 'Folierung';
    case Betriebstyp.PPF:
      return 'PPF / Lackschutz';
    case Betriebstyp.KOMPLETT:
    default:
      return 'Komplett-Anbieter';
  }
}

/** Optionen fuer die Render-Funktionen (Basis-URL aus resolveSiteUrl). */
export interface RenderOptions {
  /** Oeffentliche Basis-URL ohne abschliessenden Slash, z. B. https://app.detailly.de */
  baseUrl: string;
}

/** Kanonische URL einer Betriebsseite (mit abschliessendem Slash, wie trailingSlash:true). */
export function canonicalUrl(baseUrl: string, slug: string): string {
  return `${baseUrl}/betrieb/${slug}/`;
}

/**
 * Baut den LocalBusiness-JSON-LD-Knoten fuer EINEN Betrieb. Spiegelt exakt die
 * Feld-Auswahl aus frontend/src/lib/structured-data.ts (betriebeItemListNode):
 * nur freigegebene Whitelist-Felder, KEINE Strasse/volle PLZ/Telefon/E-Mail.
 */
export function localBusinessNode(
  m: PublicMitglied,
  opts: RenderOptions,
): Record<string, unknown> {
  const gewerk = gewerkLabelDe(m.betriebstyp);
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${canonicalUrl(opts.baseUrl, m.slug)}#business`,
    name: m.firmenname,
    // Kanonische Seiten-URL als url; die eigene Webseite (falls sicher) als sameAs.
    url: canonicalUrl(opts.baseUrl, m.slug),
  };
  // Beschreibung: Kurzbeschreibung bevorzugt, sonst das Gewerk-Label (wie Frontend).
  node.description = m.kurzbeschreibung || gewerk;
  if (isSafeHttpUrl(m.webseite)) node.sameAs = [m.webseite];
  if (m.logoUrl) node.image = m.logoUrl;
  // Ort nur als addressLocality; Leitregion als areaServed (bewusst KEINE volle PLZ).
  if (m.stadt) node.address = { '@type': 'PostalAddress', addressLocality: m.stadt };
  if (m.plzRegion) node.areaServed = `${m.plzRegion} (Leitregion)`;
  return node;
}

/** Baut den <title>-Text (roh, NOCH nicht escaped – der Aufrufer escaped). */
function titleText(m: PublicMitglied): string {
  const gewerk = gewerkLabelDe(m.betriebstyp);
  const ort = m.stadt ? ` in ${m.stadt}` : '';
  return `${m.firmenname} – ${gewerk}${ort}`;
}

/** Baut den Meta-Description-Text (roh). Kurzbeschreibung bevorzugt. */
function descriptionText(m: PublicMitglied): string {
  if (m.kurzbeschreibung) return m.kurzbeschreibung;
  const gewerk = gewerkLabelDe(m.betriebstyp);
  const ort = m.stadt ? ` in ${m.stadt}` : '';
  return `${m.firmenname} – ${gewerk}${ort}. Betrieb im Detailly-Verzeichnis.`;
}

/**
 * Rendert die vollstaendige, semantische HTML-Seite eines Betriebs (Status 200).
 * lang="de" (kanonische Locale). Alle nutzergesteuerten Felder sind escaped.
 * KEINE Skripte (nur ein ld+json-Datenblock), passt zur enforcing CSP.
 */
export function renderBetriebPageHtml(m: PublicMitglied, opts: RenderOptions): string {
  const canonical = canonicalUrl(opts.baseUrl, m.slug);
  const gewerk = gewerkLabelDe(m.betriebstyp);
  const titleRaw = titleText(m);
  const descRaw = descriptionText(m);
  const ogImage = `${opts.baseUrl}/icon.svg`;

  // Sichere Webseite (erneute strenge Pruefung, Defense-in-Depth ueber die Whitelist hinaus).
  const webOk = isSafeHttpUrl(m.webseite);
  const webHref = webOk ? escapeHtml(m.webseite) : '';

  const logo = m.logoUrl
    ? `<img class="db-logo" src="${escapeHtml(m.logoUrl)}" alt="${escapeHtml(`Logo ${m.firmenname}`)}" width="72" height="72" loading="lazy" />`
    : `<span class="db-monogram" aria-hidden="true">${escapeHtml(m.initiale)}</span>`;

  const ortZeile = m.stadt
    ? `<p class="db-ort"><span class="db-pin" aria-hidden="true">◍</span> ${escapeHtml(m.stadt)}</p>`
    : '';

  const beschreibung = m.kurzbeschreibung
    ? `<p class="db-desc">${escapeHtml(m.kurzbeschreibung)}</p>`
    : '';

  // CTA: primaer die eigene Webseite des Betriebs (Kontakt), sonst zurueck zum
  // Detailly-Verzeichnis. rel="noopener nofollow" fuer den externen Link.
  const primaerCta = webOk
    ? `<a class="db-cta db-cta--primary" href="${webHref}" rel="noopener nofollow" target="_blank">Website besuchen</a>`
    : '';
  const sekundaerCta = `<a class="db-cta db-cta--secondary" href="${escapeHtml(opts.baseUrl)}/">Weitere Betriebe im Verzeichnis</a>`;

  // Rueckwaerts-Verlinkung ins interne Netz (Paket 2): Link(s) auf die Ortsseite(n)
  // dieses Betriebs ("Weitere <Gewerk> in <Ort>"). Ein Komplett-Betrieb erscheint auf
  // allen drei Gewerk-Seiten seiner Stadt -> drei Links. Nur wenn die Stadt zu einem
  // brauchbaren citySlug kanonisiert (sonst gibt es keine Ortsseite). Da diese
  // Einzelseite nur fuer sichtbare Opt-in-Betriebe rendert, ist der Betrieb selbst
  // garantiert Teil der Zielgruppe -> die verlinkte Ortsseite liefert nie 404.
  const ortsCitySlug = stadtZuSlug(m.stadt);
  const ortslinks = (() => {
    if (!ortsCitySlug || !m.stadt) return '';
    const gewerke = gewerkeFuerBetrieb(m.betriebstyp);
    if (gewerke.length === 0) return '';
    const li = gewerke
      .map((g) => {
        const href = escapeHtml(ortsPageCanonicalUrl(opts.baseUrl, g, ortsCitySlug));
        const label = escapeHtml(`Weitere ${gewerkKategorieLabelDe(g)} in ${m.stadt}`);
        return `<li><a href="${href}">${label}</a></li>`;
      })
      .join('');
    return `<nav class="db-orte" aria-label="Weitere Betriebe der Region"><ul>${li}</ul></nav>`;
  })();

  const jsonLd = jsonLdScriptContent(localBusinessNode(m, opts));

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(titleRaw)} · Detailly</title>
<meta name="description" content="${escapeHtml(descRaw)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Detailly" />
<meta property="og:locale" content="de_DE" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:title" content="${escapeHtml(titleRaw)}" />
<meta property="og:description" content="${escapeHtml(descRaw)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(titleRaw)}" />
<meta name="twitter:description" content="${escapeHtml(descRaw)}" />
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.6}
.db-wrap{max-width:720px;margin:0 auto;padding:48px 20px 64px}
.db-head{display:flex;align-items:center;gap:18px;margin-bottom:8px}
.db-logo{border-radius:14px;object-fit:cover;background:#161b22;flex:0 0 auto}
.db-monogram{display:grid;place-items:center;width:72px;height:72px;border-radius:14px;background:linear-gradient(135deg,#E8923B,#E8923B99);color:#fff;font-weight:700;font-size:26px;flex:0 0 auto}
h1{font-size:30px;line-height:1.2;margin:0}
.db-gewerk{display:inline-block;margin-top:10px;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;color:#E8923B;background:#E8923B1a;border:1px solid #E8923B40}
.db-ort{color:#9aa7b4;margin:14px 0 0;font-size:15px}
.db-pin{color:#E8923B}
.db-desc{margin:20px 0 0;font-size:17px;color:#c9d3de}
.db-cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.db-cta{display:inline-block;padding:11px 20px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none}
.db-cta--primary{background:#E8923B;color:#0d1117}
.db-cta--secondary{background:#161b22;color:#e6edf3;border:1px solid #30363d}
.db-orte{margin-top:32px}
.db-orte ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}
.db-orte a{display:inline-block;padding:8px 14px;border-radius:999px;font-size:14px;color:#9aa7b4;background:#161b22;border:1px solid #30363d;text-decoration:none}
.db-orte a:hover{border-color:#E8923B66;color:#e6edf3}
.db-foot{margin-top:48px;padding-top:20px;border-top:1px solid #21262d;color:#6e7b8a;font-size:13px}
.db-foot a{color:#9aa7b4}
</style>
</head>
<body>
<main class="db-wrap">
<article>
<header class="db-head">
${logo}
<div>
<h1>${escapeHtml(m.firmenname)}</h1>
<span class="db-gewerk">${escapeHtml(gewerk)}</span>
</div>
</header>
${ortZeile}
${beschreibung}
<div class="db-cta-row">
${primaerCta}
${sekundaerCta}
</div>
${ortslinks}
</article>
<footer class="db-foot">
<p>Dieser Betrieb organisiert seine Werkstatt mit <a href="${escapeHtml(opts.baseUrl)}/">Detailly</a> – Software fuer Fahrzeugaufbereitung, Folierung und PPF.</p>
</footer>
</main>
</body>
</html>`;
}

/**
 * Kleine, saubere 404-Seite (unbekannter/abgemeldeter Slug). noindex, damit ein
 * abgemeldeter Betrieb nicht doch im Index landet. lang="de".
 */
export function render404Html(opts: RenderOptions): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Betrieb nicht gefunden · Detailly</title>
<meta name="robots" content="noindex,follow" />
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.6}
.db-wrap{max-width:560px;margin:0 auto;padding:80px 20px;text-align:center}
h1{font-size:26px;margin:0 0 12px}
p{color:#9aa7b4;margin:0 0 24px}
a{display:inline-block;padding:11px 20px;border-radius:12px;background:#E8923B;color:#0d1117;font-weight:600;text-decoration:none}
</style>
</head>
<body>
<main class="db-wrap">
<h1>Betrieb nicht gefunden</h1>
<p>Diese Betriebsseite gibt es nicht (mehr) oder der Betrieb ist nicht mehr im oeffentlichen Verzeichnis gelistet.</p>
<a href="${escapeHtml(opts.baseUrl)}/">Zur Startseite</a>
</main>
</body>
</html>`;
}

/**
 * Rendert die dynamische Betriebs-Sitemap (alle live sichtbaren /betrieb/<slug>/).
 * Nur Slugs von Betrieben mit oeffentlicher Einzelseite (Opt-in + active/pilot);
 * so zeigt die Sitemap nie auf eine 404-Seite. Slugs werden defensiv XML-escaped.
 */
export function renderBetriebeSitemapXml(slugs: string[], opts: RenderOptions): string {
  const urls = slugs
    .map(
      (slug) =>
        `  <url>\n    <loc>${escapeXml(canonicalUrl(opts.baseUrl, slug))}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
