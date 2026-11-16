import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

/** Botón de login con Google (y login de desarrollo si está activado). */
export function LoginBox({ compact = false }: { compact?: boolean }) {
  const { config, refresh } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = config?.googleClientId;
    if (!clientId || !btnRef.current) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.google) return void setTimeout(tryRender, 200);
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            setError(null);
            await api.loginGoogle(credential);
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current!, {
        theme: "outline",
        size: compact ? "medium" : "large",
        text: "signin_with",
        shape: "pill",
        locale: "es",
      });
    };
    tryRender();
    return () => {
      cancelled = true;
    };
  }, [config?.googleClientId, compact, refresh]);

  const devLogin = async () => {
    const email = prompt("Email de prueba", "dev@example.com");
    if (!email) return;
    try {
      await api.loginDev(email.split("@")[0], email);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="login-box">
      {config?.googleClientId ? <div ref={btnRef} /> : !config?.devLogin && <span className="muted">Login no configurado</span>}
      {config?.devLogin && (
        <button className="btn btn-ghost" onClick={devLogin}>
          Entrar (dev)
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

/** Muestra el contenido solo si hay sesión; si no, invita a entrar. */
export function RequireLogin({ children, message }: { children: React.ReactNode; message: string }) {
  const { user } = useAuth();
  if (user) return <>{children}</>;
  return (
    <div className="card login-prompt">
      <p>{message}</p>
      <LoginBox />
    </div>
  );
}
