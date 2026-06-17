// Optionaler URL-Praefix (basePath). Beim pplx.app-Hosting werden Backend-Ports
// nicht automatisch geroutet, sondern muessen mit /port/<PORT> praefixiert
// werden. Wird BASE_PATH gesetzt (z.B. /port/3001), praefixiert Next.js dann
// automatisch ALLE internen Routen, <Link>-Ziele und Assets korrekt. Ohne
// BASE_PATH laeuft die App wie gewohnt unter der Wurzel (eigener Server / lokal).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Statischer Export: erzeugt einen out/-Ordner, den das NestJS-Backend
  // unter der gleichen Origin ausliefert (kein separater Frontend-Server noetig).
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Saubere URLs als Verzeichnisse (z.B. /dashboard/index.html).
  trailingSlash: true,
  // Praefix fuer Routen + Assets (siehe oben). Leer = Wurzel.
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  env: {
    NEXT_PUBLIC_APP_NAME: 'Detailly',
    // Leer = relative API-Pfade (gleiche Origin). Fuer getrennte Entwicklung ueberschreibbar.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    // Damit der Laufzeit-Code (api.ts) denselben Praefix fuer API-Aufrufe nutzt.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
