import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";
import { ProposeForm } from "../components/ProposeForm";
import { RequireLogin } from "../components/LoginBox";
import { SectionNav } from "../components/SectionNav";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";
import type { Kind } from "../../shared/types";

export function Vote({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { user } = useAuth();
  const { data: round, loading, error: loadError, reload: reloadRound } = useAsync(() => api.currentRound(kind), [user?.id, kind]);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed", kind), [kind]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => Promise.all([reloadRound(), reloadProposed()]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SectionNav kind={kind} />;
  const open = round?.status === "open" ? round : null;
  const winner = round?.status === "closed" ? round.candidates.find((c) => c.book.id === round.winner_book_id) : null;

  return (
    <div className="vote-page page">
      <SectionNav kind={kind} />
      <h1 className="page-title">Votación{kind === "movie" ? " de cine" : ""}</h1>
      {loadError && <p className="error">{loadError}</p>}
      {error && <p className="error">{error}</p>}

      {open ? (
        <section>
          <p className="lead">
            {k.voteLead} Tienes un voto y puedes cambiarlo mientras la ronda siga abierta.{" "}
            <span className="muted">
              {open.voters} voto{open.voters === 1 ? "" : "s"} en total.
            </span>
          </p>
          {open.candidates.length === 0 && <p className="muted">Todavía no hay candidatos. ¡Propón uno abajo!</p>}
          <ul className="candidates">
            {open.candidates.map(({ book, votes }) => {
              const pct = open.voters ? Math.round((votes / open.voters) * 100) : 0;
              const mine = open.my_vote === book.id;
              return (
                <li key={book.id} className={`candidate ${mine ? "is-mine" : ""}`}>
                  <Cover book={book} size="sm" />
                  <div className="candidate-info">
                    {mine && <span className="pill pill-accent">✔ Tu voto</span>}
                    <h3>
                      <Link to={k.paths.item(book.id)}>{book.title}</Link>
                      {book.year && <span className="muted year"> ({book.year})</span>}
                    </h3>
                    <p className="muted">
                      {book.author}
                      {book.proposed_by_name && ` · propuesto por ${book.proposed_by_name}`}
                    </p>
                    {book.description && <p className="small">{book.description}</p>}
                    <div className="bar" aria-label={`${votes} votos`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="small muted">
                      {votes} voto{votes === 1 ? "" : "s"} · {pct}%
                    </p>
                  </div>
                  <div className="candidate-actions">
                    {user && (
                      <button className={`btn ${mine ? "" : "btn-ghost"}`} disabled={busy || mine} onClick={() => run(() => api.vote(open.id, book.id))}>
                        {mine ? "Tu voto ✓" : "Votar"}
                      </button>
                    )}
                    {user && (user.isAdmin || book.proposed_by === user.id) && (
                      <button
                        className="link-btn"
                        disabled={busy}
                        onClick={() => confirm(`¿Quitar "${book.title}"?`) && run(() => api.deleteBook(book.id))}
                      >
                        quitar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!user && (
            <RequireLogin message="Entra con tu cuenta de Google para votar.">
              <></>
            </RequireLogin>
          )}
          {user?.isAdmin && (
            <div className="admin-bar">
              <span>Admin</span>
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  confirm(`¿Cerrar la votación? ${kind === "movie" ? "La película más votada pasará a ser la siguiente que veamos" : "El libro más votado pasará a ser el libro en curso"}.`) &&
                  run(() => api.closeRound(open.id))
                }
              >
                Cerrar votación
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  confirm(`¿Cancelar la ronda? Se borrarán sus votos; las propuestas se mantienen.`) &&
                  run(() => api.cancelRound(open.id))
                }
              >
                Cancelar ronda
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          {winner ? (
            <p>
              La última votación la ganó <Link to={k.paths.item(winner.book.id)}>{winner.book.title}</Link> con {winner.votes}{" "}
              voto{winner.votes === 1 ? "" : "s"}.
            </p>
          ) : (
            <p>No hay ninguna votación abierta.</p>
          )}
          <p className="muted">
            Puedes ir proponiendo {k.nounPlural}; entrarán como candidatos en la próxima ronda.
          </p>
          {proposed && proposed.length > 0 && (
            <ul className="proposed-list">
              {proposed.map((b) => (
                <li key={b.id}>
                  <strong>{b.title}</strong> <span className="muted">· {b.author}</span>
                  {user?.isAdmin && (
                    <>
                      {" "}
                      <button
                        className="link-btn"
                        disabled={busy}
                        onClick={() =>
                          confirm(`¿Elegir "${b.title}" ya, sin votación?`) && run(() => api.startBook(b.id))
                        }
                      >
                        {k.startAction}
                      </button>
                      <button
                        className="link-btn"
                        disabled={busy}
                        onClick={() => confirm(`¿Borrar "${b.title}"?`) && run(() => api.deleteBook(b.id))}
                      >
                        borrar
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {user?.isAdmin && (
            <div className="admin-bar">
              <span>Admin</span>
              <button className="btn" disabled={busy} onClick={() => run(() => api.openRound(kind))}>
                Abrir nueva votación
              </button>
            </div>
          )}
        </section>
      )}

      <section className="detail-section">
        <h2 className="rule-title">{k.proposeTitle}</h2>
        <RequireLogin message={`Entra para proponer ${k.nounPlural}.`}>
          <ProposeForm kind={kind} onDone={reload} />
        </RequireLogin>
      </section>
    </div>
  );
}
