import { useState } from "react";
import type { Book } from "../../shared/types";
import { api } from "../api";
import { KINDS } from "../kinds";

/** Formulario para editar un libro o una película (admin, o quien lo propuso mientras esté pendiente). */
export function EditBook({ book, onCancel, onSaved }: { book: Book; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: book.title,
    author: book.author,
    description: book.description ?? "",
    cover_url: book.cover_url ?? "",
    year: book.year ?? "",
  });
  const k = KINDS[book.kind];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.editBook(book.id, {
        ...form,
        description: form.description || null,
        cover_url: form.cover_url || null,
        year: form.year || null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="propose-form edit-book" onSubmit={save}>
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
        <input inputMode="numeric" pattern="\d{4}" value={form.year} onChange={set("year")} maxLength={4} />
      </label>
      <label className="full">
        Sinopsis <span className="muted">(opcional)</span>
        <textarea rows={4} value={form.description} onChange={set("description")} maxLength={2000} />
      </label>
      <label className="full">
        {k.coverLabel} <span className="muted">(opcional)</span>
        <input type="url" placeholder="https://…" value={form.cover_url} onChange={set("cover_url")} maxLength={500} />
      </label>
      {form.cover_url && /^https:\/\//.test(form.cover_url) && (
        <img className="propose-preview full" src={form.cover_url} alt="Vista previa de la portada" />
      )}
      {error && <p className="error full">{error}</p>}
      <div className="edit-actions full">
        <button className="btn" disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
