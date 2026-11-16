import type { Book } from "../../shared/types";

/** Portada del libro, o una portada generada si no hay imagen. */
export function Cover({ book, size = "md" }: { book: Pick<Book, "title" | "author" | "cover_url">; size?: "sm" | "md" | "lg" }) {
  if (book.cover_url) {
    return <img className={`cover cover-${size}`} src={book.cover_url} alt={`Portada de ${book.title}`} loading="lazy" />;
  }
  const hue = [...book.title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <div className={`cover cover-${size} cover-fallback`} style={{ "--hue": hue } as React.CSSProperties} aria-hidden>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.author}</span>
    </div>
  );
}
