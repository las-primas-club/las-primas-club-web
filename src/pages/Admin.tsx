import { useState } from "react";
import { Link, Navigate } from "react-router";
import { DEFAULT_SETTINGS, SETTING_LIMITS, type Book, type Kind, type Role, type Settings } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { Cover } from "../components/Cover";
import { EditBook } from "../components/EditBook";
import { Proposer } from "../components/Proposer";
import { useConfirm, type ConfirmOptions } from "../components/Dialog";
import { formatDate, formatDateTime } from "../format";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

type Tab = "members" | "books" | "rounds" | "settings";

/** Ejecuta una acción de admin mostrando errores y recargando después. */
function useAction(reload: () => unknown) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ask = useConfirm();
  const run = async (fn: () => Promise<unknown>, confirmWith?: ConfirmOptions) => {
    if (confirmWith && !(await ask(confirmWith))) return;
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
      <p className="section-sub">Gestiona quién entra al club, los libros, las películas y las rondas de votación.</p>
      <div className="tabs" role="tablist">
        {(
          [
            ["members", "Miembros"],
            ["books", "Libros y cine"],
            ["rounds", "Rondas"],
            ["settings", "Normas"],
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
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

// ---------- Miembros ----------

function MembersTab() {
  const { user } = useAuth();
  const { data, loading, error: loadError, reload } = useAsync(api.admin.members);
  const { busy, error, run } = useAction(reload);
  // Usuarios de Jellyfin para enlazar cuentas que ya existían (null si Jellyfin no está configurado o no responde).
  const { data: jellyfinUsers } = useAsync(() => api.admin.jellyfinUsers().catch(() => null), []);
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
                    onClick={() => run(() => api.admin.reject(r.email), {
                        title: "¿Rechazar la solicitud?",
                        message: `${r.email} no podrá entrar. Si vuelve a intentarlo, aparecerá otra vez aquí.`,
                        confirmLabel: "Rechazar",
                        danger: true,
                      })}
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
                  {jellyfinUsers && m.user_id && (
                    <label className="jellyfin-link small">
                      <span className="muted">Jellyfin:</span>
                      <select
                        value={m.jellyfin_user_id ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          run(() => api.admin.linkJellyfin(m.email, e.target.value || null), {
                            title: e.target.value ? "¿Enlazar con esta cuenta de Jellyfin?" : "¿Quitar el enlace con Jellyfin?",
                            message: e.target.value
                              ? "Podrá entrar en Jellyfin como ese usuario con su código de Quick Connect. Sus permisos en Jellyfin no se tocan."
                              : "Su usuario de Jellyfin no se borra; solo deja de estar enlazado con la web.",
                            confirmLabel: e.target.value ? "Enlazar" : "Quitar enlace",
                          })
                        }
                        aria-label={`Cuenta de Jellyfin de ${m.email}`}
                      >
                        <option value="">Sin cuenta</option>
                        {jellyfinUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                            {u.admin ? " (admin)" : ""}
                            {u.disabled ? " (desactivado)" : ""}
                            {u.id === m.jellyfin_user_id && m.jellyfin_managed ? " · creada por la web" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="person-actions">
                  {m.protected && <span className="pill" title="Definido en ADMIN_EMAILS">Emergencia</span>}
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
                          {
                            title: `¿Quitar a ${m.name ?? m.email} del club?`,
                            message: "Perderá el acceso al momento. Sus comentarios y puntuaciones se conservan.",
                            confirmLabel: "Quitar del club",
                            danger: true,
                          },
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

function statusLabel(b: Book) {
  const k = KINDS[b.kind];
  return b.status === "current" ? k.nowLabel : b.status === "read" ? k.doneLabel : "Propuesta";
}

function BooksTab() {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const { data: all, loading, error: loadError, reload } = useAsync(() => api.books(undefined, "all"));
  const { busy, error, run } = useAction(reload);
  const [editing, setEditing] = useState<number | null>(null);
  const books = all?.filter((b) => filter === "all" || b.kind === filter);

  if (loading) return <p className="muted">Cargando…</p>;
  return (
    <div className="admin-section">
      <div className="section-nav admin-filter">
        {(
          [
            ["all", "Todo"],
            ["book", "Libros"],
            ["movie", "Películas"],
          ] as const
        ).map(([id, label]) => (
          <a
            key={id}
            href="#"
            className={filter === id ? "active" : ""}
            onClick={(e) => {
              e.preventDefault();
              setFilter(id);
            }}
          >
            {label}
          </a>
        ))}
      </div>
      {(loadError || error) && <p className="error">{loadError ?? error}</p>}
      {books?.length === 0 && <p className="muted">Todavía no hay nada aquí.</p>}
      <ul className="admin-books">
        {books?.map((b) => (
          <li key={b.id} className="admin-book">
            {editing === b.id ? (
              <EditBook book={b} onCancel={() => setEditing(null)} onSaved={() => (setEditing(null), reload())} />
            ) : (
              <>
                <Cover book={b} size="sm" />
                <div className="person-info">
                  <span className="pill">{statusLabel(b)}</span>
                  <Link to={KINDS[b.kind].paths.item(b.id)}>
                    <strong>
                      {b.title}
                    </strong>
                  </Link>
                  {b.kind === "movie" && <span className="muted small"> · película</span>}
                  <span className="muted small">
                    {b.author}
                    {b.year && ` · ${b.year}`}
                    {b.finished_at && ` · ${b.kind === "movie" ? "vista" : "terminado"} el ${formatDate(b.finished_at)}`}
                  </span>
                  <Proposer book={b} />
                </div>
                <div className="person-actions">
                  {b.status === "proposed" && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() => run(() => api.startBook(b.id), {
                          title: `¿Elegir "${b.title}" ya?`,
                          message: "Pasará a estar en curso sin votación.",
                          confirmLabel: "Elegir ya",
                        })}
                    >
                      {KINDS[b.kind].startAction}
                    </button>
                  )}
                  {b.status === "current" && (
                    <button
                      className="link-btn"
                      disabled={busy}
                      onClick={() => run(() => api.finishBook(b.id), {
                          title: KINDS[b.kind].doneConfirm,
                          message: `"${b.title}" pasará al historial.`,
                          confirmLabel: KINDS[b.kind].doneAction,
                        })}
                    >
                      {b.kind === "movie" ? "vista" : "terminar"}
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
                        {
                          title: `¿Borrar "${b.title}" para siempre?`,
                          message: "Se borrarán también sus votos, puntuaciones y comentarios. No se puede deshacer.",
                          confirmLabel: "Borrar",
                          danger: true,
                        },
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

// ---------- Rondas ----------

function RoundsTab() {
  return (
    <>
      <h2 className="admin-subtitle">Libros</h2>
      <KindRounds kind="book" />
      <h2 className="admin-subtitle">Cine</h2>
      <KindRounds kind="movie" />
    </>
  );
}

function KindRounds({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { data: round, loading, error: loadError, reload } = useAsync(() => api.currentRound(kind), [kind]);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed", kind), [kind]);
  const { busy, error, run } = useAction(() => Promise.all([reload(), reloadProposed()]));

  if (loading) return <p className="muted">Cargando…</p>;
  const open = round?.status === "open" ? round : null;

  return (
    <div className="admin-section">
      {(loadError || error) && <p className="error">{loadError ?? error}</p>}
      {open ? (
        <section className="panel">
          <span className="pill pill-accent">Ronda abierta</span>
          <h3 style={{ marginTop: 12 }}>Ronda #{open.id}</h3>
          <p className="muted">
            Abierta el {formatDateTime(open.created_at)} · {open.candidates.length} candidatos · {open.voters} persona
            {open.voters === 1 ? "" : "s"} · {open.total_votes} voto{open.total_votes === 1 ? "" : "s"}
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
                run(() => api.closeRound(open.id), {
                  title: "¿Cerrar la votación?",
                  message:
                    kind === "movie"
                      ? "La película más votada pasará a ser la que toca ver. Si hay empate, gana la que se propuso antes."
                      : "El libro más votado pasará a ser el libro en curso. Si hay empate, gana el que se propuso antes.",
                  confirmLabel: "Cerrar votación",
                })
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
                  {
                    title: "¿Cancelar la ronda?",
                    message: "Se borrarán sus votos. Las propuestas se mantienen para la próxima.",
                    confirmLabel: "Cancelar ronda",
                    cancelLabel: "Volver",
                    danger: true,
                  },
                )
              }
            >
              Cancelar ronda
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <h3>No hay ninguna ronda abierta</h3>
          <p className="muted">
            {proposed?.length
              ? `Al abrirla entrarán ${proposed.length} ${proposed.length === 1 ? k.noun : k.nounPlural} propuest${kind === "movie" ? "a" : "o"}${proposed.length === 1 ? "" : "s"}.`
              : `Todavía no hay ${k.nounPlural} propuest${kind === "movie" ? "a" : "o"}s; ${kind === "movie" ? "las" : "los"} que se propongan después entrarán también.`}
          </p>
          <button className="btn" disabled={busy} onClick={() => run(() => api.openRound(kind))}>
            Abrir nueva votación
          </button>
        </section>
      )}
    </div>
  );
}

// ---------- Normas ----------

const NUMBER_SETTINGS: { key: keyof typeof SETTING_LIMITS; label: string; help: string }[] = [
  { key: "maxVotes", label: "Votos por persona", help: "Cuántos votos tiene cada uno en cada ronda." },
  {
    key: "maxProposals",
    label: "Propuestas por persona",
    help: "Cuántas propuestas pendientes puede tener cada uno. Libros y cine cuentan por separado.",
  },
  { key: "kindleSendsPerDay", label: "Envíos al Kindle al día", help: "Máximo de libros que cada uno puede mandarse al día." },
];
const TOGGLE_SETTINGS: { key: "stackVotes" | "voteOwn"; label: string; help: string }[] = [
  { key: "stackVotes", label: "Varios votos al mismo candidato", help: "Si está desactivado, cada voto tiene que ir a un candidato distinto." },
  { key: "voteOwn", label: "Votar propuestas propias", help: "Si está desactivado, nadie puede votar lo que ha propuesto." },
];

function SettingsTab() {
  const { settings, setSettings } = useAuth();
  const [form, setForm] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = (Object.keys(form) as (keyof Settings)[]).some((k) => form[k] !== settings[k]);
  const change = (patch: Partial<Settings>) => {
    setForm({ ...form, ...patch });
    setSaved(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await api.admin.saveSettings(form);
      setSettings(next);
      setForm(next);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-section settings-form" onSubmit={save}>
      <p className="muted">
        Los cambios se aplican al momento y solo a lo que se haga a partir de ahora: no se borra ningún voto ni propuesta que ya
        exista, aunque supere el nuevo límite.
      </p>
      {NUMBER_SETTINGS.map(({ key, label, help }) => {
        const [min, max] = SETTING_LIMITS[key];
        return (
          <label key={key} className="setting">
            <span>
              <strong>{label}</strong>
              <span className="muted small">
                {help} Por defecto: {DEFAULT_SETTINGS[key]}.
              </span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              required
              min={min}
              max={max}
              step={1}
              value={form[key]}
              onChange={(e) => change({ [key]: e.target.valueAsNumber || min })}
            />
          </label>
        );
      })}
      {TOGGLE_SETTINGS.map(({ key, label, help }) => (
        <label key={key} className="setting">
          <span>
            <strong>{label}</strong>
            <span className="muted small">
              {help} Por defecto: {DEFAULT_SETTINGS[key] ? "sí" : "no"}.
            </span>
          </span>
          <input type="checkbox" checked={form[key]} onChange={(e) => change({ [key]: e.target.checked })} />
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">Normas guardadas.</p>}
      <div className="edit-actions">
        <button className="btn" disabled={busy || !dirty}>
          {busy ? "Guardando…" : "Guardar normas"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => change(DEFAULT_SETTINGS)}>
          Volver a los valores por defecto
        </button>
      </div>
    </form>
  );
}
