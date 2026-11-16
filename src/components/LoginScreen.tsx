import { useState } from "react";
import { ANNOUNCEMENT, CLUB_NAME, INTRO } from "../content";
import { LoginBox } from "./LoginBox";

// El Worker manda un código; el texto lo ponemos aquí (así un enlace no puede colar un mensaje inventado).
const LOGIN_ERRORS: Record<string, string> = {
  failed: "No se pudo iniciar sesión. Inténtalo de nuevo.",
  not_member:
    "Todavía no eres miembro del club. Tu solicitud ha quedado registrada: en cuanto un admin la acepte, podrás entrar.",
};

/** Pantalla que ve quien no ha iniciado sesión: la web entera es privada. */
export function LoginScreen() {
  // Si el login por redirección falló, el Worker vuelve a "/?login_error=…"
  const [loginError] = useState(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("login_error");
    if (!code) return null;
    history.replaceState(null, "", location.pathname);
    return LOGIN_ERRORS[code] ?? LOGIN_ERRORS.failed;
  });
  return (
    <div className="app">
      <div className="announcement">{ANNOUNCEMENT}</div>
      <div className="login-screen">
        <div className="login-card">
          <img src="/logo.svg" alt="" width={88} height={88} className="login-logo" />
          <h1>{CLUB_NAME}</h1>
          <p className="muted">{INTRO.tagline}</p>
          {loginError && <p className="error">{loginError}</p>}
          <div className="login-card-action">
            <LoginBox />
          </div>
          <p className="small muted">Solo para miembros del club. Si no puedes entrar, pide que te añadan.</p>
        </div>
      </div>
    </div>
  );
}
