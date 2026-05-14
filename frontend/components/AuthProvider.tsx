'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type AuthUser,
  clearUserToken,
  getUserToken,
  me as fetchMe,
} from '@/lib/auth';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  /** Подтянуть свежий профиль с сервера. */
  refresh: () => Promise<void>;
  /** Положить юзера локально (после login/register, чтобы не делать второй запрос). */
  setUser: (u: AuthUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getUserToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await fetchMe();
      setUser(u);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    clearUserToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
