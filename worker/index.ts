import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { AppConfig, Book, BookDetail, Comment, Rating, Round, User } from "../shared/types";
import { newSessionToken, parseEmailList, verifyGoogleToken, type GoogleProfile } from "./auth";

type AppEnv = { Bindings: Env; Variables: { user: User | null } };
type Ctx = Context<AppEnv>;

const SESSION_COOKIE = "lpc_session";
const SESSION_DAYS = 60;

const app = new Hono<AppEnv>().basePath("/api");

// ---------- Sesión ----------

app.use("*", async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.picture FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
      .bind(token)
      .first<Omit<User, "isAdmin">>();
    if (row) c.set("user", { ...row, isAdmin: isAdmin(c.env, row.email) });
  }
  await next();
});

/** Login de desarrollo: solo con DEV_LOGIN=true y desde localhost. */
function devLoginEnabled(c: Ctx) {
  const host = new URL(c.req.url).hostname;
  return c.env.DEV_LOGIN === "true" && (host === "localhost" || host === "127.0.0.1");
}

function isAdmin(env: Env, email: string) {
  return parseEmailList(env.ADMIN_EMAILS).includes(email.toLowerCase());
}

function requireUser(c: Ctx): User {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Tienes que iniciar sesión" });
  return user;
}

function requireAdmin(c: Ctx): User {
  const user = requireUser(c);
  if (!user.isAdmin) throw new HTTPException(403, { message: "Solo para admins" });
  return user;
}

function bad(message: string): never {
  throw new HTTPException(400, { message });
}

function idParam(c: Ctx, name = "id"): number {
  const id = Number(c.req.param(name));
  if (!Number.isInteger(id) || id <= 0) bad("Id no válido");
  return id;
}

function text(value: unknown, field: string, max: number, required = true): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) bad(`Falta ${field}`);
    return null;
  }
  if (typeof value !== "string") bad(`${field} no válido`);
  const trimmed = value.trim();
  if (required && !trimmed) bad(`Falta ${field}`);
  if (trimmed.length > max) bad(`${field} es demasiado largo (máx. ${max})`);
  return trimmed || null;
}

async function loginAs(c: Ctx, profile: GoogleProfile) {
  const allowed = parseEmailList(c.env.ALLOWED_EMAILS);
  const admins = parseEmailList(c.env.ADMIN_EMAILS);
  if (allowed.length > 0 && !allowed.includes(profile.email) && !admins.includes(profile.email)) {
    throw new HTTPException(403, { message: "Este email no está en la lista del club. Pide que te añadan." });
  }
  const user = await c.env.DB.prepare(
    `INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)
     ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture
     RETURNING id`,
  )
    .bind(profile.sub, profile.email, profile.name, profile.picture)
    .first<{ id: number }>();
  const token = newSessionToken();
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`),
    c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`).bind(
      token,
      user!.id,
      `+${SESSION_DAYS} days`,
    ),
  ]);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
  return c.json({ ok: true });
}

// ---------- Config y auth ----------

app.get("/config", (c) =>
  c.json<AppConfig>({ googleClientId: c.env.GOOGLE_CLIENT_ID ?? "", devLogin: devLoginEnabled(c) }),
);

app.get("/me", (c) => c.json(c.get("user")));

app.post("/auth/google", async (c) => {
  const { credential } = await c.req.json<{ credential?: string }>();
  if (!credential) bad("Falta el token de Google");
  if (!c.env.GOOGLE_CLIENT_ID) throw new HTTPException(500, { message: "GOOGLE_CLIENT_ID no configurado" });
  let profile: GoogleProfile;
  try {
    profile = await verifyGoogleToken(credential, c.env.GOOGLE_CLIENT_ID);
  } catch {
    throw new HTTPException(401, { message: "No se pudo verificar el login de Google" });
  }
  return loginAs(c, profile);
});

