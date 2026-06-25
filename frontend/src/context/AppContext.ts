import { createContext, useContext } from 'react';
import type { User } from '@/types';

export type Theme = 'dark' | 'light';

export interface AppContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  claimInvite: (token: string, idToken: string) => Promise<User>;
  startTrial: (input: { company_name: string; admin_name: string; admin_email: string; admin_password: string }) => Promise<User>;
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
