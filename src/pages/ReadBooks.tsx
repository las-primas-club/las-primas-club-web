import { Link } from "react-router";
import { api } from "../api";
import { Cover } from "../components/Cover";
import { Stars } from "../components/Stars";
import { formatDate } from "../format";
import { useAsync } from "../useAsync";

export function ReadBooks() {
  const { data: books, loading, error } = useAsync(() => api.books("read"));
  return (
    <div>
      <h1>Libros leídos</h1>
      {loading && <p className="muted">Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {books?.length === 0 && <p className="muted">Todavía no hemos terminado ningún libro.</p>}
      <ul className="book-grid">
        {books?.map((b) => (
          <li key={b.id}>
            <Link to={`/libros/${b.id}`} className="book-tile">
              <Cover book={b} />
              <h3>{b.title}</h3>
              <p className="muted">{b.author}</p>
              <div className="tile-rating">
                <Stars value={b.avg_rating} size="sm" />
                <span className="muted">{b.avg_rating?.toFixed(1) ?? "–"}</span>
              </div>
              {b.finished_at && <p className="muted small">{formatDate(b.finished_at)}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
