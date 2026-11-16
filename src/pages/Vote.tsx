import { useState } from "react";
import { Link } from "react-router";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";
import { RequireLogin } from "../components/LoginBox";
import { useAsync } from "../useAsync";

export function Vote() {
  const { user } = useAuth();
  const { data: round, loading, error: loadError, reload: reloadRound } = useAsync(api.currentRound, [user?.id]);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed"));
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

  if (loading) return <p className="muted">Cargando…</p>;
  const open = round?.status === "open" ? round : null;
  const winner = round?.status === "closed" ? round.candidates.find((c) => c.book.id === round.winner_book_id) : null;

  return (
    <div className="vote-page page">
      <h1 className="page-title">Votación</h1>
      {loadError && <p className="error">{loadError}</p>}
      {error && <p className="error">{error}</p>}

      {open ? (
        <section>
          <p className="lead">
            Elige el próximo libro. Tienes un voto y puedes cambiarlo mientras la ronda siga abierta.{" "}
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
                    <h3>{book.title}</h3>
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
                  confirm("¿Cerrar la votación? El libro más votado pasará a ser el libro en curso.") &&
                  run(() => api.closeRound(open.id))
                }
              >
                Cerrar votación
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          {winner ? (
            <p>
              La última votación la ganó <Link to={`/libros/${winner.book.id}`}>{winner.book.title}</Link> con {winner.votes}{" "}
              voto{winner.votes === 1 ? "" : "s"}.
            </p>
          ) : (
            <p>No hay ninguna votación abierta.</p>
          )}
          <p className="muted">
            Puedes ir proponiendo libros; entrarán como candidatos en la próxima ronda.
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
                          confirm(`¿Empezar a leer "${b.title}" ya, sin votación?`) && run(() => api.startBook(b.id))
                        }
                      >
                        leer ya
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
              <button className="btn" disabled={busy} onClick={() => run(api.openRound)}>
                Abrir nueva votación
              </button>
            </div>
          )}
        </section>
      )}

      <section className="detail-section">
        <h2 className="rule-title">Proponer un libro</h2>
        <RequireLogin message="Entra para proponer libros.">
          <ProposeForm onDone={reload} />
        </RequireLogin>
      </section>
    </div>
  );
}

function ProposeForm({ onDone }: { onDone: () => unknown }) {
  const empty = { title: "", author: "", description: "", cover_url: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.proposeBook(form);
      setForm(empty);
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="propose-form" onSubmit={submit}>
      <label>
        Título
        <input required value={form.title} onChange={set("title")} maxLength={200} />
      </label>
      <label>
        Autor/a
        <input required value={form.author} onChange={set("author")} maxLength={200} />
      </label>
      <label className="full">
        ¿Por qué este libro? <span className="muted">(opcional)</span>
        <textarea rows={2} value={form.description} onChange={set("description")} maxLength={2000} />
      </label>
      <label className="full">
        URL de la portada <span className="muted">(opcional)</span>
        <input type="url" placeholder="https://…" value={form.cover_url} onChange={set("cover_url")} maxLength={500} />
      </label>
      {error && <p className="error full">{error}</p>}
      <button className="btn" disabled={busy}>
        Proponer
      </button>
    </form>
  );
}
