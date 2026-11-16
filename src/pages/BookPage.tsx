import { useParams } from "react-router";
import { api } from "../api";
import { BookDetailView } from "../components/BookDetailView";
import { SectionNav } from "../components/SectionNav";
import { useAsync } from "../useAsync";

/** Ficha de un libro o una película (/libros/:id y /peliculas/:id). */
export function BookPage() {
  const id = Number(useParams().id);
  const { data: book, loading, error, reload } = useAsync(() => api.book(id), [id]);
  if (loading) return <p className="muted">Cargando…</p>;
  if (error || !book) return <p className="error">{error ?? "No encontrado"}</p>;
  return (
    <>
      <SectionNav kind={book.kind} />
      <BookDetailView book={book} onChange={reload} />
    </>
  );
}
