import { Link, Navigate, useLocation } from "react-router";
import type { Kind } from "../../shared/types";
import { api } from "../api";
import { BookDetailView } from "../components/BookDetailView";
import { SectionNav } from "../components/SectionNav";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

/** Sin nada en curso, ¿a qué pestaña mandamos? Con votación abierta, a votar; si no, al historial (o a proponer si aún no hay historial). */
async function emptyTarget(kind: Kind) {
  const k = KINDS[kind];
  const [round, done] = await Promise.all([api.currentRound(kind), api.books("read", kind)]);
  if (round?.status === "open") return k.paths.vote;
  return done.length > 0 ? k.paths.done : k.paths.vote;
}

/** El libro que estamos leyendo o la película que toca ver. */
export function CurrentBook({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  // Desde la pestaña "Leyendo"/"Toca ver" se entra con stay: ahí sí se muestra la página vacía, sin redirigir.
  const stay = Boolean((useLocation().state as { stay?: boolean } | null)?.stay);
  const { data, loading, error, reload } = useAsync(async () => {
    const book = await api.currentBook(kind);
    return { book, redirect: !book && !stay ? await emptyTarget(kind) : null };
  }, [kind, stay]);
  const book = data?.book;

  if (data?.redirect) return <Navigate to={data.redirect} replace />;
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
