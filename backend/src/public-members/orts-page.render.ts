/**
 * REINE, seiteneffektfreie Render-/Gruppierungs-Bausteine fuer die oeffentlichen,
 * serverseitig gerenderten Orts-/Kategorieseiten ("<Gewerk> in <Ort>",
 * /betriebe/<gewerk>/<citySlug>/). Wie betrieb-page.render: alles hier ist eine reine
 * Funktion (Daten rein -> String/Map raus) und damit vollstaendig unit-testbar
 * (Gruppierung, XSS-Escaping, JSON-LD, Sitemap) OHNE die App zu booten. Die
 * Orchestrierung (DB-Lookup, Cache, HTTP) liegt in OrtsPageService bzw. main.ts.
 *
 * ⚠️ SICHERHEIT: Firmenname, Kurzbeschreibung UND der Ort-Anzeigename (frei
 * eingegebener `stadt`-Freitext) sind nutzergesteuert. Im hier zusammengebauten
 * HTML-String werden sie – anders als in React – NICHT automatisch escaped. JEDES
 * eingebettete Feld laeuft daher durch escapeHtml (sichtbares HTML) bzw. den
 * JSON-LD-Escaper (kein </script>-Ausbruch). Es verlaesst NUR die PII-arme
 * Whitelist (PublicMitglied) das Backend – nie Adresse/Telefon/E-Mail.
 *
 * WIEDERVERWENDUNG (Paket-1-Haertung, nicht neu erfunden): escapeHtml/escapeXml,
 * jsonLdScriptContent, localBusinessNode, RenderOptions und MAX_SITEMAP_URLS kommen
 * 1:1 aus betrieb-page.render; die Ort-/Gewerk-Primitive aus orts-slug.
 */
import type { PublicMitglied } from './public-members.service';
import {
  escapeHtml,
  escapeXml,
  jsonLdScriptContent,
  localBusinessNode,
  canonicalUrl,
  MAX_SITEMAP_URLS,
  type RenderOptions,
} from './betrieb-page.render';
import {
  type GewerkKategorie,
  gewerkeFuerBetrieb,
  gewerkKategorieLabelDe,
  ortGruppeKey,
  ortsPageCanonicalUrl,
  stadtZuSlug,
} from './orts-slug';

/**
 * EINE fertig aufbereitete Ortsseite: die Gewerk-Kategorie, ihr citySlug, der
 * Anzeige-Ortsname (roh, MUSS beim Rendern escaped werden) und die passenden
 * Betriebe (deterministisch nach Firmenname sortiert – so kommen sie aus der DB).
 */
export interface OrtsGruppe {
  gewerk: GewerkKategorie;
  citySlug: string;
  /** Haeufigste Original-Schreibweise der Stadt in dieser Gruppe (roh -> escapeHtml!). */
  ortAnzeige: string;
  betriebe: PublicMitglied[];
}

/**
 * GRUPPIERUNG (reine Funktion): ordnet die uebergebenen (bereits sichtbaren, opt-in)
 * Betriebe nach (gewerk, citySlug). Ein Betrieb ohne brauchbare Stadt (stadtZuSlug
 * -> null) faellt heraus (kein Fehler). Ein `komplett`-Betrieb landet ueber
 * gewerkeFuerBetrieb in ALLEN DREI Gewerk-Gruppen seiner Stadt. Der Anzeige-Ortsname
 * je Gruppe ist die HAEUFIGSTE Original-Schreibweise (bei Gleichstand die zuerst
 * gesehene -> deterministisch, da die Eingabe nach Firmenname sortiert ist).
 *
 * BEWUSST in-memory: `settings`/Opt-in ist verschluesselt und nicht SQL-gruppierbar;
 * bei tausenden Betrieben ist das unkritisch (jeder Betrieb erzeugt <=3 Gruppen).
 */
