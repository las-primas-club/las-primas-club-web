import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { browserUrl } from "../external";
import { useAuth } from "../auth";
import { useAsync } from "../useAsync";

/**
 * Mi acceso al Jellyfin del club: activar la cuenta (la crea la web, solo con películas) y entrar sin contraseña
 * metiendo aquí el código de Quick Connect que muestra Jellyfin en su pantalla de inicio (navegador, móvil o tele).
 */
export function JellyfinAccess({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { data: me, loading, reload } = useAsync(() => (user ? api.jellyfinMe() : Promise.resolve(null)), [user?.id]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!user || loading || !me?.enabled) return null;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const activate = () =>
    run(async () => {
      const { name } = await api.activateJellyfin();
      await reload();
      return `Cuenta lista: tu usuario es "${name}".`;
    });

  const approve = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.jellyfinQuickConnect(code);
      setCode("");
      return "¡Dentro! Vuelve a Jellyfin: en unos segundos entra solo.";
    });
  };

  return (
    <div className={`jellyfin-access ${compact ? "is-compact" : ""}`}>
      {!me.account ? (
        <>
          <p>
            <strong>Usa tu cuenta del club en Jellyfin.</strong>{" "}
            <span className="muted">Te creamos un usuario que solo ve las películas. No necesitas contraseña.</span>
          </p>
          <button className="btn btn-dark" disabled={busy} onClick={activate}>
            {busy ? "Creando…" : "Activar mi cuenta de Jellyfin"}
          </button>
        </>
      ) : !me.quickConnect ? (
        <p className="muted small">
          Tu usuario de Jellyfin es <b>{me.account.name}</b>. Para entrar sin contraseña hace falta que un admin active
          Quick Connect en Jellyfin.
        </p>
      ) : (
        <>
          <p className="small">
            Tu usuario de Jellyfin es <b>{me.account.name}</b>. Para entrar sin contraseña:
          </p>
          <ol className="qc-steps small">
            <li>
              {me.url ? (
                <a className="btn btn-ghost btn-sm" href={browserUrl(`${me.url.replace(/\/+$/, "")}/web/`)} target="_blank" rel="noopener noreferrer">
                  Abrir Jellyfin
                </a>
              ) : (
                "Abre Jellyfin"
              )}{" "}
              <span className="muted">(o su app de móvil o tele)</span>
            </li>
            <li>
              Pulsa <b>Quick Connect</b> en su pantalla de inicio.
            </li>
            <li>Vuelve aquí y escribe el código de 6 números:</li>
          </ol>
          <form className="qc-form" onSubmit={approve}>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              placeholder="123456"
              aria-label="Código de Quick Connect"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            />
            <button className="btn btn-dark" disabled={busy || code.length !== 6}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
          {compact && (
            <p className="muted small">
              <Link to="/cine/jellyfin">Más ayuda para entrar ›</Link>
            </p>
          )}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
