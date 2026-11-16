import { api } from "../api";
import { BookCard } from "../components/BookCard";
import { useAsync } from "../useAsync";

export function ReadBooks() {
  const { data: books, loading, error } = useAsync(() => api.books("read"));
  return (
    <div className="page">
      <h1 className="page-title">Libros leídos</h1>
      <p className="section-sub">Todo lo que hemos leído, con la media de nuestras puntuaciones.</p>
      {loading && <p className="muted">Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {books?.length === 0 && <p className="muted">Todavía no hemos terminado ningún libro.</p>}
      <ul className="book-grid">
        {books?.map((b) => (
          <li key={b.id}>
            <BookCard book={b} />
          </li>
        ))}
      </ul>
    </div>
  );
}
