import { createContext, useContext } from 'react';
import type { User } from '@/types';

export type Theme = 'dark' | 'light';

export interface AppContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  claimInvite: (token: string, idToken: string) => Promise<User>;
  resetPassword: (token: string, password: string) => Promise<User>;
  /** Sessão já existe (token persistido), só falta "comitar" pro app — usado pela tela de
   * confirmação do trial (Signup.tsx -> TrialReady.tsx), que decide o momento exato de entrar,
   * em vez de redirecionar sozinho assim que a conta é criada. */
  enterApp: (user: User) => void;
  logout: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>');
  return ctx;
}
