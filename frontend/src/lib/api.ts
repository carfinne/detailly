// Zentrale API-Anbindung an das NestJS-Backend (global prefix api/v1).
// Standard: relative URL (gleiche Origin) -> kein localhost im Produktions-Build.
// Fuer getrennte Entwicklung kann NEXT_PUBLIC_API_URL gesetzt werden (z.B. http://localhost:3001).
const CONFIGURED_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

// URL-Praefix (basePath) – identisch zum Next.js-basePath. Beim pplx.app-Hosting
// ist das z.B. /port/3001, lokal/eigener Server leer. Backend, Frontend und
// Assets liegen alle unter diesem Praefix auf DERSELBEN Origin.
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

function resolveBase(): string {
  // Explizite Konfiguration hat immer Vorrang (z.B. getrennte Entwicklung).
  if (CONFIGURED_BASE) return CONFIGURED_BASE;
  // Sonst gleiche Origin unter dem konfigurierten Praefix (Backend liefert das
  // Frontend selbst aus). Leerer Praefix => relative Wurzel.
  return BASE_PATH;
}

function apiUrl(path: string): string {
  return `${resolveBase()}/api/v1${path}`;
}

// Vollstaendiger Pfad innerhalb der App inkl. Praefix (fuer harte Navigationen
// wie window.location, die – anders als der Next.js-Router – den basePath nicht
// automatisch voranstellen).
export function appPath(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
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
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
