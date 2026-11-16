import { NavLink, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { LoginScreen } from "./components/LoginScreen";
import { ANNOUNCEMENT, CLUB_NAME } from "./content";
import { BookPage } from "./pages/BookPage";
import { CurrentBook } from "./pages/CurrentBook";
import { Home } from "./pages/Home";
import { ReadBooks } from "./pages/ReadBooks";
import { Vote } from "./pages/Vote";

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
            <NavLink to="/" end>
              Inicio
            </NavLink>
            <NavLink to="/actual">Libro actual</NavLink>
            <NavLink to="/votacion">Votación</NavLink>
            <NavLink to="/leidos">Leídos</NavLink>
          </div>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/actual" element={<CurrentBook />} />
          <Route path="/votacion" element={<Vote />} />
          <Route path="/leidos" element={<ReadBooks />} />
          <Route path="/libros/:id" element={<BookPage />} />
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
    </div>
  );
}
