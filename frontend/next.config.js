// WICHTIG (pplx.app-Hosting):
// Beim Veroeffentlichen werden die statischen Dateien (HTML/JS/CSS) direkt aus S3
// an der WURZEL der Domain ausgeliefert. Nur API-/Backend-Anfragen werden an den
// Sandbox-Server unter dem Praefix /port/<PORT> geroutet.
//
// Deshalb wird die App OHNE basePath gebaut: alle Seiten/Assets liegen an der
// Wurzel (z.B. /login/index.html) und sind direkt ueber die Wurzel-URL erreichbar.
// Die API-Aufrufe richten sich dagegen gezielt an /port/<PORT>/api/v1 – das
// uebernimmt die Laufzeit-Erkennung in src/lib/api.ts. So funktioniert der Login
// sowohl ueber die Wurzel-URL als auch ueber /port/<PORT>/.
//
// NEXT_PUBLIC_API_PORT teilt dem Frontend mit, unter welchem Port-Praefix das
// Backend erreichbar ist (Standard: 3001). Lokal/getrennt kann NEXT_PUBLIC_API_URL
// gesetzt werden und hat dann Vorrang.
const basePath = '';
const apiPort = process.env.NEXT_PUBLIC_API_PORT || '3001';

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
    // Backend-Port-Praefix fuer API-Aufrufe (siehe src/lib/api.ts).
    NEXT_PUBLIC_API_PORT: apiPort,
    // basePath bleibt leer (App an der Wurzel).
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
