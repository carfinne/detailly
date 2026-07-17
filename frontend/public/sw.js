/* =========================================================================
   Detailly Service-Worker (handgeschrieben, Vanilla – kein Workbox/next-pwa).

   Ziele:
   - Progressive Enhancement: darf den App-Start NIE blockieren.
   - Offline-Fallback fuer Navigationen auf eine statische Offline-Seite.
   - API-Aufrufe NICHT cachen (keine veralteten/personenbezogenen Daten).
   - KRITISCH gegen "tote App nach Deploy": strikte Versions-Invalidierung.
     Cache-Namen tragen SW_VERSION; beim activate werden ALLE Detailly-Caches
     geloescht, deren Name nicht zur aktuellen Version passt. skipWaiting() +
     clients.claim() sorgen dafuer, dass ein neuer Deploy sofort uebernimmt und
     nie alte, gehashte Next-Chunks aus dem Cache serviert.

   WARTUNG: SW_VERSION bei jedem Deploy erhoehen (z. B. auf die package.json-
   Version). public/-Dateien werden vom Build NICHT getemplatet, daher ist dies
   bewusst eine manuelle Build-Konstante. Aendert sich die Version, raeumt der
   activate-Handler saemtliche alten Caches ab.
   ========================================================================= */

'use strict';

// Bei Deploy erhoehen. Haelt sich an die App-Version (frontend/package.json).
const SW_VERSION = '0.1.0';

const CACHE_PREFIX = 'detailly';
const SHELL_CACHE = CACHE_PREFIX + '-shell-' + SW_VERSION;
const STATIC_CACHE = CACHE_PREFIX + '-static-' + SW_VERSION;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];

// App-Shell: die minimalen, netz-unabhaengigen Bausteine des Offline-Fallbacks.
// Gehashte Next-Chunks stehen hier bewusst NICHT (Namen sind zur Bauzeit unbekannt
// und werden zur Laufzeit versioniert gecacht).
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [OFFLINE_URL, '/manifest.webmanifest', '/icon.svg'];

// ---------------------------------------------------------------------------
// Install: App-Shell vorab cachen, dann sofort aktiv werden.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Einzeln adden, damit ein fehlendes Asset den Install nicht killt.
      await Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

// ---------------------------------------------------------------------------
// Activate: ALLE alten Detailly-Caches loeschen (Version != aktuell), dann
// aktive Clients uebernehmen. Das ist die Kern-Absicherung gegen stale Chunks.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Erlaubt der App, ein sofortiges Update anzustossen (progressive, optional).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

// Ist der Request ein Backend-/API-Aufruf? Diese werden NIE gecacht.
// Deckt gleiche Origin (/api/..., /port/<n>/...) ab. Fremd-Origins (z. B. eine
// absolute NEXT_PUBLIC_API_URL) werden ohnehin gar nicht erst behandelt.
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api/v1') ||
    /^\/port\/\d+/.test(url.pathname);
}

// Gehashte Next-Assets: immutabel je Build, versioniert gecacht.
function isNextStatic(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html'));
}

// Stale-while-revalidate innerhalb eines versionierten Caches: liefert sofort
// aus dem Cache (falls vorhanden) und aktualisiert im Hintergrund. Weil der
// activate-Handler fremd-versionierte Caches loescht, kann hier kein Chunk aus
// einem alten Deploy ueberleben.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  // Cache-Treffer: sofort liefern, Netz revalidiert im Hintergrund weiter.
  if (cached) return cached;
  // Kein Cache: auf das Netz warten. Faellt es aus (offline), eine DEFINIERTE
  // Fehlerantwort zurueckgeben statt undefined -> respondWith bleibt eindeutig.
  const response = await network;
  return (
    response ||
    new Response('', { status: 504, statusText: 'Offline' })
  );
}

// Navigation: network-first mit Offline-Fallback. Kein Cachen von HTML, damit
// nach einem Deploy keine alte Seite mit toten Chunk-Referenzen erscheint.
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Fetch-Routing
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET behandeln; alles andere (POST/PUT/...) unangetastet lassen.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Fremd-Origin (absolute API-URL, Fonts-CDN, ...) nie anfassen -> Browser-Default.
  if (url.origin !== self.location.origin) return;

  // API/Backend: network-only, niemals cachen. Offline schlaegt der Aufruf sauber
  // fehl und die App-eigene Fehlerbehandlung greift (keine Fake-Daten).
  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation/HTML: network-first -> Offline-Seite als Fallback.
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Gehashte Next-Chunks: stale-while-revalidate im versionierten Static-Cache.
  if (isNextStatic(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // App-Shell-Assets (Manifest/Icon/Offline-Seite): stale-while-revalidate.
  // Offline weiterhin aus dem Cache verfuegbar; online aktualisieren sie sich
  // im Hintergrund selbst, auch wenn SW_VERSION mal nicht erhoeht wurde.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  // Sonstige gleiche-Origin GET-Assets (CSS, lokale Bilder): stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});
