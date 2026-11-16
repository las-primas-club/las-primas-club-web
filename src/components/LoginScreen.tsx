import { ANNOUNCEMENT, CLUB_NAME, INTRO } from "../content";
import { LoginBox } from "./LoginBox";

/** Pantalla que ve quien no ha iniciado sesión: la web entera es privada. */
export function LoginScreen() {
  return (
    <div className="app">
      <div className="announcement">{ANNOUNCEMENT}</div>
      <div className="login-screen">
        <div className="login-card">
          <img src="/logo.svg" alt="" width={88} height={88} className="login-logo" />
          <h1>{CLUB_NAME}</h1>
          <p className="muted">{INTRO.tagline}</p>
          <div className="login-card-action">
            <LoginBox />
          </div>
          <p className="small muted">Solo para miembros del club. Si no puedes entrar, pide que te añadan.</p>
        </div>
      </div>
    </div>
  );
}
