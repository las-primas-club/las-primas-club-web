import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { BookSuggestion } from "../../shared/types";

const EMPTY = { title: "", author: "", description: "", cover_url: "" };

/** Proponer un libro: se busca en Google Books / Open Library y se rellena solo. */
export function ProposeForm({ onDone }: { onDone: () => unknown }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Búsqueda con espera de 400 ms mientras se escribe
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await api.searchBooks(q, ctrl.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError("No se pudo buscar ahora mismo. Rellénalo a mano.");
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pick = (s: BookSuggestion) => {
    setForm({ title: s.title, author: s.author, description: s.description, cover_url: s.cover_url });
    setPicked(true);
    setResults([]);
    setQuery("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.proposeBook(form);
      setForm(EMPTY);
      setPicked(false);
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="propose">
      <label className="search-label">
        Busca el libro
        <input
          type="search"
          placeholder="Título, autor/a o ISBN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {searching && <p className="muted small">Buscando…</p>}
      {searchError && <p className="error small">{searchError}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => pick(s)}>
                {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" /> : <span className="no-cover">📕</span>}
                <span className="search-text">
                  <strong>{s.title}</strong>
                  <span className="muted small">
                    {[s.author, s.year].filter(Boolean).join(" · ") || "Autor desconocido"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} className="propose-form" onSubmit={submit}>
        {picked && form.cover_url && <img className="propose-preview" src={form.cover_url} alt="" />}
        <label>
          Título
          <input required value={form.title} onChange={set("title")} maxLength={200} />
        </label>
        <label>
          Autor/a
          <input required value={form.author} onChange={set("author")} maxLength={200} />
        </label>
        <label className="full">
          Sinopsis o por qué lo propones <span className="muted">(opcional)</span>
          <textarea rows={4} value={form.description} onChange={set("description")} maxLength={2000} />
        </label>
        <label className="full">
          URL de la portada <span className="muted">(opcional)</span>
          <input type="url" placeholder="https://…" value={form.cover_url} onChange={set("cover_url")} maxLength={500} />
        </label>
        {error && <p className="error full">{error}</p>}
        <button className="btn" disabled={busy}>
          Proponer
        </button>
      </form>
    </div>
  );
}
