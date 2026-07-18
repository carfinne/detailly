'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, clearToken, getToken, appPath, postWithAuth } from './api';
import type { AuthUser } from './types';

export interface RegisterPayload {
  firmenname: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  /** Ausrichtung des Betriebs (Branchen-Theming + Kalkulations-Katalog). */
  betriebstyp?: 'aufbereitung' | 'folierung' | 'ppf' | 'komplett';
}

/**
 * Ergebnis von login(): entweder direkt angemeldet ('ok', mit aufgeloestem
 * Nutzer fuer die rollenabhaengige Weiterleitung) oder es fehlt die zweite
 * Faktor-Stufe ('mfa') – dann traegt mfaToken das kurzlebige mfaPending-Token
 * fuer completeMfa().
 */
export type LoginResult = { status: 'ok'; user: AuthUser } | { status: 'mfa'; mfaToken: string };

/** Antwort von POST /auth/login (zweistufig moeglich). */
interface LoginResponse {
  accessToken?: string;
  user?: AuthUser;
  mfaErforderlich?: boolean;
  mfaToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** Zweite Login-Stufe: TOTP-Code ODER Recovery-Code gegen das mfaPending-Token. */
  completeMfa: (mfaToken: string, payload: { code?: string; recoveryCode?: string }) => Promise<AuthUser>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  /** Laedt /auth/me neu, z. B. nach dem Bearbeiten des eigenen Profils. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    // Zweistufig: bei aktivem 2FA gibt es KEIN Voll-JWT, sondern nur das
    // kurzlebige mfaPending-Token -> zweite Stufe anfordern.
    if (res.mfaErforderlich && res.mfaToken) {
      return { status: 'mfa', mfaToken: res.mfaToken };
    }
    setToken(res.accessToken!);
    const u = res.user ?? (await api.get<AuthUser>('/auth/me'));
    setUser(u);
    return { status: 'ok', user: u };
  }, []);

  const completeMfa = useCallback(
    async (mfaToken: string, payload: { code?: string; recoveryCode?: string }) => {
      // Eigener Bearer (mfaPending-Token) + kein globaler 401-Redirect: ein
      // falscher Code soll inline auf der Login-Seite bleiben.
      const res = await postWithAuth<{ accessToken: string; user: AuthUser }>(
        '/auth/mfa/verify',
        payload,
        mfaToken,
      );
      setToken(res.accessToken);
      const u = res.user ?? (await api.get<AuthUser>('/auth/me'));
      setUser(u);
      return u;
    },
    [],
  );

  const register = useCallback(async (data: RegisterPayload) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/tenants/register', data);
    setToken(res.accessToken);
    setUser(res.user ?? (await api.get<AuthUser>('/auth/me')));
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = appPath('/login/');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeMfa, register, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
