import { NavLink, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { LoginBox } from "./components/LoginBox";
import { CLUB_NAME } from "./content";
import { BookPage } from "./pages/BookPage";
import { CurrentBook } from "./pages/CurrentBook";
import { Home } from "./pages/Home";
import { ReadBooks } from "./pages/ReadBooks";
import { Vote } from "./pages/Vote";

export function App() {
  const { user, ready, logout } = useAuth();
  return (
    <div className="app">
      <header className="site-header">
        <NavLink to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          {CLUB_NAME}
        </NavLink>
        <nav>
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/actual">Libro actual</NavLink>
          <NavLink to="/votacion">Votación</NavLink>
          <NavLink to="/leidos">Leídos</NavLink>
        </nav>
        <div className="user-area">
          {!ready ? null : user ? (
            <>
              {user.picture && <img className="avatar-img" src={user.picture} alt="" referrerPolicy="no-referrer" />}
              <span className="user-name">{user.name.split(" ")[0]}</span>
              <button className="link-btn" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <LoginBox compact />
          )}
        </div>
      </header>
      <main>
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
        <span>{CLUB_NAME} · hecho con cariño</span>
      </footer>
    </div>
  );
}
