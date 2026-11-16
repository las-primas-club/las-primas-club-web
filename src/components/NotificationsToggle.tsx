import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { isIOS, isStandalone } from "../pwa";

function keyBytes(base64url: string) {
  const bin = atob(base64url.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

/** Activar o desactivar los avisos push en este dispositivo (votación abierta, ganador, quedada). */
export function NotificationsToggle() {
  const { config } = useAuth();
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported || !config?.pushKey) return;
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => !cancelled && setOn(Boolean(sub)))
      .catch(() => !cancelled && setOn(false));
    return () => {
      cancelled = true;
    };
  }, [supported, config?.pushKey]);

  if (!config?.pushKey) return null;
  // En iPhone los avisos solo funcionan con la web añadida a la pantalla de inicio.
  if (!supported) {
    return isIOS() && !isStandalone() ? (
      <p className="notify muted small">🔔 Para recibir avisos en el iPhone, añade primero la web a la pantalla de inicio.</p>
    ) : null;
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current) {
        await api.pushUnsubscribe(current.endpoint).catch(() => {});
        await current.unsubscribe();
        setOn(false);
      } else {
        if ((await Notification.requestPermission()) !== "granted") {
          throw new Error("Has bloqueado los avisos. Actívalos en los ajustes del navegador para esta web.");
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.pushKey!) });
        await api.pushSubscribe(sub.endpoint);
        setOn(true);
      }
    } catch (e) {
      setError((e as Error).message || "No se pudieron cambiar los avisos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notify">
      <span>
        🔔 <strong>Avisos</strong>{" "}
        <span className="muted small">
          {on ? "Te avisaremos en este dispositivo cuando se abra una votación, haya ganador o se ponga la quedada." : "Entérate cuando se abra una votación, haya ganador o se ponga la quedada."}
        </span>
      </span>
      <button className={`btn ${on ? "btn-ghost" : ""}`} disabled={busy || on === null} onClick={toggle}>
        {on ? "Desactivar" : "Activar avisos"}
      </button>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
