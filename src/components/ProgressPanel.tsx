import { useEffect, useState } from "react";
import type { BookDetail } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";

/** Por dónde va cada uno con el libro en curso (o quién ha visto ya la película). */
export function ProgressPanel({ book, run, busy }: { book: BookDetail; run: (fn: () => Promise<unknown>) => Promise<boolean>; busy: boolean }) {
  const { user } = useAuth();
  const movie = book.kind === "movie";
  const mine = book.progress.find((p) => p.user_id === user?.id)?.percent ?? null;
  const [draft, setDraft] = useState(mine ?? 0);
  useEffect(() => setDraft(mine ?? 0), [mine]);

  if (!user || book.status !== "current") return null;
  const done = book.progress.filter((p) => p.percent === 100).length;

  return (
    <section className="detail-section">
      <h2 className="rule-title">{movie ? "¿Quién la ha visto ya?" : "Por dónde vamos"}</h2>
      {movie ? (
        <div className="progress-mine">
          <button className={`btn ${mine === 100 ? "" : "btn-ghost"}`} disabled={busy} onClick={() => run(() => api.setProgress(book.id, mine === 100 ? null : 100))}>
            {mine === 100 ? "✓ Ya la he visto" : "Ya la he visto"}
          </button>
        </div>
      ) : (
        <div className="progress-mine">
          <label htmlFor="my-progress" className="panel-label">
            Tu progreso: <strong>{draft === 100 ? "¡terminado!" : `${draft} %`}</strong>
          </label>
          <div className="progress-row">
            <input id="my-progress" type="range" min={0} max={100} step={5} value={draft} onChange={(e) => setDraft(Number(e.target.value))} />
            <button className="btn" disabled={busy || draft === (mine ?? -1)} onClick={() => run(() => api.setProgress(book.id, draft))}>
              Guardar
            </button>
          </div>
        </div>
      )}
      {book.progress.length === 0 ? (
        <p className="muted small">{movie ? "Nadie ha dicho todavía que la ha visto." : "Nadie ha apuntado todavía por dónde va."}</p>
      ) : movie ? (
        <p className="small">
          <strong>La han visto ({done}):</strong> {book.progress.filter((p) => p.percent === 100).map((p) => p.name).join(", ")}
        </p>
      ) : (
        <>
          <ul className="progress-list">
            {book.progress.map((p) => (
              <li key={p.user_id}>
                <span>{p.name}</span>
                <div className="bar" aria-hidden>
                  <span style={{ width: `${p.percent}%` }} />
                </div>
                <span className="muted small">{p.percent === 100 ? "✓" : `${p.percent} %`}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {done} de {book.progress.length} lo ha{done === 1 ? "" : "n"} terminado.
          </p>
        </>
      )}
    </section>
  );
}
