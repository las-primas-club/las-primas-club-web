import { Link } from "react-router";
import type { Kind } from "../../shared/types";
import { api } from "../api";
import { BookDetailView } from "../components/BookDetailView";
import { SectionNav } from "../components/SectionNav";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

/** El libro que estamos leyendo o la película que toca ver. */
export function CurrentBook({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { data: book, loading, error, reload } = useAsync(() => api.currentBook(kind), [kind]);
  return (
    <>
      <SectionNav kind={kind} />
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : !book ? (
        <div className="empty page">
          <h1>{k.noneCurrent}</h1>
          <p>
            Cuando se cierre la <Link to={k.paths.vote}>votación</Link>, {k.the} ganador{kind === "movie" ? "a" : ""} aparecerá
            aquí.
          </p>
        </div>
      ) : (
        <BookDetailView book={book} onChange={reload} />
      )}
    </>
  );
}
