import { useState } from "react";
import { useInstall } from "../pwa";

const DISMISS_KEY = "lpc-install-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Aviso para instalar la web como app en el móvil. */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const [hidden, setHidden] = useState(wasDismissed);
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (!mode || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sin almacenamiento: se volverá a mostrar */
    }
  };

  return (
    <div className="install-banner" role="region" aria-label="Instalar la app">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-text">
        <strong>Instala Las Primas en tu móvil</strong>
        {mode === "ios" && showIosHelp ? (
          <span className="small">
            Pulsa <b>Compartir</b> <span aria-hidden>⎋</span> abajo en Safari y luego <b>Añadir a pantalla de inicio</b>.
          </span>
        ) : (
          <span className="small muted">Ábrela como una app, a pantalla completa.</span>
        )}
      </div>
      {mode === "prompt" && (
        <button className="btn" onClick={install}>
          Instalar
        </button>
      )}
      {mode === "ios" && !showIosHelp && (
        <button className="btn" onClick={() => setShowIosHelp(true)}>
          Cómo
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}
