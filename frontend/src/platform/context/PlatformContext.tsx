import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { platformApi, getPlatformToken, setPlatformToken, type PlatformAdmin } from '../api';

interface PlatformContextValue {
  admin: PlatformAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getPlatformToken()) { setLoading(false); return; }
    platformApi.auth.me()
      .then(setAdmin)
      .catch(() => setPlatformToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, admin: a } = await platformApi.auth.login(email, password);
    setPlatformToken(token);
    setAdmin(a);
  }, []);

  const logout = useCallback(() => {
    setPlatformToken(null);
    setAdmin(null);
  }, []);

  return (
    <PlatformContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform deve ser usado dentro de <PlatformProvider>');
  return ctx;
}
