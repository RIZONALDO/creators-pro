import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppContext, type Theme } from './AppContext';
import { api } from '@/api';
import { setAuthToken, setRefreshToken, getAuthToken, setOnSessionExpired } from '@/api/client';
import type { User } from '@/types';

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cp_theme') as Theme) || 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  // Reidrata a sessão num reload de página (o token persiste em localStorage) e força logout
  // quando o client.ts esgota a tentativa de refresh automático (ver client.ts:tryRefresh).
  useEffect(() => {
    setOnSessionExpired(() => setUser(null));
    if (!getAuthToken()) { setCheckingSession(false); return; }
    api.auth.me()
      .then(setUser)
      .catch(() => { setAuthToken(null); setRefreshToken(null); })
      .finally(() => setCheckingSession(false));
    return () => setOnSessionExpired(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.auth.login(email, password);
    setUser(session.user);
    return session.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const session = await api.auth.loginWithGoogle(idToken);
    setUser(session.user);
    return session.user;
  }, []);

  const claimInvite = useCallback(async (token: string, idToken: string) => {
    const session = await api.auth.claimInvite(token, idToken);
    setUser(session.user);
    return session.user;
  }, []);

  // O token já foi persistido por api.billing.startTrial (Signup.tsx chama direto, não por aqui)
  // — isso só decide o MOMENTO de entrar de fato no app, depois que a pessoa vê a tela de
  // confirmação do trial (TrialReady.tsx) e clica pra continuar.
  const enterApp = useCallback((newUser: User) => {
    setUser(newUser);
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const session = await api.auth.resetPassword(token, password);
    setUser(session.user);
    return session.user;
  }, []);

  const logout = useCallback(() => {
    api.auth.logout(); // já limpa token + refresh_token (e revoga no servidor)
    setUser(null);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // Evita renderizar a tela de Login por um instante antes de confirmar se o token salvo ainda é válido.
  if (checkingSession) {
    return (
      <div style={{ height: '100dvh', width: '100dvw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)' }}>
        <span style={{ width: 22, height: 22, border: '2px solid var(--line2)', borderTopColor: 'var(--pri)', borderRadius: '50%', display: 'inline-block', animation: 'cpSpin .7s linear infinite' }} />
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, login, loginWithGoogle, claimInvite, resetPassword, enterApp, logout, theme, toggleTheme }}>
      {children}
    </AppContext.Provider>
  );
}
