import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type AppConfig, type Settings, type User } from "../shared/types";
import { api, UNAUTHORIZED_EVENT } from "./api";

interface AuthState {
  user: User | null;
  config: AppConfig | null;
  /** Normas del club (votos, propuestas…). Las cambia un admin en el panel. */
  settings: Settings;
  setSettings: (s: Settings) => void;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const me = await api.me().catch(() => null);
    // Las normas solo se pueden leer con sesión.
    if (me) await api.settings().then(setSettings).catch(() => {});
    setUser(me);
  }, []);

  useEffect(() => {
    Promise.all([api.config().then(setConfig), refresh()]).finally(() => setReady(true));
  }, [refresh]);

  // Si la API responde 401 (sesión caducada o ya no eres miembro), se vuelve a la pantalla de entrada.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, config, settings, setSettings, ready, refresh, logout }}>{children}</AuthContext.Provider>;
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