export function gruppiereNachOrt(mitglieder: PublicMitglied[]): Map<string, OrtsGruppe> {
  interface Roh {
    gewerk: GewerkKategorie;
    citySlug: string;
    betriebe: PublicMitglied[];
    /** Original-Schreibweise -> Haeufigkeit (Insertion-Order = zuerst gesehen). */
    stadtCounts: Map<string, number>;
  }
  const roh = new Map<string, Roh>();

  for (const m of mitglieder) {
    const citySlug = stadtZuSlug(m.stadt);
    if (!citySlug) continue; // ohne brauchbare Stadt keine Ortsseite
    const original = String(m.stadt ?? '').trim();
    for (const gewerk of gewerkeFuerBetrieb(m.betriebstyp)) {
      const key = ortGruppeKey(gewerk, citySlug);
      let g = roh.get(key);
      if (!g) {
        g = { gewerk, citySlug, betriebe: [], stadtCounts: new Map() };
        roh.set(key, g);
      }
      g.betriebe.push(m);
      g.stadtCounts.set(original, (g.stadtCounts.get(original) ?? 0) + 1);
    }
  }

  const out = new Map<string, OrtsGruppe>();
  for (const [key, g] of roh) {
    let best = '';
    let bestCount = -1;
    for (const [name, count] of g.stadtCounts) {
      // strikt `>` -> bei Gleichstand bleibt die zuerst gesehene Schreibweise
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    out.set(key, { gewerk: g.gewerk, citySlug: g.citySlug, ortAnzeige: best, betriebe: g.betriebe });
  }
  return out;
}

/** <title>-/H1-Rohtext einer Ortsseite ("<Gewerk> in <Ort>"), NOCH nicht escaped. */
function ortsTitelRoh(gruppe: OrtsGruppe): string {
  return `${gewerkKategorieLabelDe(gruppe.gewerk)} in ${gruppe.ortAnzeige}`;
}

/** Meta-Description-Rohtext einer Ortsseite (mit Anzahl), NOCH nicht escaped. */
function ortsDescriptionRoh(gruppe: OrtsGruppe): string {
  const n = gruppe.betriebe.length;
  return `${n} ${n === 1 ? 'Anbieter' : 'Anbieter'} fuer ${gewerkKategorieLabelDe(gruppe.gewerk)} in ${gruppe.ortAnzeige} im Detailly-Verzeichnis.`;
}

/**
 * Baut den ItemList-JSON-LD-Knoten der Ortsseite: eine geordnete Liste der Betriebe,
 * jedes Element ein ListItem mit dem LocalBusiness-Knoten aus dem Paket-1-Helfer
 * (localBusinessNode – exakt dieselbe Whitelist-Projektion wie die Einzelseite).
 */
function ortsItemListNode(gruppe: OrtsGruppe, opts: RenderOptions): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: ortsTitelRoh(gruppe),
    numberOfItems: gruppe.betriebe.length,
    itemListElement: gruppe.betriebe.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: localBusinessNode(m, opts),
    })),
  };
}

/**
 * Rendert die vollstaendige, semantische HTML-Seite EINER Ortsseite (Status 200).
 * lang="de" (kanonische Locale). Jeder nutzergesteuerte Wert (Ortsname, Firmenname,
 * Kurzbeschreibung) ist escaped; jeder Betrieb ist ein CRAWLBARER interner Link auf
 * seine Einzelseite /betrieb/<slug>/ (internes Verlinken = SEO-Kern). KEINE Skripte
 * (nur ein ld+json-Datenblock) – passt zur enforcing CSP.
 */
