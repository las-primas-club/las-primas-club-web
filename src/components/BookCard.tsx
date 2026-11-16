import { Link } from "react-router";
import type { Book } from "../../shared/types";
import { formatDate } from "../format";
import { KINDS } from "../kinds";
import { Cover } from "./Cover";
import { Stars } from "./Stars";

/** Tarjeta de libro o película con borde, al estilo de un escaparate de librería. */
export function BookCard({ book }: { book: Book }) {
  const k = KINDS[book.kind];
  const top = book.avg_rating != null && book.avg_rating >= 4.5;
  return (
    <Link to={k.paths.item(book.id)} className="book-card">
      <div className="book-card-pills">
        {book.status === "current" && <span className="pill pill-accent">{k.nowLabel}</span>}
        {top && <span className="pill">🏆 Favorit{book.kind === "movie" ? "a" : "o"}</span>}
      </div>
      <div className="book-card-cover">
        <Cover book={book} />
      </div>
      <h3>{book.title}</h3>
      <p className="muted">
        {book.author}
        {book.year && ` · ${book.year}`}
      </p>
      <div className="tile-rating">
        <Stars value={book.avg_rating} size="sm" />
        <span className="muted small">{book.avg_rating?.toFixed(1) ?? "–"}</span>
      </div>
      {book.finished_at && <p className="muted small">{formatDate(book.finished_at)}</p>}
    </Link>
  );
}
