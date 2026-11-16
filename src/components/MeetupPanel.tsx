import { useState } from "react";
import type { BookDetail } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatLocalDateTime, isPast } from "../format";

/** La quedada para comentar el libro o la película: cuándo, dónde y quién va. El admin la pone o la cambia. */
export function MeetupPanel({ book, run, busy }: { book: BookDetail; run: (fn: () => Promise<unknown>) => Promise<boolean>; busy: boolean }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(book.meet_at ?? "");
  const [place, setPlace] = useState(book.meet_place ?? "");

  if (!user || (!book.meet_at && !(user.isAdmin && book.status === "current"))) return null;

  const mine = book.rsvps.find((r) => r.user_id === user.id);
  const going = book.rsvps.filter((r) => r.going);
  const notGoing = book.rsvps.filter((r) => !r.going);
  const past = book.meet_at ? isPast(book.meet_at) : false;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => api.setMeetup(book.id, when, place)).then((ok) => ok && setEditing(false));
  };

  return (
    <section className="detail-section">
      <h2 className="rule-title">La quedada</h2>
      {book.meet_at ? (
        <div className="meetup">
          <p className="meetup-when">
            <strong>{formatLocalDateTime(book.meet_at)}</strong>
            {book.meet_place && <span className="muted"> · {book.meet_place}</span>}
          </p>
          {!past && (
            <div className="meetup-rsvp">
              <button className={`btn ${mine?.going === true ? "" : "btn-ghost"}`} disabled={busy} onClick={() => run(() => api.rsvp(book.id, mine?.going === true ? null : true))}>
                {mine?.going === true ? "✓ Voy" : "Voy"}
              </button>
              <button className={`btn ${mine?.going === false ? "btn-dark" : "btn-ghost"}`} disabled={busy} onClick={() => run(() => api.rsvp(book.id, mine?.going === false ? null : false))}>
                {mine?.going === false ? "✓ No puedo" : "No puedo"}
              </button>
            </div>
          )}
          {going.length > 0 && (
            <p className="small">
              <strong>{past ? "Fueron" : "Van"} ({going.length}):</strong> {going.map((r) => r.name).join(", ")}
            </p>
          )}
          {notGoing.length > 0 && (
            <p className="small muted">
              No {past ? "pudieron" : "pueden"} ({notGoing.length}): {notGoing.map((r) => r.name).join(", ")}
            </p>
          )}
          {!past && book.rsvps.length === 0 && <p className="muted small">Nadie ha respondido todavía.</p>}
        </div>
      ) : (
        <p className="muted">Todavía no hay fecha para la quedada.</p>
      )}

      {user.isAdmin &&
        (editing ? (
          <form className="meetup-form" onSubmit={save}>
            <label>
              Día y hora
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label>
              Sitio <span className="muted">(opcional)</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder="Restaurante, casa de…" />
            </label>
            <div className="comment-edit-actions">
              <button className="btn" disabled={busy}>
                Guardar
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
            <p className="muted small">Deja la fecha vacía para quitar la quedada. Si cambias la fecha, se borran las respuestas.</p>
          </form>
        ) : (
          <div className="ebook-admin">
            <span className="muted small">Admin:</span>
            <button
              className="link-btn"
              disabled={busy}
              onClick={() => {
                setWhen(book.meet_at ?? "");
                setPlace(book.meet_place ?? "");
                setEditing(true);
              }}
            >
              {book.meet_at ? "cambiar la quedada" : "poner fecha y sitio"}
            </button>
          </div>
        ))}
    </section>
  );
}
