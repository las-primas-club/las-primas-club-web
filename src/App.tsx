import { useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { AdminIcon, BookIcon, FilmIcon, HomeIcon, SOCIAL_ICONS } from "./components/Icons";
import { InstallBanner } from "./components/InstallBanner";
import { LoginScreen } from "./components/LoginScreen";
import { ANNOUNCEMENT, CLUB_NAME, SOCIAL } from "./content";
import { Admin } from "./pages/Admin";
import { BookPage } from "./pages/BookPage";
import { CurrentBook } from "./pages/CurrentBook";
import { Home } from "./pages/Home";
import { ReadBooks } from "./pages/ReadBooks";
import { Vote } from "./pages/Vote";
import { RoundHistory } from "./pages/RoundHistory";

// Cada sección agrupa varias rutas (en curso, votación, historial y fichas).
const NAV = [
  { to: "/", label: "Inicio", icon: HomeIcon, match: (p: string) => p === "/" },
  {
    to: "/actual",
    label: "Libros",
    icon: BookIcon,
    match: (p: string) => ["/actual", "/leidos"].includes(p) || p.startsWith("/votacion") || p.startsWith("/libros/"),
  },
  { to: "/cine", label: "Cine", icon: FilmIcon, match: (p: string) => p.startsWith("/cine") || p.startsWith("/peliculas/") },
  { to: "/admin", label: "Admin", icon: AdminIcon, match: (p: string) => p === "/admin", admin: true },
];

/** Al cambiar de página, volver arriba (en el móvil se nota mucho). */
function ScrollToTop() {
  const { pathname } = useLocation();
  // Con llaves: en Chrome reciente scrollTo() devuelve una Promise y React la tomaría por la función de limpieza.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const { user, ready, logout } = useAuth();
  const { pathname } = useLocation();
  if (!ready) return null;
  if (!user) return <LoginScreen />;
  const nav = NAV.filter((n) => !n.admin || user.isAdmin);
  return (
    <div className="app">
      <div className="announcement">{ANNOUNCEMENT}</div>
      <header className="site-header">
        <div className="container header-top">
          <NavLink to="/" className="brand">
            <img src="/logo.svg" alt="" width={44} height={44} />
            <span>{CLUB_NAME}</span>
          </NavLink>
          <div className="user-area">
            {user.picture ? (
              <img className="avatar-img" src={user.picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar avatar-sm">{user.name[0]}</span>
            )}
            <span className="user-name">{user.name.split(" ")[0]}</span>
            <button className="link-btn" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
        <nav className="site-nav">
          <div className="container nav-inner">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className={n.match(pathname) ? "active" : ""}>
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <ScrollToTop />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/actual" element={<CurrentBook kind="book" />} />
          <Route path="/votacion" element={<Vote kind="book" />} />
          <Route path="/votacion/rondas" element={<RoundHistory kind="book" />} />
          <Route path="/leidos" element={<ReadBooks kind="book" />} />
          <Route path="/libros/:id" element={<BookPage />} />
          <Route path="/cine" element={<CurrentBook kind="movie" />} />
          <Route path="/cine/votacion" element={<Vote kind="movie" />} />
          <Route path="/cine/votacion/rondas" element={<RoundHistory kind="movie" />} />
          <Route path="/cine/vistas" element={<ReadBooks kind="movie" />} />
          <Route path="/peliculas/:id" element={<BookPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="*"
            element={
              <div className="empty page">
                <h1>Página no encontrada</h1>
                <p>
                  <Link to="/">Volver al inicio</Link>
                </p>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-brand">
            <img src="/logo.svg" alt="" width={28} height={28} />
            {CLUB_NAME}
          </span>
          <span>Leemos juntos, opinamos por separado.</span>
          <ul className="social">
            {SOCIAL.map(({ name, url, icon }) => {
              const Icon = SOCIAL_ICONS[icon];
              return (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}>
                    <Icon />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </footer>
      <InstallBanner />
      {/* Barra inferior tipo app, solo en móvil */}
      <nav className="tabbar" aria-label="Navegación">
        {nav.map(({ to, label, icon: Icon, match }) => (
          <Link key={to} to={to} className={match(pathname) ? "active" : ""}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
