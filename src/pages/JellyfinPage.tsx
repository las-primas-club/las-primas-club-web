import { JellyfinAccess } from "../components/JellyfinAccess";
import { RequireLogin } from "../components/LoginBox";
import { SectionNav } from "../components/SectionNav";

/** Página para entrar en el Jellyfin del club (útil desde la tele, sin pasar por una película). */
export function JellyfinPage() {
  return (
    <div className="page jellyfin-page">
      <SectionNav kind="movie" />
      <h1 className="page-title">Jellyfin del club</h1>
      <p className="lead">Las películas del club, con tu propia cuenta y sin contraseñas.</p>
      <RequireLogin message="Entra para usar el Jellyfin del club.">
        <section className="panel">
          <JellyfinAccess />
        </section>
        <section className="detail-section">
          <h2 className="rule-title">Cómo entrar</h2>
          <ol className="jellyfin-steps">
            <li>Activa tu cuenta aquí arriba (solo la primera vez).</li>
            <li>
              Abre Jellyfin en el navegador, el móvil o la tele y pulsa <b>Quick Connect</b> en la pantalla de inicio.
            </li>
            <li>Escribe aquí el código de 6 números que te sale. En unos segundos estarás dentro.</li>
          </ol>
          <p className="muted small">El código hay que meterlo una vez por dispositivo; después Jellyfin te recuerda.</p>
        </section>
      </RequireLogin>
    </div>
  );
}
