import { Link } from "react-router";
import { api } from "../api";
import { BookCard } from "../components/BookCard";
import { Cover } from "../components/Cover";
import { INTRO } from "../content";
import { useAsync } from "../useAsync";

export function Home() {
  const { data: book } = useAsync(api.currentBook);
  const { data: round } = useAsync(api.currentRound);
  const { data: read } = useAsync(() => api.books("read"));
  const open = round?.status === "open" ? round : null;

  return (
    <div className="home">
      <section className="hero full-bleed">
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="pill pill-light">{book ? "📖 Leyendo ahora" : "👋 Bienvenidos"}</span>
            <h1>{book ? book.title : "Las Primas Club"}</h1>
            <p className="hero-sub">{book ? book.author : INTRO.tagline}</p>
            <Link to={book ? "/actual" : "/votacion"} className="btn btn-dark">
              {book ? "Ver libro y comentar" : "Proponer un libro"}
            </Link>
          </div>
          <div className="hero-books">
            {book ? (
              <Cover book={book} size="xl" />
            ) : (
              <img src="/logo.svg" alt="" className="hero-logo" />
            )}
          </div>
        </div>
      </section>

      {open && (
        <Link to="/votacion" className="vote-banner">
          <span className="pill pill-accent">🗳️ Votación abierta</span>
          <strong>
            {open.candidates.length} candidatos · {open.voters} voto{open.voters === 1 ? "" : "s"}
          </strong>
          <span className="vote-banner-cta">Votar →</span>
        </Link>
      )}

      <section className="section">
        <div className="section-head">
          <h2>El club</h2>
        </div>
        <p className="section-sub">{INTRO.tagline}</p>
        <div className="intro-text">
          {INTRO.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="steps">
          {INTRO.howItWorks.map((s, i) => (
            <div key={s.title} className="step">
              <span className="step-n">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {read && read.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Ya leídos</h2>
            <Link to="/leidos" className="see-more">
              Ver todos ›
            </Link>
          </div>
          <p className="section-sub">Lo que hemos leído y lo que nos pareció</p>
          <ul className="card-row">
            {read.slice(0, 6).map((b) => (
              <li key={b.id}>
                <BookCard book={b} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
