import { useState } from "react";
import type { BookDetail } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatDate, formatDateTime } from "../format";
import { Cover } from "./Cover";
import { RequireLogin } from "./LoginBox";
import { Stars } from "./Stars";

export function BookDetailView({ book, onChange }: { book: BookDetail; onChange: () => void }) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    void run(async () => {
      await api.comment(book.id, comment);
      setComment("");
    });
  };

  return (
    <article className="book-detail">
      <header className="book-hero">
        <Cover book={book} size="lg" />
        <div className="book-hero-info">
          <p className="eyebrow">
            {book.status === "current" ? "Leyendo ahora" : book.status === "read" ? "Leído" : "Propuesto"}
            {book.started_at && ` · desde el ${formatDate(book.started_at)}`}
            {book.finished_at && ` · terminado el ${formatDate(book.finished_at)}`}
          </p>
          <h1>{book.title}</h1>
          <p className="author">{book.author}</p>
          {book.description && <p className="description">{book.description}</p>}
          <div className="rating-summary">
            <Stars value={book.avg_rating} size="lg" />
            <span>
              {book.avg_rating != null ? (
                <>
                  <strong>{book.avg_rating.toFixed(1)}</strong> · {book.rating_count} puntuación
                  {book.rating_count === 1 ? "" : "es"}
                </>
              ) : (
                "Sin puntuaciones todavía"
              )}
            </span>
          </div>
          {book.proposed_by_name && <p className="muted">Propuesto por {book.proposed_by_name}</p>}
          {user?.isAdmin && book.status === "current" && (
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => confirm("¿Dar por terminado este libro?") && run(() => api.finishBook(book.id))}
            >
              Marcar como terminado
            </button>
          )}
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {book.status !== "proposed" && (
        <section className="card">
          <h2>Tu puntuación</h2>
          <RequireLogin message="Entra para puntuar el libro.">
            <div className="my-rating">
              <Stars value={book.my_rating} onChange={(v) => run(() => api.rate(book.id, v))} size="lg" />
              <span className="muted">{book.my_rating ? `Le has dado ${book.my_rating}/5` : "Toca una estrella"}</span>
            </div>
          </RequireLogin>
          {book.ratings.length > 0 && (
            <ul className="ratings-list">
              {book.ratings.map((r) => (
                <li key={r.user_name}>
                  <span>{r.user_name}</span>
                  <Stars value={r.score} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <h2>Comentarios ({book.comments.length})</h2>
        {book.comments.length === 0 && <p className="muted">Nadie ha comentado todavía. ¡Empieza tú!</p>}
        <ul className="comments">
          {book.comments.map((c) => (
            <li key={c.id} className="comment">
              <div className="avatar" aria-hidden>
                {c.user_picture ? <img src={c.user_picture} alt="" referrerPolicy="no-referrer" /> : c.user_name[0]}
              </div>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{c.user_name}</strong>
                  <span className="muted">{formatDateTime(c.created_at)}</span>
                  {(user?.id === c.user_id || user?.isAdmin) && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() => confirm("¿Borrar este comentario?") && run(() => api.deleteComment(c.id))}
                    >
                      borrar
                    </button>
                  )}
                </div>
                <p>{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <RequireLogin message="Entra para dejar un comentario.">
          <form className="comment-form" onSubmit={submitComment}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Qué te está pareciendo?"
              rows={3}
              maxLength={4000}
            />
            <button className="btn" disabled={busy || !comment.trim()}>
              Publicar
            </button>
          </form>
        </RequireLogin>
      </section>
    </article>
  );
}
