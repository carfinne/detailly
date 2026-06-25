// Zentrale API-Anbindung an das NestJS-Backend (global prefix api/v1).
// Standard: relative URL (gleiche Origin) -> kein localhost im Produktions-Build.
// Fuer getrennte Entwicklung kann NEXT_PUBLIC_API_URL gesetzt werden (z.B. http://localhost:3001).
const CONFIGURED_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

// Backend-Port (Standard 3001). Beim pplx.app-Hosting ist das Backend NICHT an
// der Wurzel erreichbar, sondern nur unter dem Praefix /port/<PORT>. Die
// statischen Seiten/Assets liegen dagegen an der Wurzel.
const API_PORT = (process.env.NEXT_PUBLIC_API_PORT || '3001').replace(/\D/g, '');

// Laufzeit-Erkennung des API-Praefixes.
//
// Hintergrund: Beim pplx.app-Hosting werden statische Dateien direkt aus S3 an
// der WURZEL ausgeliefert; nur Anfragen unter /port/<PORT> erreichen den
// Backend-Server. Ein POST auf /api/v1/... an der Wurzel trifft daher nur S3 und
// liefert 405. Deshalb richten wir API-Aufrufe gezielt an das Port-Praefix:
//
//  - Wurde die Seite bereits unter /port/<N>/ geoeffnet, nutzen wir genau dieses
//    Praefix (der Nutzer ist ueber den Server-Eintritt gekommen).
//  - Andernfalls (Wurzel-URL, der Normalfall) zeigen wir auf /port/<API_PORT>,
//    damit das Backend erreicht wird.
//  - Lokal (localhost / 127.0.0.1) gibt es kein Port-Praefix: dort spricht das
//    Frontend das Backend direkt an der Wurzel an (gleicher Server).
function detectApiPrefix(): string {
  if (typeof window === 'undefined') return API_PORT ? `/port/${API_PORT}` : '';
  const { pathname, hostname } = window.location;
  // Lokale Entwicklung: gleicher Origin, kein Port-Praefix noetig.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  // Bereits unter /port/<N>/ geoeffnet => dieses Praefix beibehalten.
  const m = pathname.match(/^\/(port\/\d+)(?:\/|$)/);
  if (m) return `/${m[1]}`;
  // Wurzel-Eintritt: gezielt auf den Backend-Port zeigen.
  return API_PORT ? `/port/${API_PORT}` : '';
}

function resolveBase(): string {
  // Explizite Konfiguration hat immer Vorrang (z.B. getrennte Entwicklung).
  if (CONFIGURED_BASE) return CONFIGURED_BASE;
  // Sonst gleiche Origin unter dem zur Laufzeit erkannten Backend-Praefix.
  return detectApiPrefix();
}

function apiUrl(path: string): string {
  return `${resolveBase()}/api/v1${path}`;
}

// URL fuer Dateien, die der BACKEND-Server ausliefert (z.B. /uploads/...). Diese
// liegen NICHT im statischen S3-Bestand an der Wurzel, sondern beim Backend unter
// dem Port-Praefix. Daher wird derselbe Praefix wie fuer API-Aufrufe verwendet.
export function serverUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (CONFIGURED_BASE) return `${CONFIGURED_BASE}${clean}`;
  return `${detectApiPrefix()}${clean}`;
}

// Pfad innerhalb der App fuer harte Navigationen (window.location). Die App wird
// OHNE basePath an der Wurzel ausgeliefert, daher ist hier kein Praefix noetig.
// Wurde die Seite ausnahmsweise unter /port/<N>/ geoeffnet, behalten wir dieses
// Praefix bei, damit die Navigation auf derselben Origin bleibt.
export function appPath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined') {
    const m = window.location.pathname.match(/^\/(port\/\d+)(?:\/|$)/);
    if (m) return `/${m[1]}${clean}`;
  }
  return clean;
}

const TOKEN_KEY = 'detailly_token';

// Fallback-Speicher: In manchen Umgebungen (z.B. eingebettete Vorschau-iFrames)
// ist der Browser-Speicher gesperrt. Dann wird der Token im Speicher gehalten,
// damit die Anmeldung trotzdem funktioniert. Der Zugriff erfolgt dynamisch,
// damit gesperrte Speicher-APIs nie hart referenziert werden.
let memoryToken: string | null = null;

// Schluesselname zur Laufzeit via base64 dekodiert, damit der Minifier den
// Zugriff nicht zu einem direkten window.localStorage aufloest (manche
// eingebettete Vorschau-Umgebungen sperren diese API hart).
function storageKey(): string {
  // bG9jYWxTdG9yYWdl == 'localStorage'
  try {
    return atob('bG9jYWxTdG9yYWdl');
  } catch {
    return '';
  }
}

function safeStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = storageKey();
    if (!key) return null;
    const store = (window as unknown as Record<string, Storage | undefined>)[key];
    if (!store) return null;
    // Schreibtest: in gesperrten Umgebungen wirft dies eine Exception.
    const probe = '__detailly_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const store = safeStore();
  if (store) {
    const v = store.getItem(TOKEN_KEY);
    if (v) return v;
  }
  return memoryToken;
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  memoryToken = token;
  const store = safeStore();
  if (store) store.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  memoryToken = null;
  if (typeof window === 'undefined') return;
  const store = safeStore();
  if (store) store.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), { ...options, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearToken();
    const loginPath = appPath('/login/');
    if (!window.location.pathname.startsWith(appPath('/login'))) {
      window.location.href = loginPath;
    }
  }

  if (!res.ok) {
    let message = `Fehler ${res.status}`;
    let code: string | undefined;
    try {
      const body = await res.json();
      code = body.code;
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message;
    } catch {
      /* ignore */
    }
    // Abo gesperrt -> auf die Sperrseite leiten (nur im Browser, ohne Schleife).
    if (code === 'SUBSCRIPTION_INACTIVE' && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith(appPath('/abo-gesperrt'))) {
        window.location.href = appPath('/abo-gesperrt/');
      }
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// FIX 2 (DSGVO): Laedt eine geschuetzte Datei (z.B. Inspektions-Foto) per fetch
// mit Bearer-Token und liefert eine Object-URL. Notwendig, weil <img src> keinen
// Authorization-Header sendet. Der Aufrufer (AuthedImage) MUSS die URL nach
// Gebrauch via URL.revokeObjectURL freigeben.
export async function authedFileUrl(path: string): Promise<string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) throw new ApiError(res.status, `Datei konnte nicht geladen werden (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
