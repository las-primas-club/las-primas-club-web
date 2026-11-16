import { Link } from "react-router";
import type { Kind } from "../../shared/types";
import { api } from "../api";
import { Cover } from "../components/Cover";
import { CLUB_NAME, INTRO } from "../content";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";
import { formatLocalDateTime, isPast } from "../format";
import { NotificationsToggle } from "../components/NotificationsToggle";

/** Lo que toca ahora (libro o película) y, si hay votación abierta, un aviso para votar. */
function NowCard({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { data: item, loading } = useAsync(() => api.currentBook(kind), [kind]);
  const { data: round } = useAsync(() => api.currentRound(kind), [kind]);
  const open = round?.status === "open" ? round : null;

  return (
    <article className="now-card">
      <p className="now-kind">
        {k.section}
      </p>
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : item ? (
        <Link to={k.paths.now} className="now-item">
          <Cover book={item} size="sm" />
          <div>
            <span className="pill pill-accent">{k.nowLabel}</span>
            <h3>
              {item.title}
              {item.year && <span className="muted year"> ({item.year})</span>}
            </h3>
            <p className="muted small">{item.author}</p>
          </div>
        </Link>
      ) : (
        <div className="now-empty">
          <h3>{k.noneCurrent}</h3>
          <p className="muted small">Saldrá de la próxima votación.</p>
        </div>
      )}
      {item?.meet_at && !isPast(item.meet_at) && (
        <Link to={k.paths.now} className="now-meet">
          Quedamos el <strong>{formatLocalDateTime(item.meet_at)}</strong>
          {item.meet_place && ` · ${item.meet_place}`}
        </Link>
      )}
      {open ? (
        <Link to={k.paths.vote} className="now-vote">
          Votación abierta · {open.candidates.length} candidato{open.candidates.length === 1 ? "" : "s"}
          {open.closes_at && !isPast(open.closes_at) && ` · hasta el ${formatLocalDateTime(open.closes_at)}`}
          <span>Votar →</span>
        </Link>
      ) : (
        <Link to={k.paths.vote} className="now-link">
          Proponer {kind === "movie" ? "una película" : "un libro"} ›
        </Link>
      )}
    </article>
  );
}

export function Home() {
  return (
    <div className="home">
      <section className="hero full-bleed">
        <div className="container hero-inner">
          <div className="hero-text">
            <h1>{CLUB_NAME}</h1>
            <p className="hero-sub">{INTRO.tagline}</p>
            <p className="hero-about">{INTRO.about}</p>
          </div>
          <div className="hero-books">
            <img src="/logo.svg" alt="" className="hero-logo" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Ahora mismo</h2>
        </div>
        <div className="now-grid">
          <NowCard kind="book" />
          <NowCard kind="movie" />
        </div>
        <NotificationsToggle />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Cómo funciona</h2>
        </div>
        <p className="section-sub">Así elegimos qué leer y qué ver, ronda a ronda.</p>
        <ol className="flow">
          {INTRO.howItWorks.map((s, i) => (
            <li key={s.title} className="flow-step">
              <span className="flow-n" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h3>
                  {s.title}
                </h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
