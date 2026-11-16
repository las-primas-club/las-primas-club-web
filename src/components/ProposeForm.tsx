import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { BookSuggestion, Kind } from "../../shared/types";
import { useAuth } from "../auth";
import { KINDS } from "../kinds";
import { BookIcon, FilmIcon } from "./Icons";

const EMPTY = { title: "", author: "", description: "", cover_url: "", year: "", source: "" };

/** Proponer un libro (Google Books / Open Library) o una película (TMDB): se busca y se rellena solo. */
export function ProposeForm({ kind, onDone }: { kind: Kind; onDone: () => unknown }) {
  const k = KINDS[kind];
  const { config } = useAuth();
  const canSearch = kind === "book" || Boolean(config?.movieSearch);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [picked, setPicked] = useState(false);
  const [loadingDescription, setLoadingDescription] = useState(false);
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
        setResults(await api.searchBooks(kind, q, ctrl.signal));
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
  }, [query, kind]);

  const pick = (s: BookSuggestion) => {
    setForm({ title: s.title, author: s.author, description: s.description, cover_url: s.cover_url, year: s.year, source: s.key });
    setPicked(true);
    setResults([]);
    setQuery("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
    // Open Library no trae la sinopsis en la búsqueda: la pedimos aparte al elegir el libro.
    if (!s.description && s.key.startsWith("ol:")) {
      setLoadingDescription(true);
      api
        .bookDescription(s.key)
        .then((description) => {
          if (description) setForm((f) => (f.title === s.title && !f.description ? { ...f, description } : f));
        })
        .catch(() => {})
        .finally(() => setLoadingDescription(false));
    }
  };

  // Si se cambia el título a mano, deja de ser el resultado elegido en la búsqueda.
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value, ...(k === "title" ? { source: "" } : {}) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.proposeBook(kind, { ...form, year: form.year || null, source: form.source || null });
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
      {canSearch && (
        <label className="search-label">
          {k.searchLabel}
          <input type="search" placeholder={k.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      {searching && <p className="muted small">Buscando…</p>}
      {searchError && <p className="error small">{searchError}</p>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => pick(s)}>
                {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" /> : <span className="no-cover">{kind === "movie" ? <FilmIcon /> : <BookIcon />}</span>}
                <span className="search-text">
                  <strong>{s.title}</strong>
                  <span className="muted small">
                    {[s.author, s.year].filter(Boolean).join(" · ") || (kind === "movie" ? "Dirección desconocida" : "Autor desconocido")}
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
          {k.creatorLabel}
          <input required value={form.author} onChange={set("author")} maxLength={200} />
        </label>
        <label>
          Año <span className="muted">(opcional)</span>
          <input inputMode="numeric" pattern="\d{4}" placeholder="2024" value={form.year} onChange={set("year")} maxLength={4} />
        </label>
        <label className="full">
          Sinopsis o por qué lo propones <span className="muted">(opcional)</span>
          {loadingDescription && <span className="muted small"> · buscando sinopsis…</span>}
          <textarea rows={4} value={form.description} onChange={set("description")} maxLength={2000} />
        </label>
        <label className="full">
          {k.coverLabel} <span className="muted">(opcional)</span>
          <input type="url" placeholder="https://…" value={form.cover_url} onChange={set("cover_url")} maxLength={500} />
        </label>
        {error && <p className="error full">{error}</p>}
        <button className="btn" disabled={busy}>
          Proponer
        </button>
      </form>
      {kind === "movie" && canSearch && (
        <p className="muted small tmdb-credit">Datos e imágenes de películas: TMDB. Este sitio usa la API de TMDB, pero no está avalado ni certificado por TMDB.</p>
      )}
    </div>
  );
}
