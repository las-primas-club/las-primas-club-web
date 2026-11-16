import { Link } from "react-router";
import { api } from "../api";
import { Cover } from "../components/Cover";
import { INTRO } from "../content";
import { useAsync } from "../useAsync";

export function Home() {
  const { data: book } = useAsync(api.currentBook);
  const { data: round } = useAsync(api.currentRound);

  return (
    <div className="home">
      <section className="hero">
        <h1>Las Primas Club</h1>
        <p className="tagline">{INTRO.tagline}</p>
        {INTRO.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section className="steps">
        {INTRO.howItWorks.map((s, i) => (
          <div key={s.title} className="step">
            <span className="step-n">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </section>

      <section className="home-cards">
        <Link to="/actual" className="card home-card">
          <p className="eyebrow">Leyendo ahora</p>
          {book ? (
            <div className="home-book">
              <Cover book={book} size="sm" />
              <div>
                <h3>{book.title}</h3>
                <p className="muted">{book.author}</p>
              </div>
            </div>
          ) : (
            <p className="muted">Aún no hay libro en curso.</p>
          )}
        </Link>
        <Link to="/votacion" className="card home-card">
          <p className="eyebrow">Siguiente ronda</p>
          {round?.status === "open" ? (
            <>
              <h3>Votación abierta</h3>
              <p className="muted">
                {round.candidates.length} candidatos · {round.voters} voto{round.voters === 1 ? "" : "s"}
              </p>
            </>
          ) : (
            <>
              <h3>Propón un libro</h3>
              <p className="muted">No hay ninguna votación abierta ahora mismo.</p>
            </>
          )}
        </Link>
      </section>
    </div>
  );
}
