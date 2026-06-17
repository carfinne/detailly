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
  env: {
    NEXT_PUBLIC_APP_NAME: 'Detailly',
    // Leer = relative API-Pfade (gleiche Origin). Fuer getrennte Entwicklung ueberschreibbar.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
};

module.exports = nextConfig;
