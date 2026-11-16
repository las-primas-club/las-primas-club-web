import { useEffect, useState } from "react";
import { useInstall } from "../pwa";

const DISMISS_KEY = "lpc-install-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Icono de "Compartir" de Safari (cuadrado con flecha hacia arriba). */
const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5v10h14V11h-1" />
  </svg>
);

/** Tarjeta flotante para instalar la web como app. Aparece un momento después de cargar. */
export function InstallBanner() {
  const { mode, install } = useInstall();
  const [hidden, setHidden] = useState(wasDismissed);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Pequeño retraso para no tapar nada nada más abrir la web
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!mode || hidden || !visible) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sin almacenamiento: se volverá a mostrar */
    }
  };

  return (
    <aside className={`install-sheet ${showIosHelp ? "is-ios-help" : ""}`} aria-label="Instalar la app">
      <button className="install-close" onClick={dismiss} aria-label="No mostrar más">
        ×
      </button>
      <div className="install-head">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <div className="install-text">
          <strong>Instala Las Primas Club</strong>
          <span className="small muted">Ábrela desde tu pantalla de inicio, como una app.</span>
        </div>
      </div>

      {mode === "ios" && showIosHelp ? (
        <ol className="install-steps">
          <li>
            Pulsa <span className="install-key"><ShareIcon /> Compartir</span> en la barra de Safari (si no lo ves, está
            dentro del botón <b>···</b>).
          </li>
          <li>
            Elige <span className="install-key">＋ Añadir a pantalla de inicio</span>.
          </li>
          <li>
            Pulsa <b>Añadir</b> arriba a la derecha.
          </li>
        </ol>
      ) : (
        <div className="install-actions">
          <button className="btn btn-ghost" onClick={dismiss}>
            Ahora no
          </button>
          {mode === "prompt" ? (
            <button className="btn" onClick={install}>
              Instalar
            </button>
          ) : (
            <button className="btn" onClick={() => setShowIosHelp(true)}>
              Ver cómo
            </button>
          )}
        </div>
      )}
      {mode === "ios" && showIosHelp && <span className="install-arrow" aria-hidden>↓</span>}
    </aside>
  );
}
