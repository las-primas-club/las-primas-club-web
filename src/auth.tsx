import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AppConfig, User } from "../shared/types";
import { api } from "./api";

interface AuthState {
  user: User | null;
  config: AppConfig | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setUser(await api.me().catch(() => null));
  }, []);

  useEffect(() => {
    Promise.all([api.config().then(setConfig), refresh()]).finally(() => setReady(true));
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, config, ready, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}

// Tipos mínimos de Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
            login_uri?: string;
          }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}
