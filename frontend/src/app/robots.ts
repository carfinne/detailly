import type { MetadataRoute } from 'next';
import { SITE_URL, PRIVATE_DISALLOW } from '@/lib/seo';

// Statische Metadata-Route. Unter output:'export' rendert Next diese Datei zur
// Bauzeit zu `out/robots.txt`. `force-static` erzwingt die statische Ausgabe.
//
// Erlaubt grundsätzlich alles (`allow: '/'`), sperrt aber gezielt jede Route mit
// Kundendaten bzw. den eingeloggten Bereich (PRIVATE_DISALLOW aus lib/seo.ts).
// Die Token-/Kundenseiten tragen zusätzlich ein seitenweises robots:{index:false}
// (Defense-in-Depth). Die Sitemap-Verweise nutzen dieselbe konfigurierbare
// Basis-URL wie die Sitemap selbst.
//
// Drei Sitemaps: (1) die statische /sitemap.xml (Marketing-/Rechtsseiten, zur
// Bauzeit erzeugt), (2) die vom Backend request-time gerenderte
// /sitemap-betriebe.xml (auffindbare Betriebs-Einzelseiten /betrieb/<slug>) und
// (3) /sitemap-orte.xml (Orts-/Kategorieseiten /betriebe/<gewerk>/<citySlug>/).
// (2)+(3) existieren NUR zur Laufzeit (Opt-in-abhaengig) und koennen daher nicht im
// statischen Export stehen – sie werden hier zusaetzlich referenziert.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_DISALLOW,
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemap-betriebe.xml`,
      `${SITE_URL}/sitemap-orte.xml`,
    ],
  };
}