export function renderOrtsPageHtml(gruppe: OrtsGruppe, opts: RenderOptions): string {
  const canonical = ortsPageCanonicalUrl(opts.baseUrl, gruppe.gewerk, gruppe.citySlug);
  const gewerkLabel = gewerkKategorieLabelDe(gruppe.gewerk);
  const titelRaw = ortsTitelRoh(gruppe);
  const descRaw = ortsDescriptionRoh(gruppe);
  const ogImage = `${opts.baseUrl}/icon.svg`;

  const items = gruppe.betriebe
    .map((m) => {
      const href = escapeHtml(canonicalUrl(opts.baseUrl, m.slug));
      const name = escapeHtml(m.firmenname);
      const desc = m.kurzbeschreibung
        ? `<p class="ob-desc">${escapeHtml(m.kurzbeschreibung)}</p>`
        : '';
      const monogram = `<span class="ob-mono" aria-hidden="true">${escapeHtml(m.initiale)}</span>`;
      return `<li class="ob-item"><a class="ob-link" href="${href}">${monogram}<span class="ob-body"><span class="ob-name">${name}</span>${desc}</span></a></li>`;
    })
    .join('\n');

  const jsonLd = jsonLdScriptContent(ortsItemListNode(gruppe, opts));

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(titelRaw)} · Detailly</title>
<meta name="description" content="${escapeHtml(descRaw)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Detailly" />
<meta property="og:locale" content="de_DE" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:title" content="${escapeHtml(titelRaw)}" />
<meta property="og:description" content="${escapeHtml(descRaw)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(titelRaw)}" />
<meta name="twitter:description" content="${escapeHtml(descRaw)}" />
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.6}
.ob-wrap{max-width:760px;margin:0 auto;padding:48px 20px 64px}
h1{font-size:30px;line-height:1.2;margin:0}
.ob-lead{margin:16px 0 0;font-size:17px;color:#c9d3de}
.ob-count{color:#9aa7b4;font-size:14px;margin:6px 0 0}
.ob-list{list-style:none;margin:28px 0 0;padding:0;display:flex;flex-direction:column;gap:12px}
.ob-link{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:#161b22;border:1px solid #21262d;text-decoration:none;color:inherit}
.ob-link:hover{border-color:#E8923B66}
.ob-mono{display:grid;place-items:center;width:44px;height:44px;border-radius:11px;background:linear-gradient(135deg,#E8923B,#E8923B99);color:#fff;font-weight:700;font-size:16px;flex:0 0 auto}
.ob-body{min-width:0}
.ob-name{display:block;font-weight:600;font-size:16px;color:#e6edf3}
.ob-desc{margin:2px 0 0;font-size:14px;color:#9aa7b4;overflow:hidden;text-overflow:ellipsis}
.ob-foot{margin-top:48px;padding-top:20px;border-top:1px solid #21262d;color:#6e7b8a;font-size:13px}
.ob-foot a{color:#9aa7b4}
</style>
</head>
<body>
<main class="ob-wrap">
<h1>${escapeHtml(titelRaw)}</h1>
<p class="ob-lead">Betriebe, die ${escapeHtml(gewerkLabel)} in ${escapeHtml(gruppe.ortAnzeige)} anbieten und ihre Werkstatt mit Detailly organisieren.</p>
<p class="ob-count">${gruppe.betriebe.length} ${gruppe.betriebe.length === 1 ? 'Anbieter' : 'Anbieter'}</p>
<ul class="ob-list">
${items}
</ul>
<footer class="ob-foot">
<p>Teil des <a href="${escapeHtml(opts.baseUrl)}/">Detailly-Verzeichnisses</a> – Software fuer Fahrzeugaufbereitung, Folierung und PPF.</p>
</footer>
</main>
</body>
</html>`;
}

/**
 * Kleine, saubere 404-Seite fuer eine Ortsseite (unbekanntes Gewerk, ungueltiger/
 * leerer citySlug oder eine Stadt ohne passenden Betrieb). noindex – so landet eine
 * Tipp-Ort-Geisterseite nie im Index. lang="de".
 */
export function renderOrts404Html(opts: RenderOptions): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ortsseite nicht gefunden · Detailly</title>
<meta name="robots" content="noindex,follow" />
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.6}
.ob-wrap{max-width:560px;margin:0 auto;padding:80px 20px;text-align:center}
h1{font-size:26px;margin:0 0 12px}
p{color:#9aa7b4;margin:0 0 24px}
a{display:inline-block;padding:11px 20px;border-radius:12px;background:#E8923B;color:#0d1117;font-weight:600;text-decoration:none}
</style>
</head>
<body>
<main class="ob-wrap">
<h1>Keine Betriebe gefunden</h1>
<p>Fuer dieses Gewerk und diesen Ort gibt es (noch) keine gelisteten Betriebe im Detailly-Verzeichnis.</p>
<a href="${escapeHtml(opts.baseUrl)}/">Zur Startseite</a>
</main>
</body>
</html>`;
}

/**
 * Rendert die dynamische Orts-Sitemap (alle (gewerk, citySlug)-Seiten mit >=1
 * sichtbarem Betrieb) als XML-String. citySlugs sind bereits [a-z0-9-]; sie werden
 * dennoch defensiv XML-escaped. Die Kappung auf MAX_SITEMAP_URLS uebernimmt der
 * Aufrufer (OrtsPageService, mit Warn-Log) – wie bei der Betriebs-Sitemap.
 */
export function renderOrtsSitemapXml(
  eintraege: { gewerk: GewerkKategorie; citySlug: string }[],
  opts: RenderOptions,
): string {
  const urls = eintraege
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeXml(ortsPageCanonicalUrl(opts.baseUrl, e.gewerk, e.citySlug))}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.5</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Re-Export fuer den Aufrufer (Kappungs-Log in OrtsPageService), damit er nicht doppelt importieren muss. */
export { MAX_SITEMAP_URLS };
