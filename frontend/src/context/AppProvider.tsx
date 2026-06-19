import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppContext, type Theme } from './AppContext';
import { api } from '@/api';
import { setAuthToken } from '@/api/client';
import type { User } from '@/types';

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cp_theme') as Theme) || 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.auth.login(email, password);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout();
    setAuthToken(null);
    setUser(null);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <AppContext.Provider value={{ user, login, logout, theme, toggleTheme }}>
      {children}
    </AppContext.Provider>
  );
}
