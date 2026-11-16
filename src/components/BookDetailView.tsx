import { useState } from "react";
import type { BookDetail, Comment } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatDate, formatDateTime, formatScore } from "../format";
import { KINDS } from "../kinds";
import { Cover } from "./Cover";
import { useConfirm } from "./Dialog";
import { EbookPanel } from "./EbookPanel";
import { RequireLogin } from "./LoginBox";
import { Stars } from "./Stars";
import { Synopsis } from "./Synopsis";

export function BookDetailView({ book, onChange }: { book: BookDetail; onChange: () => void }) {
  const { user } = useAuth();
  const ask = useConfirm();
  const k = KINDS[book.kind];
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

  const movie = book.kind === "movie";
  const dates = [
    book.started_at && `${movie ? "Elegida" : "Empezado"} el ${formatDate(book.started_at)}`,
    book.finished_at && `${movie ? "vista" : "terminado"} el ${formatDate(book.finished_at)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="book-detail">
      <div className="book-layout">
        <div className="book-cover-col">
          <Cover book={book} size="lg" />
        </div>

        <div className="book-info-col">
          <div className="pills">
            {book.status === "current" && <span className="pill pill-accent">{k.nowLabel}</span>}
            {book.status === "read" && <span className="pill">{k.doneLabel}</span>}
            {book.status === "proposed" && <span className="pill">💡 Propuesta</span>}
            {book.avg_rating != null && book.avg_rating >= 4.5 && (
              <span className="pill">🏆 Favorit{movie ? "a" : "o"} del club</span>
            )}
          </div>
          <h1 className="book-title">
            {book.title}
            {book.year && <span className="muted year"> ({book.year})</span>}
          </h1>
          {dates && <p className="muted small">{dates}</p>}
          <p className="book-meta">
            {k.byPrefix}
            <strong>{book.author}</strong>
            {book.proposed_by_name && <span className="muted"> · propuesto por {book.proposed_by_name}</span>}
          </p>

          {book.status !== "proposed" && (
            <div className="panel">
              <div className="panel-score">
                <span className="big-score">{book.avg_rating != null ? formatScore(book.avg_rating, true) : "–"}</span>
                <div>
                  <Stars value={book.avg_rating} size="lg" />
                  <p className="muted small">
                    {book.rating_count
                      ? `${book.rating_count} ${book.rating_count === 1 ? "puntuación" : "puntuaciones"} del club`
                      : "Sin puntuaciones todavía"}
                  </p>
                </div>
              </div>

              <div className="panel-box">
                <p className="panel-label">Tu puntuación</p>
                <RequireLogin message={`Entra para puntuar ${k.the}.`}>
                  <div className="my-rating">
                    <Stars value={book.my_rating} onChange={(v) => run(() => api.rate(book.id, v))} size="lg" />
                    <span className="muted small">
                      {book.my_rating ? (
                        <>
                          Le has dado {formatScore(book.my_rating)}/5. Toca otra estrella para cambiarla o
                          <button
                            className="link-btn"
                            disabled={busy}
                            onClick={async () =>
                              (await ask({
                                title: "¿Quitar tu puntuación?",
                                message: `Dejará de contar en la media de ${k.the}. Puedes volver a puntuar cuando quieras.`,
                                confirmLabel: "Quitar puntuación",
                                danger: true,
                              })) && run(() => api.unrate(book.id))
                            }
                          >
                            quitarla
                          </button>
                        </>
                      ) : (
                        "Toca una estrella (la mitad izquierda da media)"
                      )}
                    </span>
                  </div>
                </RequireLogin>
              </div>

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

              {user?.isAdmin && book.status === "current" && (
                <button
                  className="btn btn-block"
                  disabled={busy}
                  onClick={async () =>
                    (await ask({
                      title: k.doneConfirm,
                      message: `"${book.title}" pasará al historial de ${k.doneShort.toLowerCase()}.`,
                      confirmLabel: k.doneAction,
                    })) && run(() => api.finishBook(book.id))
                  }
                >
                  {k.doneAction}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {book.description && (
        <section className="detail-section">
          <h2 className="rule-title">Sobre {k.the}</h2>
          <Synopsis text={book.description} lines={8} className="description" />
        </section>
      )}

      {book.kind === "book" && <EbookPanel book={book} onChange={onChange} />}

      <section className="detail-section">
        <h2 className="rule-title">Comentarios ({book.comments.length})</h2>
        {book.comments.length === 0 && <p className="muted">Nadie ha comentado todavía. ¡Empieza tú!</p>}
        <ul className="comments">
          {book.comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              canEdit={user?.id === c.user_id}
              canDelete={user?.id === c.user_id || Boolean(user?.isAdmin)}
              onChange={onChange}
            />
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
              Publicar comentario
            </button>
          </form>
        </RequireLogin>
      </section>
    </article>
  );
}

/** Un comentario. Su autor puede editarlo; su autor o un admin, borrarlo. */
function CommentItem({
  comment: c,
  canEdit,
  canDelete,
  onChange,
}: {
  comment: Comment;
  canEdit: boolean;
  canDelete: boolean;
  onChange: () => void;
}) {
  const ask = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (draft.trim() === c.body) return setEditing(false);
    if (await run(() => api.editComment(c.id, draft))) setEditing(false);
  };

  return (
    <li className="comment">
      <div className="avatar" aria-hidden>
        {c.user_picture ? <img src={c.user_picture} alt="" referrerPolicy="no-referrer" /> : c.user_name[0]}
      </div>
      <div className="comment-body">
        <div className="comment-meta">
          <strong>{c.user_name}</strong>
          <span className="muted">
            {formatDateTime(c.created_at)}
            {c.edited_at && <span title={`Editado el ${formatDateTime(c.edited_at)}`}> · editado</span>}
          </span>
          {!editing && (canEdit || canDelete) && (
            <span className="comment-actions">
              {canEdit && (
                <button
                  className="link-btn"
                  disabled={busy}
                  onClick={() => {
                    setDraft(c.body);
                    setEditing(true);
                  }}
                >
                  editar
                </button>
              )}
              {canDelete && (
                <button
                  className="link-btn"
                  disabled={busy}
                  onClick={async () =>
                    (await ask({
                      title: "¿Borrar este comentario?",
                      message: "No se puede deshacer.",
                      confirmLabel: "Borrar",
                      danger: true,
                    })) && run(() => api.deleteComment(c.id))
                  }
                >
                  borrar
                </button>
              )}
            </span>
          )}
        </div>
        {editing ? (
          <form className="comment-form comment-edit" onSubmit={save}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              rows={3}
              maxLength={4000}
              autoFocus
              aria-label="Editar comentario"
            />
            <div className="comment-edit-actions">
              <button className="btn" disabled={busy || !draft.trim()}>
                Guardar
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p>{c.body}</p>
        )}
        {error && <p className="error small">{error}</p>}
      </div>
    </li>
  );
}
