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
        <p className="muted small">
          El código hay que meterlo una vez por dispositivo; después Jellyfin te recuerda. Desde la app instalada de
          Las Primas Club, Jellyfin se abre en el navegador para que puedas volver aquí con el código.
        </p>
      </RequireLogin>
    </div>
  );
}
