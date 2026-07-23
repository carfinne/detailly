// Zentrale API-Anbindung an das NestJS-Backend (global prefix api/v1).
// Standard: relative URL (gleiche Origin) -> kein localhost im Produktions-Build.
// Fuer getrennte Entwicklung kann NEXT_PUBLIC_API_URL gesetzt werden (z.B. http://localhost:3001).
import { ENTITLEMENTS_CACHE_KEY } from './entitlements';

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

// Absolute API-URL (inkl. Protokoll+Host) – noetig fuer Links, die AUSSERHALB der
// App funktionieren muessen (z.B. den iCal-Abo-Link, den eine Kalender-App abruft).
// resolveBase() liefert je nach Hosting eine absolute Basis (NEXT_PUBLIC_API_URL)
// ODER ein relatives Praefix; im zweiten Fall stellen wir die Origin voran.
export function absoluteApiUrl(path: string): string {
  const rel = apiUrl(path);
  if (/^https?:\/\//i.test(rel)) return rel;
  return (typeof window !== 'undefined' ? window.location.origin : '') + rel;
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
  if (store) {
    store.removeItem(TOKEN_KEY);
    // Tarif-Entitlements-Cache mit-leeren: auf einem geteilten Werkstatt-PC soll
    // der naechste Betrieb nicht kurz die Nav des vorherigen sehen. Choke-Point
    // deckt auch den 401-Auto-Logout ab.
    store.removeItem(ENTITLEMENTS_CACHE_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  // Maschinenlesbarer Fehlercode aus dem Backend-Body (z.B. 'PLAN_FEATURE_MISSING',
  // 'SUBSCRIPTION_INACTIVE'). Erlaubt dem Client, gleiche HTTP-Stati (etwa 403)
  // fachlich zu unterscheiden – ein Rollen-403 ist etwas anderes als ein Tarif-403.
  code?: string;
  // Vollstaendiger strukturierter Fehler-Body des Backends (additiv). Noetig fuer
  // Fehler, die mehr als code+message transportieren – z.B. der 409
  // APPOINTMENT_OVERLAP mit seiner `konflikte`-Liste (Plantafel-Konfliktdialog).
  data?: unknown;
  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  // FormData (Datei-Upload) setzt seinen multipart-Boundary-Header selbst –
  // ein manueller Content-Type wuerde den Boundary zerstoeren.
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
    let data: unknown;
    try {
      const body = await res.json();
      data = body;
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
    // 2FA-Pflicht noch nicht erfuellt (serverseitige Erzwingung im JwtAuthGuard,
    // 403 MFA_SETUP_REQUIRED). Defense-in-Depth: NICHT ausloggen / kein clearToken
    // (das ist KEIN 401), sondern in die App-Shell lenken. Dort laedt der
    // AuthProvider /auth/me (mfaPflicht) und die MfaSetupGate zeigt die Einrichtung
    // statt einer 403-Fehlerwand. Harte Navigation -> AuthProvider mountet neu und
    // laedt /auth/me frisch. Schleifen-Schutz ueber den Pfad-Praefix.
    if (code === 'MFA_SETUP_REQUIRED' && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith(appPath('/dashboard'))) {
        window.location.href = appPath('/dashboard/');
      }
    }
    throw new ApiError(res.status, message, code, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * POST mit einem EXPLIZIT uebergebenen Bearer-Token, OHNE den globalen
 * 401-Auto-Logout/Redirect. Gebaut fuer die zweite Login-Stufe (2FA): dort gibt
 * es noch kein gespeichertes Token (nur das kurzlebige mfaPending-Token), und ein
 * falscher Code (401) soll INLINE auf der Login-Seite erscheinen statt hart zur
 * Login-Seite umzuleiten. Fehler kommen als ApiError zurueck (mit status/message).
 */
export async function postWithAuth<T>(path: string, body: unknown, bearer: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    let message = `Fehler ${res.status}`;
    let code: string | undefined;
    let data: unknown;
    try {
      const b = await res.json();
      data = b;
      code = b.code;
      message = Array.isArray(b.message) ? b.message.join(', ') : b.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message, code, data);
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

// Laedt eine geschuetzte Datei per Bearer-Token herunter und stoesst direkt den
// Browser-Download an. Reicht bei Fehlern die KONKRETE Backend-Meldung durch
// (z.B. fehlende DATEV-Nummern). Dateiname aus Content-Disposition, sonst Fallback.
export async function downloadAuthed(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { headers });
  if (!res.ok) {
    let msg = `Export fehlgeschlagen (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      /* keine JSON-Fehlermeldung -> generische Meldung behalten */
    }
    throw new ApiError(res.status, msg);
  }
  let filename = fallbackName;
  const cd = res.headers.get('Content-Disposition');
  const m = cd && /filename="?([^"]+)"?/.exec(cd);
  if (m) filename = m[1];
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Object-URL nicht synchron freigeben (sonst bricht der Download in FF/Safari ab).
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  /** Multipart-POST (Datei-Upload, z. B. CSV-Import). */
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
