'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, clearToken, getToken, appPath } from './api';
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

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    setToken(res.accessToken);
    setUser(res.user ?? (await api.get<AuthUser>('/auth/me')));
  }, []);

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
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
