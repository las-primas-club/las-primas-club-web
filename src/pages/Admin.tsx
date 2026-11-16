import { useState } from "react";
import { Link, Navigate } from "react-router";
import type { Book, Role } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";
import { formatDate, formatDateTime } from "../format";
import { useAsync } from "../useAsync";

type Tab = "members" | "books" | "rounds";

/** Ejecuta una acción de admin mostrando errores y recargando después. */
function useAction(reload: () => unknown) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("members");
  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="page admin">
      <h1 className="page-title">Administración</h1>
      <p className="section-sub">Gestiona quién entra al club, los libros y las rondas de votación.</p>
      <div className="tabs" role="tablist">
        {(
          [
            ["members", "Miembros"],
            ["books", "Libros"],
            ["rounds", "Rondas"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "members" && <MembersTab />}
      {tab === "books" && <BooksTab />}
      {tab === "rounds" && <RoundsTab />}
    </div>
  );
}

// ---------- Miembros ----------

function MembersTab() {
  const { user } = useAuth();
  const { data, loading, error: loadError, reload } = useAsync(api.admin.members);
  const { busy, error, run } = useAction(reload);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.admin.addMember(email, role);
      setEmail("");
      setRole("member");
    });
  };

  if (loading) return <p className="muted">Cargando…</p>;
  const me = user!.email.toLowerCase();

  return (
    <div className="admin-section">
      {(loadError || error) && <p className="error">{loadError ?? error}</p>}

      {data && data.requests.length > 0 && (
        <section className="panel">
          <h2>Solicitudes de acceso ({data.requests.length})</h2>
          <p className="muted small">Personas que han intentado entrar con Google y no son miembros.</p>
          <ul className="people">
            {data.requests.map((r) => (
              <li key={r.email} className="person">
                <Avatar name={r.name} picture={r.picture} />
                <div className="person-info">
                  <strong>{r.name}</strong>
                  <span className="muted small">
                    {r.email} · {formatDateTime(r.requested_at)}
                  </span>
                </div>
                <div className="person-actions">
                  <button className="btn" disabled={busy} onClick={() => run(() => api.admin.approve(r.email))}>
                    Aceptar
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => run(() => api.admin.reject(r.email), `¿Rechazar a ${r.email}?`)}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="detail-section">
        <h2 className="rule-title">Añadir miembro</h2>
        <form className="add-member" onSubmit={add}>
          <label>
            Email de Google
            <input type="email" required placeholder="nombre@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="member">Miembro</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn" disabled={busy}>
            Añadir
          </button>
        </form>
        <p className="muted small">Podrá entrar con ese email de Google en cuanto lo añadas.</p>
      </section>

      <section className="detail-section">
        <h2 className="rule-title">Miembros ({data?.members.length ?? 0})</h2>
        <ul className="people">
          {data?.members.map((m) => {
            const isMe = m.email.toLowerCase() === me;
            const locked = isMe || m.protected;
            return (
              <li key={m.email} className="person">
                <Avatar name={m.name ?? m.email} picture={m.picture} />
                <div className="person-info">
                  <strong>
                    {m.name ?? m.email.split("@")[0]} {isMe && <span className="muted">(tú)</span>}
                  </strong>
                  <span className="muted small">
                    {m.email} ·{" "}
                    {m.last_login_at ? `último acceso ${formatDateTime(m.last_login_at)}` : "aún no ha entrado"}
                  </span>
                </div>
                <div className="person-actions">
                  {m.protected && <span className="pill" title="Definido en ADMIN_EMAILS">🔒 Emergencia</span>}
                  <select
                    value={m.role}
                    disabled={busy || locked}
                    onChange={(e) => run(() => api.admin.setRole(m.email, e.target.value as Role))}
                    aria-label={`Rol de ${m.email}`}
                  >
                    <option value="member">Miembro</option>
                    <option value="admin">Admin</option>
                  </select>
                  {!locked && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => api.admin.removeMember(m.email),
                          `¿Quitar a ${m.email} del club? Perderá el acceso al momento (sus comentarios se conservan).`,
                        )
                      }
                    >
                      quitar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Avatar({ name, picture }: { name: string; picture: string | null }) {
  return (
    <div className="avatar" aria-hidden>
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : name[0]}
    </div>
  );
}

// ---------- Libros ----------

const STATUS_LABEL: Record<Book["status"], string> = { current: "📖 Leyendo", read: "✅ Leído", proposed: "💡 Propuesto" };

function BooksTab() {
  const { data: books, loading, error: loadError, reload } = useAsync(() => api.books());
  const { busy, error, run } = useAction(reload);
  const [editing, setEditing] = useState<number | null>(null);

  if (loading) return <p className="muted">Cargando…</p>;
  return (
    <div className="admin-section">
      {(loadError || error) && <p className="error">{loadError ?? error}</p>}
      {books?.length === 0 && <p className="muted">Todavía no hay libros.</p>}
      <ul className="admin-books">
        {books?.map((b) => (
          <li key={b.id} className="admin-book">
            {editing === b.id ? (
              <EditBook book={b} onCancel={() => setEditing(null)} onSaved={() => (setEditing(null), reload())} />
            ) : (
              <>
                <Cover book={b} size="sm" />
                <div className="person-info">
                  <span className="pill">{STATUS_LABEL[b.status]}</span>
                  <Link to={`/libros/${b.id}`}>
                    <strong>{b.title}</strong>
                  </Link>
                  <span className="muted small">
                    {b.author}
                    {b.proposed_by_name && ` · propuesto por ${b.proposed_by_name}`}
                    {b.finished_at && ` · terminado el ${formatDate(b.finished_at)}`}
                  </span>
                </div>
                <div className="person-actions">
                  {b.status === "proposed" && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() => run(() => api.startBook(b.id), `¿Empezar a leer "${b.title}" ya, sin votación?`)}
                    >
                      leer ya
                    </button>
                  )}
                  {b.status === "current" && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() => run(() => api.finishBook(b.id), `¿Dar por terminado "${b.title}"?`)}
                    >
                      terminar
                    </button>
                  )}
                  <button className="link-btn" disabled={busy} onClick={() => setEditing(b.id)}>
                    editar
                  </button>
                  <button
                    className="link-btn danger"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api.deleteBook(b.id),
                        `¿Borrar "${b.title}" para siempre? Se borrarán también sus votos, puntuaciones y comentarios.`,
                      )
                    }
                  >
                    borrar
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditBook({ book, onCancel, onSaved }: { book: Book; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: book.title,
    author: book.author,
    description: book.description ?? "",
    cover_url: book.cover_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.editBook(book.id, { ...form, description: form.description || null, cover_url: form.cover_url || null });
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
        Autor/a
        <input required value={form.author} onChange={set("author")} maxLength={200} />
      </label>
      <label className="full">
        Sinopsis
        <textarea rows={4} value={form.description} onChange={set("description")} maxLength={2000} />
      </label>
      <label className="full">
        URL de la portada
        <input type="url" value={form.cover_url} onChange={set("cover_url")} maxLength={500} />
      </label>
      {error && <p className="error full">{error}</p>}
      <div className="edit-actions full">
        <button className="btn" disabled={busy}>
          Guardar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ---------- Rondas ----------

function RoundsTab() {
  const { data: round, loading, error: loadError, reload } = useAsync(api.currentRound);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed"));
  const { busy, error, run } = useAction(() => Promise.all([reload(), reloadProposed()]));

  if (loading) return <p className="muted">Cargando…</p>;
  const open = round?.status === "open" ? round : null;

  return (
    <div className="admin-section">
      {(loadError || error) && <p className="error">{loadError ?? error}</p>}
      {open ? (
        <section className="panel">
          <span className="pill pill-accent">🗳️ Ronda abierta</span>
          <h2 style={{ marginTop: 12 }}>Ronda #{open.id}</h2>
          <p className="muted">
            Abierta el {formatDateTime(open.created_at)} · {open.candidates.length} candidatos · {open.voters} voto
            {open.voters === 1 ? "" : "s"}
          </p>
          <ul className="ratings-list">
            {open.candidates.map((c) => (
              <li key={c.book.id}>
                <span>{c.book.title}</span>
                <strong>{c.votes}</strong>
              </li>
            ))}
          </ul>
          <div className="edit-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(() => api.closeRound(open.id), "¿Cerrar la votación? El más votado pasará a ser el libro actual.")
              }
            >
              Cerrar y elegir ganador
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                run(
                  () => api.cancelRound(open.id),
                  "¿Cancelar la ronda? Se borrarán sus votos; los libros propuestos se mantienen.",
                )
              }
            >
              Cancelar ronda
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <h2>No hay ninguna ronda abierta</h2>
          <p className="muted">
            {proposed?.length
              ? `Al abrirla entrarán ${proposed.length} libro${proposed.length === 1 ? "" : "s"} propuesto${proposed.length === 1 ? "" : "s"}.`
              : "Todavía no hay libros propuestos; los que se propongan después entrarán también."}
          </p>
          <button className="btn" disabled={busy} onClick={() => run(api.openRound)}>
            Abrir nueva votación
          </button>
        </section>
      )}
    </div>
  );
}
