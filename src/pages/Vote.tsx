import { useState } from "react";
import { Link } from "react-router";
import { MAX_PROPOSALS, MAX_VOTES, type Book, type Kind } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";
import { useConfirm } from "../components/Dialog";
import { ProposeForm } from "../components/ProposeForm";
import { RequireLogin } from "../components/LoginBox";
import { RoundResults } from "../components/RoundResults";
import { SectionNav } from "../components/SectionNav";
import { Synopsis } from "../components/Synopsis";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";
import { formatLocalDateTime, isPast } from "../format";

/** Puntitos con los votos que me quedan. */
function VoteDots({ used }: { used: number }) {
  return (
    <span className="vote-dots" aria-label={`Te quedan ${MAX_VOTES - used} de ${MAX_VOTES} votos`}>
      {Array.from({ length: MAX_VOTES }, (_, i) => (
        <span key={i} className={i < used ? "used" : ""} />
      ))}
    </span>
  );
}

export function Vote({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { user } = useAuth();
  const ask = useConfirm();
  const { data: round, loading, error: loadError, reload: reloadRound } = useAsync(() => api.currentRound(kind), [user?.id, kind]);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed", kind), [kind]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [editingDeadline, setEditingDeadline] = useState(false);

  const reload = () => Promise.all([reloadRound(), reloadProposed()]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeProposal = async (b: Pick<Book, "id" | "title">) =>
    (await ask({
      title: `¿Quitar "${b.title}"?`,
      message: "Se borrará la propuesta junto con sus votos.",
      confirmLabel: "Quitar",
      danger: true,
    })) && run(() => api.deleteBook(b.id));

  if (loading) return <SectionNav kind={kind} />;
  const myProposals = user ? (proposed ?? []).filter((b) => b.proposed_by === user.id) : [];
  const proposalsLeft = MAX_PROPOSALS - myProposals.length;
  const open = round?.status === "open" ? round : null;
  const lastClosed = round?.status === "closed" ? round : null;
  const myVotes = open?.my_votes ?? [];
  const votesLeft = MAX_VOTES - myVotes.length;

  /** Añade o quita uno de mis votos a un candidato. */
  const changeVote = (bookId: number, add: boolean) => {
    if (!open) return;
    const next = [...myVotes];
    if (add) next.push(bookId);
    else next.splice(next.indexOf(bookId), 1);
    void run(() => api.setVotes(open.id, next));
  };

  return (
    <div className="vote-page page">
      <SectionNav kind={kind} />
      <h1 className="page-title">Votación{kind === "movie" ? " de cine" : ""}</h1>
      {loadError && <p className="error">{loadError}</p>}
      {error && <p className="error">{error}</p>}

      {open ? (
        <section>
          <p className="lead">
            {k.voteLead} Tienes {MAX_VOTES} votos: repártelos o dale los dos al mismo (a tus propias propuestas no). Puedes
            cambiarlos mientras la ronda siga abierta.
          </p>
          <p className="muted small">
            🔒 Los votos son anónimos hasta que se cierre la ronda; entonces se verá qué votó cada uno. ·{" "}
            {open.voters} persona{open.voters === 1 ? "" : "s"} ha{open.voters === 1 ? "" : "n"} votado.
          </p>
          {open.closes_at && (
            <p className={`deadline ${isPast(open.closes_at) ? "is-past" : ""}`}>
              ⏰ {isPast(open.closes_at) ? "El plazo para votar terminó el" : "Se cierra el"}{" "}
              <strong>{formatLocalDateTime(open.closes_at)}</strong>
            </p>
          )}
          {open.pending_voters && open.voters > 0 && (
            <p className="muted small">
              {open.pending_voters.length === 0
                ? "✅ Ya ha votado todo el mundo."
                : `Falta${open.pending_voters.length === 1 ? "" : "n"} por votar: ${open.pending_voters.join(", ")}.`}
            </p>
          )}
          {user && (
            <p className="my-votes">
              <VoteDots used={myVotes.length} />
              {votesLeft === 0
                ? "Has usado tus dos votos."
                : `Te queda${votesLeft === 1 ? "" : "n"} ${votesLeft} voto${votesLeft === 1 ? "" : "s"}.`}
            </p>
          )}
          {open.candidates.length === 0 && <p className="muted">Todavía no hay candidatos. ¡Propón uno abajo!</p>}
          <ul className="candidates">
            {open.candidates.map(({ book, votes }) => {
              const pct = open.total_votes ? Math.round((votes / open.total_votes) * 100) : 0;
              const mine = myVotes.filter((id) => id === book.id).length;
              return (
                <li key={book.id} className={`candidate ${mine ? "is-mine" : ""}`}>
                  <Cover book={book} size="sm" />
                  <div className="candidate-info">
                    {mine > 0 && <span className="pill pill-accent">✔ {mine === 2 ? "Tus dos votos" : "Tu voto"}</span>}
                    <h3>
                      <Link to={k.paths.item(book.id)}>{book.title}</Link>
                      {book.year && <span className="muted year"> ({book.year})</span>}
                    </h3>
                    <p className="muted">
                      {book.author}
                      {book.proposed_by_name && ` · ${k.proposedBy} ${book.proposed_by_name}`}
                    </p>
                    {book.description && <Synopsis text={book.description} lines={3} className="small" />}
                    <div className="bar" aria-label={`${votes} votos`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="small muted">
                      {votes} voto{votes === 1 ? "" : "s"} · {pct}%
                    </p>
                  </div>
                  <div className="candidate-actions">
                    {user && book.proposed_by === user.id ? (
                      <span className="muted small own-proposal">Es tu propuesta: no puedes votarla</span>
                    ) : user && (
                      <div className="vote-buttons">
                        {mine > 0 && (
                          <button
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => changeVote(book.id, false)}
                            aria-label={`Quitar un voto a ${book.title}`}
                          >
                            −
                          </button>
                        )}
                        <button
                          className={`btn ${mine ? "" : "btn-ghost"}`}
                          disabled={busy || votesLeft === 0}
                          onClick={() => changeVote(book.id, true)}
                        >
                          {mine ? "+1 voto" : "Votar"}
                        </button>
                      </div>
                    )}
                    {user && (user.isAdmin || book.proposed_by === user.id) && (
                      <button className="link-btn" disabled={busy} onClick={() => removeProposal(book)}>
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
                onClick={async () =>
                  (await ask({
                    title: "¿Cerrar la votación?",
                    message:
                      (kind === "movie"
                        ? "La película más votada pasará a ser la que toca ver. Si hay empate, gana la que se propuso antes."
                        : "El libro más votado pasará a ser el libro en curso. Si hay empate, gana el que se propuso antes.") +
                      " El resto pasa al histórico de rondas y se verá qué votó cada uno.",
                    confirmLabel: "Cerrar votación",
                  })) && run(() => api.closeRound(open.id))
                }
              >
                Cerrar votación
              </button>
              {editingDeadline ? (
                <form
                  className="deadline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() => api.setRoundDeadline(open.id, deadline)).then((ok) => ok && setEditingDeadline(false));
                  }}
                >
                  <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Fecha límite para votar" />
                  <button className="btn btn-dark" disabled={busy}>
                    Guardar
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditingDeadline(false)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setDeadline(open.closes_at ?? "");
                    setEditingDeadline(true);
                  }}
                >
                  {open.closes_at ? "Cambiar fecha límite" : "Poner fecha límite"}
                </button>
              )}
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={async () =>
                  (await ask({
                    title: "¿Cancelar la ronda?",
                    message: "Se borrarán sus votos. Las propuestas se mantienen para la próxima.",
                    confirmLabel: "Cancelar ronda",
                    cancelLabel: "Volver",
                    danger: true,
                  })) && run(() => api.cancelRound(open.id))
                }
              >
                Cancelar ronda
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <p>No hay ninguna votación abierta.</p>
          <p className="muted">
            Puedes ir proponiendo {k.nounPlural}; entrarán como candidat{kind === "movie" ? "a" : "o"}s en la próxima ronda.
          </p>
          {proposed && proposed.length > 0 && (
            <ul className="proposed-list">
              {proposed.map((b) => (
                <li key={b.id}>
                  <Link to={k.paths.item(b.id)}>
                    <strong>{b.title}</strong>
                  </Link>{" "}
                  <span className="muted">
                    · {b.author}
                    {b.proposed_by_name && ` · ${b.proposed_by_name}`}
                  </span>
                  {user && !user.isAdmin && b.proposed_by === user.id && (
                    <>
                      {" "}
                      <button className="link-btn" disabled={busy} onClick={() => removeProposal(b)}>
                        quitar
                      </button>
                    </>
                  )}
                  {user?.isAdmin && (
                    <>
                      {" "}
                      <button
                        className="link-btn"
                        disabled={busy}
                        onClick={async () =>
                          (await ask({
                            title: `¿Elegir "${b.title}" ya?`,
                            message: "Pasará a estar en curso sin votación.",
                            confirmLabel: "Elegir ya",
                          })) && run(() => api.startBook(b.id))
                        }
                      >
                        {k.startAction}
                      </button>
                      <button className="link-btn" disabled={busy} onClick={() => removeProposal(b)}>
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
              <label className="deadline-new">
                Fecha límite <span className="muted">(opcional)</span>
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </label>
              <button
                className="btn"
                disabled={busy}
                onClick={() => run(() => api.openRound(kind, deadline)).then((ok) => ok && setDeadline(""))}
              >
                Abrir nueva votación
              </button>
            </div>
          )}
        </section>
      )}

      {lastClosed && (
        <section className="detail-section">
          <h2 className="rule-title">Última votación</h2>
          <RoundResults
            round={lastClosed}
            busy={busy}
            canRepropose={proposalsLeft > 0}
            onRepropose={(id) => run(() => api.repropose(id))}
          />
        </section>
      )}
      <p className="history-link">
        <Link to={k.paths.rounds}>📜 Ver todas las rondas anteriores ›</Link>
      </p>

      <section className="detail-section">
        <h2 className="rule-title">{k.proposeTitle}</h2>
        <RequireLogin message={`Entra para proponer ${k.nounPlural}.`}>
          {myProposals.length > 0 && (
            <div className="panel my-proposal">
              <p>
                Tus propuestas ({myProposals.length} de {MAX_PROPOSALS}):
              </p>
              <ul className="proposed-list">
                {myProposals.map((b) => (
                  <li key={b.id}>
                    <Link to={k.paths.item(b.id)}>{b.title}</Link>{" "}
                    <button className="link-btn" disabled={busy} onClick={() => removeProposal(b)}>
                      quitar
                    </button>
                  </li>
                ))}
              </ul>
              {proposalsLeft === 0 && (
                <p className="muted small">Ya has usado tus {MAX_PROPOSALS} propuestas. Quita una si quieres proponer otra.</p>
              )}
            </div>
          )}
          {proposalsLeft > 0 && <ProposeForm kind={kind} onDone={reload} />}
        </RequireLogin>
      </section>
    </div>
  );
}
