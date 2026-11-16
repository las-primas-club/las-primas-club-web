import { Link } from "react-router";
import { api } from "../api";
import { BookDetailView } from "../components/BookDetailView";
import { useAsync } from "../useAsync";

export function CurrentBook() {
  const { data: book, loading, error, reload } = useAsync(api.currentBook);
  if (loading) return <p className="muted">Cargando…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!book) {
    return (
      <div className="empty">
        <h1>Ningún libro en curso</h1>
        <p>
          Cuando se cierre la <Link to="/votacion">votación</Link>, el libro ganador aparecerá aquí.
        </p>
      </div>
    );
  }
  return <BookDetailView book={book} onChange={reload} />;
}
