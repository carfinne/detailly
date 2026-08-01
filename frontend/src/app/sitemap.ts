import type { MetadataRoute } from 'next';
import { SITE_URL, PUBLIC_ROUTES } from '@/lib/seo';

// Statische Metadata-Route. Unter output:'export' (siehe next.config.js) rendert
// Next diese Datei ZUR BAUZEIT zu einer statischen Datei `out/sitemap.xml` –
// kein Server nötig. `force-static` stellt sicher, dass keine Request-Time-API
// die Route dynamisch macht. Der Dateiname behält seine .xml-Endung; trailingSlash
// betrifft nur endungslose Routen, nicht Metadata-Dateien.
//
// Enthält AUSSCHLIESSLICH die öffentlich indexierbaren Seiten (PUBLIC_ROUTES aus
// lib/seo.ts). Token-/Kundenseiten und der eingeloggte Bereich sind bewusst NICHT
// enthalten (siehe PRIVATE_DISALLOW in robots.ts + seitenweises noindex).
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
