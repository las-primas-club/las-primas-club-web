import type { Kind } from "../../shared/types";
import { api } from "../api";
import { BookCard } from "../components/BookCard";
import { SectionNav } from "../components/SectionNav";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

/** Historial: libros leídos o películas vistas. */
export function ReadBooks({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { data: books, loading, error } = useAsync(() => api.books("read", kind), [kind]);
  return (
    <div className="page">
      <SectionNav kind={kind} />
      <h1 className="page-title">{k.doneTitle}</h1>
      <p className="section-sub">{k.doneSub}</p>
      {loading && <p className="muted">Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {books?.length === 0 && <p className="muted">{k.doneEmpty}</p>}
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