// Login sin Google, solo para desarrollo local (DEV_LOGIN=true en .dev.vars)
app.post("/auth/dev", async (c) => {
  if (!devLoginEnabled(c)) throw new HTTPException(404);
  const body = await c.req.json<{ name?: string; email?: string }>();
  const email = text(body.email, "email", 200)!.toLowerCase();
  const name = text(body.name, "nombre", 100, false) ?? email.split("@")[0];
  return loginAs(c, { sub: `dev:${email}`, email, name, picture: null });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ---------- Libros ----------

const BOOK_SELECT = `
  SELECT b.id, b.title, b.author, b.cover_url, b.description, b.status,
         b.started_at, b.finished_at, b.proposed_by, p.name AS proposed_by_name,
         ROUND(AVG(r.score), 1) AS avg_rating, COUNT(r.score) AS rating_count
  FROM books b
  LEFT JOIN users p ON p.id = b.proposed_by
  LEFT JOIN ratings r ON r.book_id = b.id`;

app.get("/books", async (c) => {
  const status = c.req.query("status");
  const where = status ? `WHERE b.status = ?` : "";
  const stmt = c.env.DB.prepare(
    `${BOOK_SELECT} ${where} GROUP BY b.id ORDER BY COALESCE(b.finished_at, b.started_at, b.created_at) DESC`,
  );
  const { results } = await (status ? stmt.bind(status) : stmt).all<Book>();
  return c.json(results);
});

async function bookDetail(c: Ctx, where: string, ...params: unknown[]): Promise<BookDetail | null> {
  const book = await c.env.DB.prepare(`${BOOK_SELECT} WHERE ${where} GROUP BY b.id`)
    .bind(...params)
    .first<Book>();
  if (!book) return null;
  const user = c.get("user");
  const [ratings, comments] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT u.id AS user_id, u.name AS user_name, r.score FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.book_id = ? ORDER BY r.updated_at`,
    ).bind(book.id),
    c.env.DB.prepare(
      `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS user_name, u.picture AS user_picture
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.book_id = ? ORDER BY c.created_at`,
    ).bind(book.id),
  ]);
  const ratingRows = ratings.results as (Rating & { user_id: number })[];
  return {
    ...book,
    my_rating: user ? (ratingRows.find((r) => r.user_id === user.id)?.score ?? null) : null,
    ratings: ratingRows.map(({ user_name, score }) => ({ user_name, score })),
    comments: comments.results as unknown as Comment[],
  };
}

app.get("/books/current", async (c) => c.json(await bookDetail(c, `b.status = 'current'`)));

app.get("/books/:id", async (c) => {
  const book = await bookDetail(c, `b.id = ?`, idParam(c));
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  return c.json(book);
});

/** Proponer un libro. Si hay una ronda abierta, entra directamente como candidato. */
app.post("/books", async (c) => {
  const user = requireUser(c);
  const body = await c.req.json<Record<string, unknown>>();
  const title = text(body.title, "título", 200);
  const author = text(body.author, "autor", 200);
  const description = text(body.description, "descripción", 2000, false);
  const cover = text(body.cover_url, "portada", 500, false);
  if (cover && !/^https:\/\//.test(cover)) bad("La portada debe ser una URL https://");

  const book = await c.env.DB.prepare(
    `INSERT INTO books (title, author, description, cover_url, proposed_by) VALUES (?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(title, author, description, cover, user.id)
    .first<{ id: number }>();
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO round_candidates (round_id, book_id) SELECT id, ? FROM rounds WHERE status = 'open'`,
  )
    .bind(book!.id)
    .run();
  return c.json({ id: book!.id }, 201);
});

/** Borrar una propuesta (quien la propuso o admin), solo si aún no se ha leído. */
app.delete("/books/:id", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const book = await c.env.DB.prepare(`SELECT status, proposed_by FROM books WHERE id = ?`)
    .bind(id)
    .first<{ status: string; proposed_by: number | null }>();
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  if (book.status !== "proposed") bad("Solo se pueden borrar libros propuestos");
  if (!user.isAdmin && book.proposed_by !== user.id) throw new HTTPException(403, { message: "No es tu propuesta" });
  await c.env.DB.prepare(`DELETE FROM books WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

/** Admin: empezar a leer un libro ya (sin votación), p. ej. el primero del club. */
app.post("/books/:id/start", async (c) => {
  requireAdmin(c);
  const id = idParam(c);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE books SET status = 'read', finished_at = datetime('now') WHERE status = 'current'`),
    c.env.DB.prepare(`UPDATE books SET status = 'current', started_at = datetime('now') WHERE id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM round_candidates WHERE book_id = ?`).bind(id),
  ]);
  return c.json({ ok: true });
});

/** Admin: dar por terminado el libro en curso. */
app.post("/books/:id/finish", async (c) => {
  requireAdmin(c);
  await c.env.DB.prepare(
    `UPDATE books SET status = 'read', finished_at = datetime('now') WHERE id = ? AND status = 'current'`,
  )
    .bind(idParam(c))
    .run();
  return c.json({ ok: true });
});

app.put("/books/:id/rating", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const { score } = await c.req.json<{ score?: number }>();
  if (!Number.isInteger(score) || score! < 1 || score! > 5) bad("La puntuación debe ser de 1 a 5");
  const book = await c.env.DB.prepare(`SELECT status FROM books WHERE id = ?`).bind(id).first<{ status: string }>();
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  if (book.status === "proposed") bad("Solo se pueden puntuar libros en curso o leídos");
  await c.env.DB.prepare(
    `INSERT INTO ratings (book_id, user_id, score) VALUES (?, ?, ?)
     ON CONFLICT (book_id, user_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')`,
  )
    .bind(id, user.id, score)
    .run();
  return c.json({ ok: true });
});

app.post("/books/:id/comments", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const body = text((await c.req.json<{ body?: string }>()).body, "comentario", 4000);
  const exists = await c.env.DB.prepare(`SELECT 1 FROM books WHERE id = ?`).bind(id).first();
  if (!exists) throw new HTTPException(404, { message: "Libro no encontrado" });
  await c.env.DB.prepare(`INSERT INTO comments (book_id, user_id, body) VALUES (?, ?, ?)`)
    .bind(id, user.id, body)
    .run();
  return c.json({ ok: true }, 201);
});

app.delete("/comments/:id", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const comment = await c.env.DB.prepare(`SELECT user_id FROM comments WHERE id = ?`)
    .bind(id)
    .first<{ user_id: number }>();
  if (!comment) throw new HTTPException(404, { message: "Comentario no encontrado" });
  if (comment.user_id !== user.id && !user.isAdmin) throw new HTTPException(403, { message: "No es tu comentario" });
  await c.env.DB.prepare(`DELETE FROM comments WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

// ---------- Rondas de votación ----------

async function roundDetail(c: Ctx, roundId: number): Promise<Round> {
  const user = c.get("user");
  const [round, candidates, myVote, voters] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id, status, created_at, closed_at, winner_book_id FROM rounds WHERE id = ?`).bind(roundId),
    c.env.DB.prepare(
      `${BOOK_SELECT}
       JOIN round_candidates rc ON rc.book_id = b.id AND rc.round_id = ?1
       GROUP BY b.id`,
    ).bind(roundId),
    c.env.DB.prepare(`SELECT book_id FROM votes WHERE round_id = ? AND user_id = ?`).bind(roundId, user?.id ?? 0),
    c.env.DB.prepare(`SELECT book_id, COUNT(*) AS n FROM votes WHERE round_id = ? GROUP BY book_id`).bind(roundId),
  ]);
  const counts = new Map((voters.results as { book_id: number; n: number }[]).map((v) => [v.book_id, v.n]));
  const r = round.results[0] as Omit<Round, "candidates" | "my_vote" | "voters">;
  return {
    ...r,
    candidates: (candidates.results as unknown as Book[])
      .map((book) => ({ book, votes: counts.get(book.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.book.id - b.book.id),
    my_vote: (myVote.results[0] as { book_id: number } | undefined)?.book_id ?? null,
    voters: [...counts.values()].reduce((a, b) => a + b, 0),
  };
}

/** Ronda abierta, o la última cerrada si no hay ninguna abierta. */
app.get("/rounds/current", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id FROM rounds ORDER BY (status = 'open') DESC, id DESC LIMIT 1`,
  ).first<{ id: number }>();
  return c.json(row ? await roundDetail(c, row.id) : null);
});

/** Admin: abrir una ronda nueva. Entran todas las propuestas pendientes. */
app.post("/rounds", async (c) => {
  requireAdmin(c);
  const open = await c.env.DB.prepare(`SELECT 1 FROM rounds WHERE status = 'open'`).first();
  if (open) bad("Ya hay una ronda abierta");
  const round = await c.env.DB.prepare(`INSERT INTO rounds DEFAULT VALUES RETURNING id`).first<{ id: number }>();
  await c.env.DB.prepare(
    `INSERT INTO round_candidates (round_id, book_id) SELECT ?, id FROM books WHERE status = 'proposed'`,
  )
    .bind(round!.id)
    .run();
  return c.json({ id: round!.id }, 201);
});

app.post("/rounds/:id/vote", async (c) => {
  const user = requireUser(c);
  const roundId = idParam(c);
  const { bookId } = await c.req.json<{ bookId?: number }>();
  const ok = await c.env.DB.prepare(
    `SELECT 1 FROM rounds r JOIN round_candidates rc ON rc.round_id = r.id
     WHERE r.id = ? AND r.status = 'open' AND rc.book_id = ?`,
  )
    .bind(roundId, bookId ?? 0)
    .first();
  if (!ok) bad("La ronda no está abierta o el libro no es candidato");
  await c.env.DB.prepare(
    `INSERT INTO votes (round_id, user_id, book_id) VALUES (?, ?, ?)
     ON CONFLICT (round_id, user_id) DO UPDATE SET book_id = excluded.book_id, created_at = datetime('now')`,
  )
    .bind(roundId, user.id, bookId)
    .run();
  return c.json({ ok: true });
});

/** Admin: cerrar la ronda. El más votado pasa a ser el libro en curso (empate: el propuesto antes). */
app.post("/rounds/:id/close", async (c) => {
  requireAdmin(c);
  const round = await roundDetail(c, idParam(c));
  if (round.status !== "open") bad("La ronda ya está cerrada");
  const winner = round.candidates[0];
  if (!winner || winner.votes === 0) bad("Nadie ha votado todavía");
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE books SET status = 'read', finished_at = datetime('now') WHERE status = 'current'`),
    c.env.DB.prepare(`UPDATE books SET status = 'current', started_at = datetime('now') WHERE id = ?`).bind(
      winner.book.id,
    ),
    c.env.DB.prepare(
      `UPDATE rounds SET status = 'closed', closed_at = datetime('now'), winner_book_id = ? WHERE id = ?`,
    ).bind(winner.book.id, round.id),
  ]);
  return c.json({ winnerId: winner.book.id });
});

// ---------- Errores ----------

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || "Error" }, err.status);
  }
  console.error(err);
  return c.json({ error: "Error interno" }, 500);
});

app.notFound((c) => c.json({ error: "No encontrado" }, 404));

export default app;
