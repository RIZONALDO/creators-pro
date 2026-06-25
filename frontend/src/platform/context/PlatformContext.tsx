import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { platformApi, getPlatformToken, setPlatformToken, type PlatformAdmin } from '../api';

interface PlatformContextValue {
  admin: PlatformAdmin | null;
  loading: boolean;
  // Retorna null se login completo, ou adminId se precisa de TOTP
  login: (email: string, password: string) => Promise<string | null>;
  verifyTotp: (adminId: string, code: string) => Promise<void>;
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

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const result = await platformApi.auth.login(email, password);
    if ('next' in result && result.next === 'totp') {
      return result.adminId;
    }
    const r = result as { token: string; admin: PlatformAdmin };
    setPlatformToken(r.token);
    setAdmin(r.admin);
    return null;
  }, []);

  const verifyTotp = useCallback(async (adminId: string, code: string) => {
    const { token, admin: a } = await platformApi.auth.verifyTotp(adminId, code);
    setPlatformToken(token);
    setAdmin(a);
  }, []);

  const logout = useCallback(() => {
    setPlatformToken(null);
    setAdmin(null);
  }, []);

  return (
    <PlatformContext.Provider value={{ admin, loading, login, verifyTotp, logout }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform deve ser usado dentro de <PlatformProvider>');
  return ctx;
}
