import { useEffect } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router";
import { useAuth } from "./auth";
import { AdminIcon, BookIcon, HomeIcon, ShelfIcon, VoteIcon } from "./components/Icons";
import { InstallBanner } from "./components/InstallBanner";
import { LoginScreen } from "./components/LoginScreen";
import { ANNOUNCEMENT, CLUB_NAME } from "./content";
import { Admin } from "./pages/Admin";
import { BookPage } from "./pages/BookPage";
import { CurrentBook } from "./pages/CurrentBook";
import { Home } from "./pages/Home";
import { ReadBooks } from "./pages/ReadBooks";
import { Vote } from "./pages/Vote";

const NAV = [
  { to: "/", label: "Inicio", short: "Inicio", icon: HomeIcon, end: true },
  { to: "/actual", label: "Libro actual", short: "Leyendo", icon: BookIcon },
  { to: "/votacion", label: "Votación", short: "Votar", icon: VoteIcon },
  { to: "/leidos", label: "Leídos", short: "Leídos", icon: ShelfIcon },
];

/** Al cambiar de página, volver arriba (en el móvil se nota mucho). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export function App() {
  const { user, ready, logout } = useAuth();
  if (!ready) return null;
  if (!user) return <LoginScreen />;
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
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
            {user.isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </div>
        </nav>
      </header>
      <ScrollToTop />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/actual" element={<CurrentBook />} />
          <Route path="/votacion" element={<Vote />} />
          <Route path="/leidos" element={<ReadBooks />} />
          <Route path="/libros/:id" element={<BookPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-brand">
            <img src="/logo.svg" alt="" width={28} height={28} />
            {CLUB_NAME}
          </span>
          <span>Leemos juntos, opinamos por separado.</span>
        </div>
      </footer>
      <InstallBanner />
      {/* Barra inferior tipo app, solo en móvil */}
      <nav className="tabbar" aria-label="Navegación">
        {NAV.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon />
            <span>{short}</span>
          </NavLink>
        ))}
        {user.isAdmin && (
          <NavLink to="/admin">
            <AdminIcon />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
