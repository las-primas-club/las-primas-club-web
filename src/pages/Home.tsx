import { Link } from "react-router";
import { api } from "../api";
import { BookCard } from "../components/BookCard";
import { Cover } from "../components/Cover";
import { INTRO } from "../content";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";
import type { Round } from "../../shared/types";

function VoteBanner({ round, to, label }: { round: Round | null | undefined; to: string; label: string }) {
  if (round?.status !== "open") return null;
  return (
    <Link to={to} className="vote-banner">
      <span className="pill pill-accent">🗳️ {label}</span>
      <strong>
        {round.candidates.length} candidatos · {round.voters} voto{round.voters === 1 ? "" : "s"}
      </strong>
      <span className="vote-banner-cta">Votar →</span>
    </Link>
  );
}

export function Home() {
  const { data: book } = useAsync(() => api.currentBook("book"));
  const { data: round } = useAsync(() => api.currentRound("book"));
  const { data: read } = useAsync(() => api.books("read", "book"));
  const { data: movie } = useAsync(() => api.currentBook("movie"));
  const { data: movieRound } = useAsync(() => api.currentRound("movie"));
  const { data: watched } = useAsync(() => api.books("read", "movie"));
  const cine = KINDS.movie;

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

      <VoteBanner round={round} to="/votacion" label="Votación de libros abierta" />
      <VoteBanner round={movieRound} to={cine.paths.vote} label="Votación de cine abierta" />

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

      <section className="section">
        <div className="section-head">
          <h2>Cine</h2>
          <Link to={cine.paths.now} className="see-more">
            Ver sección ›
          </Link>
        </div>
        <p className="section-sub">Entre libro y libro, también vemos películas juntos.</p>
        {movie ? (
          <Link to={cine.paths.now} className="movie-now">
            <Cover book={movie} size="md" />
            <div>
              <span className="pill pill-accent">{cine.nowLabel}</span>
              <h3>
                {movie.title}
                {movie.year && <span className="muted year"> ({movie.year})</span>}
              </h3>
              <p className="muted">{cine.byPrefix}{movie.author}</p>
              <span className="see-more">Puntuar y comentar ›</span>
            </div>
          </Link>
        ) : (
          <p>
            Todavía no hay película elegida. <Link to={cine.paths.vote}>Propón una</Link> para la próxima votación.
          </p>
        )}
        {watched && watched.length > 0 && (
          <ul className="card-row">
            {watched.slice(0, 6).map((m) => (
              <li key={m.id}>
                <BookCard book={m} />
              </li>
            ))}
          </ul>
        )}
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
