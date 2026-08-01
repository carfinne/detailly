import type { MetadataRoute } from 'next';
import { SITE_URL, PRIVATE_DISALLOW } from '@/lib/seo';

// Statische Metadata-Route. Unter output:'export' rendert Next diese Datei zur
// Bauzeit zu `out/robots.txt`. `force-static` erzwingt die statische Ausgabe.
//
// Erlaubt grundsätzlich alles (`allow: '/'`), sperrt aber gezielt jede Route mit
// Kundendaten bzw. den eingeloggten Bereich (PRIVATE_DISALLOW aus lib/seo.ts).
// Die Token-/Kundenseiten tragen zusätzlich ein seitenweises robots:{index:false}
// (Defense-in-Depth). Der Sitemap-Verweis nutzt dieselbe konfigurierbare
// Basis-URL wie die Sitemap selbst.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_DISALLOW,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
