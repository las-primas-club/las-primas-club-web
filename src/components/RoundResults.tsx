import { Link } from "react-router";
import type { Round } from "../../shared/types";
import { useAuth } from "../auth";
import { formatDate } from "../format";
import { KINDS } from "../kinds";
import { Cover } from "./Cover";

/** Resultado de una ronda cerrada: candidatos con sus votos y cómo votó cada uno. */
export function RoundResults({
  round,
  busy,
  canRepropose,
  onRepropose,
}: {
  round: Round;
  busy?: boolean;
  /** Si quien mira aún puede proponer (no ha llegado al límite). */
  canRepropose?: boolean;
  onRepropose?: (bookId: number) => void;
}) {
  const k = KINDS[round.kind];
  const { user } = useAuth();
  const titles = new Map(round.candidates.map((c) => [c.book.id, c.book.title]));

  return (
    <article className="round-result">
      <header className="round-head">
        <h3>Ronda del {formatDate(round.closed_at ?? round.created_at)}</h3>
        <span className="muted small">
          {round.voters} persona{round.voters === 1 ? "" : "s"} · {round.total_votes} voto{round.total_votes === 1 ? "" : "s"}
        </span>
      </header>

      <ol className="round-candidates">
        {round.candidates.map(({ book, votes }) => {
          const won = book.id === round.winner_book_id;
          return (
            <li key={book.id} className={won ? "is-winner" : ""}>
              <Cover book={book} size="sm" />
              <div className="round-candidate-info">
                {won && <span className="pill pill-accent">Ganador{round.kind === "movie" ? "a" : ""}</span>}
                <Link to={k.paths.item(book.id)}>
                  <strong>{book.title}</strong>
                </Link>
                {book.year && <span className="muted year"> ({book.year})</span>}
                <p className="muted small">
                  {book.author}
                  {book.proposed_by_name && ` · ${k.proposedBy} ${book.proposed_by_name}`}
                </p>
                {user && book.status === "proposed" && book.archived_at && onRepropose && (
                  <button
                    className="link-btn"
                    disabled={busy || !canRepropose}
                    title={canRepropose ? undefined : "Ya tienes el máximo de propuestas"}
                    onClick={() => onRepropose(book.id)}
                  >
                    volver a proponer
                  </button>
                )}
                {book.status === "proposed" && !book.archived_at && !won && (
                  <span className="muted small">Vuelve a estar propuest{round.kind === "movie" ? "a" : "o"}</span>
                )}
              </div>
              <span className="round-votes">
                <strong>{votes}</strong>
                <span className="muted small"> voto{votes === 1 ? "" : "s"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {round.ballots && round.ballots.length > 0 && (
        <details className="ballots" open>
          <summary>Cómo votó cada uno</summary>
          <ul>
            {round.ballots.map((b) => {
              // Un chip por candidato votado, con ×N si le dio varios votos.
              const counts = new Map<number, number>();
              for (const id of b.book_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
              return (
                <li key={b.user_id}>
                  <strong>{b.name}</strong>
                  <span>
                    {[...counts].map(([id, n]) => (
                      <span key={id} className="vote-chip">
                        {titles.get(id)}
                        {n > 1 && ` ×${n}`}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </article>
  );
}
