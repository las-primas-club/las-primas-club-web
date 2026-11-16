import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import {
  MAX_PROPOSALS,
  MAX_VOTES,
  type AccessRequest,
  type AppConfig,
  type Ballot,
  type Book,
  type BookDetail,
  type Comment,
  type Kind,
  type Member,
  type ClubNotification,
  type Progress,
  type Rating,
  type Round,
  type Rsvp,
  type Stats,
  type StatsItem,
  type StatsMember,
  type User,
} from "../shared/types";
import { bookDescription, searchBooks } from "./bookSearch";
import { findMovieId, searchMovies, watchProviders } from "./movieSearch";
import { notifyAll, pushEnabled, validPushEndpoint } from "./push";
import {
  KINDLE_ADDRESS,
  KindleSendError,
  MAX_EPUB_BYTES,
  contentDisposition,
  epubFileName,
  epubKey,
  kindleEnabled,
  looksLikeEpub,
  sendToKindle,
} from "./ebook";
import { newSessionToken, parseEmailList, verifyGoogleToken, type GoogleProfile } from "./auth";

type AppEnv = { Bindings: Env; Variables: { user: User | null } };
type Ctx = Context<AppEnv>;

const SESSION_COOKIE = "lpc_session";
const SESSION_DAYS = 60;
const MAX_ACCESS_REQUESTS = 200;

const app = new Hono<AppEnv>().basePath("/api");

// ---------- Seguridad ----------

// Cabeceras de seguridad en todas las respuestas de la API. Nada de la API se guarda en caché: son datos privados.
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    strictTransportSecurity: "max-age=31536000",
    xFrameOptions: "DENY",
  }),
);
app.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
});

// Defensa contra CSRF: las peticiones que cambian algo solo se aceptan desde la propia web.
// La cookie ya es SameSite=Lax; esto cubre además otros subdominios del mismo dominio.
// Excepción: el login por redirección, que llega desde Google (lleva su propio token anti-CSRF).
app.use("*", async (c, next) => {
  const safe = c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS";
  if (!safe && c.req.path !== "/api/auth/google/redirect") {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "Origen no permitido" }, 403);
    if (!origin && c.req.header("sec-fetch-site") === "cross-site") return c.json({ error: "Origen no permitido" }, 403);
  }
  await next();
});

// ---------- Sesión ----------

app.use("*", async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.picture, u.kindle_email, m.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN members m ON m.email = u.email
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
      .bind(token)
      .first<Omit<User, "isAdmin"> & { role: string | null }>();
    // Si alguien deja de ser miembro, su sesión deja de valer al momento.
    if (row && (row.role || isProtectedAdmin(c.env, row.email))) {
      const { role, ...user } = row;
      c.set("user", { ...user, isAdmin: role === "admin" || isProtectedAdmin(c.env, row.email) });
    }
  }
  await next();
});

// Toda la API exige sesión, salvo lo necesario para poder iniciarla.
// El enlace temporal del epub (/api/kindle-file/<token>) también es público: lo descarga Resend, no el navegador.
const PUBLIC_PATHS = new Set([
  "/api/config",
  "/api/me",
  "/api/auth/google",
  "/api/auth/google/redirect",
  "/api/auth/dev",
  "/api/auth/logout",
]);

/** Fecha y hora local tal como la da <input type="datetime-local">: "YYYY-MM-DDTHH:MM". Vacío = quitarla. */
function localDateTime(value: unknown, field: string): string | null {
  const v = text(value, field, 16, false);
  if (v && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) bad(`${field} no válida`);
  return v;
}

/** Manda un aviso push a todo el club sin retrasar la respuesta. */
function announce(c: Ctx, note: ClubNotification) {
  c.executionCtx.waitUntil(
    notifyAll(c.env, new URL(c.req.url).origin, note).catch((e) => console.error("No se pudo avisar", e)),
  );
}

app.use("*", async (c, next) => {
  const isPublic = PUBLIC_PATHS.has(c.req.path) || c.req.path.startsWith("/api/kindle-file/");
  if (!isPublic && !c.get("user")) {
    return c.json({ error: "Tienes que iniciar sesión" }, 401);
  }
  await next();
});

/** Admins de emergencia (secreto ADMIN_EMAILS): siempre pueden entrar y no se pueden quitar desde la web. */
function isProtectedAdmin(env: Env, email: string) {
  return parseEmailList(env.ADMIN_EMAILS).includes(email.toLowerCase());
}

/** Login de desarrollo: solo con DEV_LOGIN=true y desde localhost. */
function devLoginEnabled(c: Ctx) {
  const host = new URL(c.req.url).hostname;
  return c.env.DEV_LOGIN === "true" && (host === "localhost" || host === "127.0.0.1");
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

/** Libro o película. Sin indicar, libro (así siguen funcionando las llamadas de antes). */
function kindOf(value: unknown): Kind {
  if (value === undefined || value === null || value === "" || value === "book") return "book";
  if (value === "movie") return "movie";
  bad("Tipo no válido");
}

/** Cuerpo JSON de la petición. Si no es un objeto JSON válido, 400 (en vez de un error interno). */
async function jsonBody<T extends object>(c: Ctx): Promise<T> {
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) bad("Petición no válida");
  return body as T;
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

/** Comprueba que es miembro, crea la sesión y pone la cookie. */
async function loginAs(c: Ctx, profile: GoogleProfile): Promise<void> {
  if (isProtectedAdmin(c.env, profile.email)) {
    await c.env.DB.prepare(`INSERT INTO members (email, role) VALUES (?, 'admin') ON CONFLICT (email) DO UPDATE SET role = 'admin'`)
      .bind(profile.email)
      .run();
  }
  const member = await c.env.DB.prepare(`SELECT 1 FROM members WHERE email = ?`).bind(profile.email).first();
  if (!member) {
    // No es miembro: guardamos la solicitud para que un admin la acepte o la rechace.
    // Con tope: cualquiera con cuenta de Google puede llegar hasta aquí y no queremos que llenen la tabla.
    await c.env.DB.prepare(
      `INSERT INTO access_requests (email, name, picture)
       SELECT ?1, ?2, ?3
       WHERE (SELECT COUNT(*) FROM access_requests) < ?4 OR EXISTS (SELECT 1 FROM access_requests WHERE email = ?1)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, picture = excluded.picture, requested_at = datetime('now')`,
    )
      .bind(profile.email, profile.name.slice(0, 100), profile.picture, MAX_ACCESS_REQUESTS)
      .run();
    throw new HTTPException(403, {
      message: "Todavía no eres miembro del club. Tu solicitud ha quedado registrada: en cuanto un admin la acepte, podrás entrar.",
    });
  }
  const user = await c.env.DB.prepare(
    `INSERT INTO users (google_sub, email, name, picture, last_login_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture,
       last_login_at = datetime('now')
     RETURNING id`,
  )
    .bind(profile.sub, profile.email, profile.name.slice(0, 100), profile.picture)
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
}

// ---------- Config y auth ----------

app.get("/config", (c) =>
  c.json<AppConfig>({
    googleClientId: c.env.GOOGLE_CLIENT_ID ?? "",
    devLogin: devLoginEnabled(c),
    kindleFrom: kindleEnabled(c.env) ? c.env.KINDLE_FROM : null,
    movieSearch: Boolean(c.env.TMDB_API_KEY),
    pushKey: pushEnabled(c.env) ? c.env.VAPID_PUBLIC_KEY : null,
  }),
);

app.get("/me", (c) => c.json(c.get("user")));

app.post("/auth/google", async (c) => {
  const { credential } = await jsonBody<{ credential?: string }>(c);
  if (!credential) bad("Falta el token de Google");
  if (!c.env.GOOGLE_CLIENT_ID) throw new HTTPException(500, { message: "GOOGLE_CLIENT_ID no configurado" });
  let profile: GoogleProfile;
  try {
    profile = await verifyGoogleToken(credential, c.env.GOOGLE_CLIENT_ID);
  } catch {
    throw new HTTPException(401, { message: "No se pudo verificar el login de Google" });
  }
  await loginAs(c, profile);
  return c.json({ ok: true });
});

// Login por redirección (lo usa la app instalada, donde la ventana emergente de Google no funciona bien).
// Google envía aquí un formulario POST con el token y redirigimos a la web con la sesión ya creada.
app.post("/auth/google/redirect", async (c) => {
  // El error viaja como código (no como texto libre) para que nadie pueda fabricar un enlace con un mensaje falso.
  const back = (error?: "failed" | "not_member") => c.redirect(error ? `/?login_error=${error}` : "/", 303);
  const form = await c.req.parseBody();
  const credential = typeof form.credential === "string" ? form.credential : "";
  const csrfCookie = getCookie(c, "g_csrf_token");
  if (!credential || (csrfCookie && csrfCookie !== form.g_csrf_token)) return back("failed");
  try {
    await loginAs(c, await verifyGoogleToken(credential, c.env.GOOGLE_CLIENT_ID));
  } catch (e) {
    return back(e instanceof HTTPException && e.status === 403 ? "not_member" : "failed");
  }
  return back();
});

// Login sin Google, solo para desarrollo local (DEV_LOGIN=true en .dev.vars)
app.post("/auth/dev", async (c) => {
  if (!devLoginEnabled(c)) throw new HTTPException(404);
  const body = await jsonBody<{ name?: string; email?: string }>(c);
  const email = text(body.email, "email", 200)!.toLowerCase();
  const name = text(body.name, "nombre", 100, false) ?? email.split("@")[0];
  await loginAs(c, { sub: `dev:${email}`, email, name, picture: null });
  return c.json({ ok: true });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// ---------- Búsqueda de libros (Google Books / Open Library) ----------

app.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 200);
  if (q.length < 3) return c.json([]);
  const kind = kindOf(c.req.query("kind"));
  try {
    if (kind === "movie") return c.json(c.env.TMDB_API_KEY ? await searchMovies(q, c.env.TMDB_API_KEY) : []);
    return c.json(await searchBooks(q, c.env.GOOGLE_BOOKS_API_KEY));
  } catch (e) {
    console.error("Búsqueda de libros falló", e);
    throw new HTTPException(502, { message: "No se pudo buscar ahora mismo" });
  }
});

/** Sinopsis de un libro elegido en la búsqueda (Open Library no la da en la lista de resultados). */
app.get("/search/description", async (c) => {
  const key = (c.req.query("key") ?? "").slice(0, 200);
  try {
    return c.json({ description: await bookDescription(key) });
  } catch (e) {
    console.warn("No se pudo obtener la sinopsis", e);
    return c.json({ description: "" });
  }
});

// ---------- Libros ----------

const BOOK_SELECT = `
  SELECT b.id, b.kind, b.title, b.author, b.cover_url, b.description, b.year, b.status,
         b.started_at, b.finished_at, b.proposed_by, p.name AS proposed_by_name, b.archived_at, b.epub_name, b.epub_size,
         b.meet_at, b.meet_place,
         ROUND(AVG(r.score), 1) AS avg_rating, COUNT(r.score) AS rating_count
  FROM books b
  LEFT JOIN users p ON p.id = b.proposed_by
  LEFT JOIN ratings r ON r.book_id = b.id`;

const BOOK_STATUSES = new Set(["proposed", "current", "read"]);

/** Lista de libros o películas (?kind=movie). Con ?kind=all, todo (lo usa el panel de admin). */
app.get("/books", async (c) => {
  const status = c.req.query("status");
  const kindParam = c.req.query("kind");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (kindParam !== "all") {
    conditions.push("b.kind = ?");
    params.push(kindOf(kindParam));
  }
  if (status) {
    if (!BOOK_STATUSES.has(status)) bad("Estado no válido");
    conditions.push("b.status = ?");
    params.push(status);
    // "proposed" son las pendientes; las archivadas están en el histórico de rondas.
    if (status === "proposed") conditions.push("b.archived_at IS NULL");
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(
    `${BOOK_SELECT} ${where} GROUP BY b.id ORDER BY COALESCE(b.finished_at, b.started_at, b.created_at) DESC`,
  )
    .bind(...params)
    .all<Book>();
  return c.json(results);
});

async function bookDetail(c: Ctx, where: string, ...params: unknown[]): Promise<BookDetail | null> {
  const book = await c.env.DB.prepare(`${BOOK_SELECT} WHERE ${where} GROUP BY b.id`)
    .bind(...params)
    .first<Book>();
  if (!book) return null;
  const user = c.get("user");
  const [ratings, comments, rsvps, progress] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT u.id AS user_id, u.name AS user_name, r.score FROM ratings r JOIN users u ON u.id = r.user_id
       WHERE r.book_id = ? ORDER BY r.updated_at`,
    ).bind(book.id),
    c.env.DB.prepare(
      `SELECT c.id, c.body, c.created_at, c.edited_at, c.spoiler, u.id AS user_id, u.name AS user_name, u.picture AS user_picture
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.book_id = ? ORDER BY c.created_at`,
    ).bind(book.id),
    c.env.DB.prepare(
      `SELECT u.id AS user_id, u.name, r.going FROM meetup_rsvps r JOIN users u ON u.id = r.user_id
       WHERE r.book_id = ? ORDER BY r.going DESC, u.name COLLATE NOCASE`,
    ).bind(book.id),
    c.env.DB.prepare(
      `SELECT u.id AS user_id, u.name, p.percent FROM progress p JOIN users u ON u.id = p.user_id
       WHERE p.book_id = ? ORDER BY p.percent DESC, u.name COLLATE NOCASE`,
    ).bind(book.id),
  ]);
  const ratingRows = ratings.results as (Rating & { user_id: number })[];
  return {
    ...book,
    my_rating: user ? (ratingRows.find((r) => r.user_id === user.id)?.score ?? null) : null,
    ratings: ratingRows.map(({ user_name, score }) => ({ user_name, score })),
    comments: (comments.results as unknown as (Omit<Comment, "spoiler"> & { spoiler: number })[]).map((cm) => ({
      ...cm,
      spoiler: Boolean(cm.spoiler),
    })),
    rsvps: (rsvps.results as unknown as (Omit<Rsvp, "going"> & { going: number })[]).map((r) => ({ ...r, going: Boolean(r.going) })),
    progress: progress.results as unknown as Progress[],
  };
}

app.get("/books/current", async (c) =>
  c.json(await bookDetail(c, `b.status = 'current' AND b.kind = ?`, kindOf(c.req.query("kind")))),
);

app.get("/books/:id", async (c) => {
  const book = await bookDetail(c, `b.id = ?`, idParam(c));
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  return c.json(book);
});

function bookFields(body: Record<string, unknown>) {
  const cover = text(body.cover_url, "portada", 500, false);
  if (cover && !/^https:\/\//.test(cover)) bad("La portada debe ser una URL https://");
  const year = text(body.year, "año", 4, false);
  if (year && !/^\d{4}$/.test(year)) bad("El año debe tener 4 cifras");
  return {
    title: text(body.title, "título", 200),
    author: text(body.author, "autor", 200),
    description: text(body.description, "descripción", 2000, false),
    cover,
    year,
  };
}

/** SQL: cuántas propuestas pendientes tiene la persona ?2 de este tipo ?1. */
const PENDING_PROPOSALS = `SELECT COUNT(*) FROM books WHERE kind = ?1 AND status = 'proposed' AND archived_at IS NULL AND proposed_by = ?2`;

function proposalLimitError(kind: Kind) {
  return new HTTPException(409, {
    message:
      kind === "movie"
        ? `Ya tienes ${MAX_PROPOSALS} películas propuestas. Quita una si quieres proponer otra.`
        : `Ya tienes ${MAX_PROPOSALS} libros propuestos. Quita uno si quieres proponer otro.`,
  });
}

/** Si hay una ronda abierta de su tipo, la propuesta entra directamente como candidata. */
async function joinOpenRound(c: Ctx, bookId: number, kind: Kind) {
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO round_candidates (round_id, book_id) SELECT id, ? FROM rounds WHERE status = 'open' AND kind = ?`,
  )
    .bind(bookId, kind)
    .run();
}

/** Proponer un libro o una película (máximo MAX_PROPOSALS pendientes por persona y tipo). Si hay una ronda abierta de su tipo, entra directamente como candidato. */
app.post("/books", async (c) => {
  const user = requireUser(c);
  const body = await jsonBody<Record<string, unknown>>(c);
  const kind = kindOf(body.kind);
  const { title, author, description, cover, year } = bookFields(body);
  // Si se eligió de la búsqueda de TMDB, guardamos su id (sirve para saber dónde verla).
  const tmdbMatch = kind === "movie" && typeof body.source === "string" ? /^tmdb:(\d{1,10})$/.exec(body.source) : null;
  const tmdbId = tmdbMatch ? Number(tmdbMatch[1]) : null;

  // El límite va en el propio INSERT: si ya tiene el máximo, no inserta nada.
  const book = await c.env.DB.prepare(
    `INSERT INTO books (kind, title, author, description, cover_url, year, proposed_by, tmdb_id)
     SELECT ?1, ?3, ?4, ?5, ?6, ?7, ?2, ?9
     WHERE (${PENDING_PROPOSALS}) < ?8
     RETURNING id`,
  )
    .bind(kind, user.id, title, author, description, cover, year, MAX_PROPOSALS, tmdbId)
    .first<{ id: number }>();
  if (!book) throw proposalLimitError(kind);
  await joinOpenRound(c, book.id, kind);
  return c.json({ id: book.id }, 201);
});

/** Volver a proponer algo que perdió una votación (sale del histórico). Pasa a ser propuesta de quien lo rescata. */
app.post("/books/:id/repropose", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const book = await c.env.DB.prepare(`SELECT kind, status, archived_at FROM books WHERE id = ?`)
    .bind(id)
    .first<{ kind: Kind; status: string; archived_at: string | null }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (book.status !== "proposed" || !book.archived_at) bad("Esta propuesta no está archivada");
  const res = await c.env.DB.prepare(
    `UPDATE books SET archived_at = NULL, proposed_by = ?2
     WHERE id = ?3 AND archived_at IS NOT NULL AND (${PENDING_PROPOSALS}) < ?4`,
  )
    .bind(book.kind, user.id, id, MAX_PROPOSALS)
    .run();
  if (!res.meta.changes) throw proposalLimitError(book.kind);
  await joinOpenRound(c, id, book.kind);
  return c.json({ ok: true });
});

/** Borrar un libro. Quien lo propuso puede borrar su propuesta; un admin, cualquier libro (con sus votos, notas y comentarios). */
app.delete("/books/:id", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const book = await c.env.DB.prepare(`SELECT status, proposed_by, archived_at FROM books WHERE id = ?`)
    .bind(id)
    .first<{ status: string; proposed_by: number | null; archived_at: string | null }>();
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  if (!user.isAdmin) {
    if (book.status !== "proposed" || book.archived_at) bad("Solo se pueden quitar propuestas pendientes");
    if (book.proposed_by !== user.id) throw new HTTPException(403, { message: "No es tu propuesta" });
  }
  await c.env.DB.prepare(`DELETE FROM books WHERE id = ?`).bind(id).run();
  c.executionCtx.waitUntil(c.env.EPUBS.delete(epubKey(id)));
  return c.json({ ok: true });
});

/** Editar los datos de un libro o una película. Un admin, cualquiera; quien lo propuso, su propuesta mientras esté pendiente. */
app.patch("/books/:id", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const { title, author, description, cover, year } = bookFields(await jsonBody<Record<string, unknown>>(c));
  const book = await c.env.DB.prepare(`SELECT status, proposed_by, archived_at FROM books WHERE id = ?`)
    .bind(id)
    .first<{ status: string; proposed_by: number | null; archived_at: string | null }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (!user.isAdmin) {
    if (book.proposed_by !== user.id) throw new HTTPException(403, { message: "No es tu propuesta" });
    if (book.status !== "proposed" || book.archived_at) bad("Solo puedes editar tus propuestas pendientes");
  }
  // Si cambia el título o el año, el id de TMDB guardado puede no corresponder: se vuelve a buscar cuando haga falta.
  await c.env.DB.prepare(
    `UPDATE books SET tmdb_id = CASE WHEN title = ?1 AND year IS ?5 THEN tmdb_id ELSE NULL END,
       title = ?1, author = ?2, description = ?3, cover_url = ?4, year = ?5 WHERE id = ?6`,
  )
    .bind(title, author, description, cover, year, id)
    .run();
  return c.json({ ok: true });
});

/** Admin: empezar a leer (o ver) uno ya, sin votación. El que estaba en curso de su mismo tipo pasa a leído/visto. */
app.post("/books/:id/start", async (c) => {
  requireAdmin(c);
  const id = idParam(c);
  const book = await c.env.DB.prepare(`SELECT kind, status FROM books WHERE id = ?`)
    .bind(id)
    .first<{ kind: Kind; status: string }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (book.status === "current") bad("Ya está en curso");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE books SET status = 'read', finished_at = datetime('now') WHERE status = 'current' AND kind = ?`,
    ).bind(book.kind),
    c.env.DB.prepare(
      `UPDATE books SET status = 'current', started_at = datetime('now'), finished_at = NULL, archived_at = NULL WHERE id = ?`,
    ).bind(id),
    // Sale de la ronda abierta si era candidato; en las rondas cerradas se queda como parte del histórico.
    c.env.DB.prepare(
      `DELETE FROM votes WHERE book_id = ? AND round_id IN (SELECT id FROM rounds WHERE status = 'open')`,
    ).bind(id),
    c.env.DB.prepare(
      `DELETE FROM round_candidates WHERE book_id = ? AND round_id IN (SELECT id FROM rounds WHERE status = 'open')`,
    ).bind(id),
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
  const { score } = await jsonBody<{ score?: number }>(c);
  // De 0,5 a 5 en pasos de media estrella
  if (typeof score !== "number" || !Number.isInteger(score * 2) || score < 0.5 || score > 5) {
    bad("La puntuación debe ir de 0,5 a 5, en medias estrellas");
  }
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

/** Quitar mi puntuación. */
app.delete("/books/:id/rating", async (c) => {
  const user = requireUser(c);
  await c.env.DB.prepare(`DELETE FROM ratings WHERE book_id = ? AND user_id = ?`).bind(idParam(c), user.id).run();
  return c.json({ ok: true });
});

app.post("/books/:id/comments", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const input = await jsonBody<{ body?: string; spoiler?: unknown }>(c);
  const body = text(input.body, "comentario", 4000);
  const exists = await c.env.DB.prepare(`SELECT 1 FROM books WHERE id = ?`).bind(id).first();
  if (!exists) throw new HTTPException(404, { message: "Libro no encontrado" });
  await c.env.DB.prepare(`INSERT INTO comments (book_id, user_id, body, spoiler) VALUES (?, ?, ?, ?)`)
    .bind(id, user.id, body, input.spoiler === true ? 1 : 0)
    .run();
  return c.json({ ok: true }, 201);
});

/** Editar un comentario: solo quien lo escribió. */
app.patch("/comments/:id", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const input = await jsonBody<{ body?: string; spoiler?: unknown }>(c);
  const body = text(input.body, "comentario", 4000);
  const comment = await c.env.DB.prepare(`SELECT user_id FROM comments WHERE id = ?`)
    .bind(id)
    .first<{ user_id: number }>();
  if (!comment) throw new HTTPException(404, { message: "Comentario no encontrado" });
  if (comment.user_id !== user.id) throw new HTTPException(403, { message: "Solo puedes editar tus comentarios" });
  // Marcar o desmarcar el spoiler no cuenta como edición del texto.
  await c.env.DB.prepare(
    `UPDATE comments SET edited_at = CASE WHEN body = ?1 THEN edited_at ELSE datetime('now') END,
       body = ?1, spoiler = COALESCE(?2, spoiler) WHERE id = ?3`,
  )
    .bind(body, typeof input.spoiler === "boolean" ? Number(input.spoiler) : null, id)
    .run();
  return c.json({ ok: true });
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

// ---------- Quedada, progreso y dónde verla ----------

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Admin: poner (o quitar, con fecha vacía) la quedada del libro o la película en curso. */
app.put("/books/:id/meetup", async (c) => {
  requireAdmin(c);
  const id = idParam(c);
  const body = await jsonBody<{ meet_at?: unknown; meet_place?: unknown }>(c);
  const meetAt = localDateTime(body.meet_at, "fecha");
  const place = meetAt ? text(body.meet_place, "sitio", 200, false) : null;
  const book = await c.env.DB.prepare(`SELECT kind, title, meet_at FROM books WHERE id = ?`)
    .bind(id)
    .first<{ kind: Kind; title: string; meet_at: string | null }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE books SET meet_at = ?, meet_place = ? WHERE id = ?`).bind(meetAt, place, id),
    // Si cambia la fecha (o se quita), las respuestas anteriores ya no valen.
    ...(meetAt !== book.meet_at ? [c.env.DB.prepare(`DELETE FROM meetup_rsvps WHERE book_id = ?`).bind(id)] : []),
  ]);
  if (meetAt && meetAt !== book.meet_at) {
    const when = `${Number(meetAt.slice(8, 10))} de ${MONTHS[Number(meetAt.slice(5, 7)) - 1]} a las ${meetAt.slice(11)}`;
    announce(c, {
      title: "¡Hay quedada!",
      body: `${book.title}: ${when}${place ? `, ${place}` : ""}. Di si vienes.`,
      url: book.kind === "movie" ? `/peliculas/${id}` : `/libros/${id}`,
    });
  }
  return c.json({ ok: true });
});

/** Voy / no puedo ir a la quedada (going: null para quitar mi respuesta). */
app.put("/books/:id/rsvp", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const { going } = await jsonBody<{ going?: unknown }>(c);
  if (going === null || going === undefined) {
    await c.env.DB.prepare(`DELETE FROM meetup_rsvps WHERE book_id = ? AND user_id = ?`).bind(id, user.id).run();
    return c.json({ ok: true });
  }
  if (typeof going !== "boolean") bad("Respuesta no válida");
  const book = await c.env.DB.prepare(`SELECT meet_at FROM books WHERE id = ?`).bind(id).first<{ meet_at: string | null }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (!book.meet_at) bad("Todavía no hay quedada");
  await c.env.DB.prepare(
    `INSERT INTO meetup_rsvps (book_id, user_id, going) VALUES (?, ?, ?)
     ON CONFLICT (book_id, user_id) DO UPDATE SET going = excluded.going, updated_at = datetime('now')`,
  )
    .bind(id, user.id, going ? 1 : 0)
    .run();
  return c.json({ ok: true });
});

/** Por dónde voy: porcentaje de 0 a 100 (percent: null para quitarlo). */
app.put("/books/:id/progress", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  const { percent } = await jsonBody<{ percent?: unknown }>(c);
  if (percent === null || percent === undefined) {
    await c.env.DB.prepare(`DELETE FROM progress WHERE book_id = ? AND user_id = ?`).bind(id, user.id).run();
    return c.json({ ok: true });
  }
  if (typeof percent !== "number" || !Number.isInteger(percent) || percent < 0 || percent > 100) bad("El progreso va de 0 a 100");
  const book = await c.env.DB.prepare(`SELECT status FROM books WHERE id = ?`).bind(id).first<{ status: string }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (book.status === "proposed") bad("Todavía no se ha elegido");
  await c.env.DB.prepare(
    `INSERT INTO progress (book_id, user_id, percent) VALUES (?, ?, ?)
     ON CONFLICT (book_id, user_id) DO UPDATE SET percent = excluded.percent, updated_at = datetime('now')`,
  )
    .bind(id, user.id, percent)
    .run();
  return c.json({ ok: true });
});

/** Dónde ver una película en España. null si no hay clave de TMDB o no se encuentra la película. */
app.get("/books/:id/watch", async (c) => {
  const id = idParam(c);
  const key = c.env.TMDB_API_KEY;
  const book = await c.env.DB.prepare(`SELECT kind, title, year, tmdb_id FROM books WHERE id = ?`)
    .bind(id)
    .first<{ kind: Kind; title: string; year: string | null; tmdb_id: number | null }>();
  if (!book) throw new HTTPException(404, { message: "No encontrado" });
  if (!key || book.kind !== "movie") return c.json(null);
  try {
    let tmdbId = book.tmdb_id;
    if (!tmdbId) {
      // Películas propuestas a mano o antes de guardar el id: la buscamos por título y lo recordamos.
      tmdbId = await findMovieId(book.title, book.year, key);
      if (tmdbId) await c.env.DB.prepare(`UPDATE books SET tmdb_id = ? WHERE id = ?`).bind(tmdbId, id).run();
    }
    return c.json(tmdbId ? await watchProviders(tmdbId, key) : null);
  } catch (e) {
    console.warn("No se pudo consultar dónde verla", e);
    return c.json(null);
  }
});

// ---------- Epub y envío al Kindle ----------

const KINDLE_SENDS_PER_DAY = 10;
const KINDLE_LINK_MINUTES = 60;

/** Admin: subir (o reemplazar) el epub de un libro. El cuerpo es el archivo tal cual. */
app.put("/books/:id/epub", async (c) => {
  requireAdmin(c);
  const id = idParam(c);
  if (Number(c.req.header("content-length") ?? 0) > MAX_EPUB_BYTES) bad("El epub no puede pasar de 25 MB");
  const book = await c.env.DB.prepare(`SELECT title, kind FROM books WHERE id = ?`)
    .bind(id)
    .first<{ title: string; kind: Kind }>();
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  if (book.kind !== "book") bad("Solo los libros pueden tener epub");

  const data = await c.req.arrayBuffer();
  if (!data.byteLength) bad("El archivo está vacío");
  if (data.byteLength > MAX_EPUB_BYTES) bad("El epub no puede pasar de 25 MB");
  if (!looksLikeEpub(new Uint8Array(data, 0, Math.min(4, data.byteLength)))) bad("Ese archivo no parece un epub");

  let original = "";
  try {
    original = decodeURIComponent(c.req.header("x-filename") ?? "");
  } catch {
    /* nombre ilegible: usamos el título */
  }
  const name = epubFileName(original, book.title);
  await c.env.EPUBS.put(epubKey(id), data);
  await c.env.DB.prepare(`UPDATE books SET epub_name = ?, epub_size = ?, epub_uploaded_at = datetime('now') WHERE id = ?`)
    .bind(name, data.byteLength, id)
    .run();
  return c.json({ ok: true });
});

app.delete("/books/:id/epub", async (c) => {
  requireAdmin(c);
  const id = idParam(c);
  await c.env.EPUBS.delete(epubKey(id));
  await c.env.DB.prepare(`UPDATE books SET epub_name = NULL, epub_size = NULL, epub_uploaded_at = NULL WHERE id = ?`)
    .bind(id)
    .run();
  return c.json({ ok: true });
});

async function epubResponse(env: Env, bookId: number, name: string) {
  const file = await env.EPUBS.get(epubKey(bookId), "stream");
  if (!file) throw new HTTPException(404, { message: "El epub ya no está disponible" });
  return new Response(file, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": contentDisposition(name),
      "Cache-Control": "private, no-store",
    },
  });
}

/** Descargar el epub (cualquier miembro). */
app.get("/books/:id/epub", async (c) => {
  const id = idParam(c);
  const book = await c.env.DB.prepare(`SELECT epub_name FROM books WHERE id = ?`).bind(id).first<{ epub_name: string | null }>();
  if (!book?.epub_name) throw new HTTPException(404, { message: "Este libro no tiene epub" });
  return epubResponse(c.env, id, book.epub_name);
});

/** Guardar (o borrar, con null) mi dirección de Kindle. */
app.put("/me/kindle", async (c) => {
  const user = requireUser(c);
  const { email } = await jsonBody<{ email?: string | null }>(c);
  const value = text(email, "dirección de Kindle", 200, false)?.toLowerCase() ?? null;
  if (value && !KINDLE_ADDRESS.test(value)) bad("Tiene que ser tu dirección de Kindle, terminada en @kindle.com");
  await c.env.DB.prepare(`UPDATE users SET kindle_email = ? WHERE id = ?`).bind(value, user.id).run();
  return c.json({ ok: true });
});

/** Mandar el epub a mi Kindle por email. */
app.post("/books/:id/kindle", async (c) => {
  const user = requireUser(c);
  const id = idParam(c);
  if (!kindleEnabled(c.env)) throw new HTTPException(503, { message: "El envío al Kindle no está configurado" });
  if (!user.kindle_email) bad("Primero guarda tu dirección de Kindle");
  const book = await c.env.DB.prepare(`SELECT title, author, epub_name FROM books WHERE id = ?`)
    .bind(id)
    .first<{ title: string; author: string; epub_name: string | null }>();
  if (!book) throw new HTTPException(404, { message: "Libro no encontrado" });
  if (!book.epub_name) bad("Este libro todavía no tiene epub");

  const sent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM kindle_sends WHERE user_id = ? AND created_at > datetime('now', '-1 day')`,
  )
    .bind(user.id)
    .first<{ n: number }>();
  if ((sent?.n ?? 0) >= KINDLE_SENDS_PER_DAY) bad(`Máximo ${KINDLE_SENDS_PER_DAY} envíos al día. Prueba mañana.`);

  const token = newSessionToken();
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM kindle_sends WHERE created_at <= datetime('now', '-2 days')`),
    c.env.DB.prepare(`INSERT INTO kindle_sends (token, book_id, user_id, kindle_email) VALUES (?, ?, ?, ?)`).bind(
      token,
      id,
      user.id,
      user.kindle_email,
    ),
  ]);
  try {
    await sendToKindle(c.env, {
      to: user.kindle_email!,
      fileUrl: `${new URL(c.req.url).origin}/api/kindle-file/${token}`,
      filename: book.epub_name!,
      title: book.title,
      author: book.author,
      senderName: user.name,
    });
  } catch (e) {
    // Si no ha salido, no cuenta para el límite diario.
    await c.env.DB.prepare(`DELETE FROM kindle_sends WHERE token = ?`).bind(token).run();
    if (e instanceof KindleSendError) throw new HTTPException(e.status, { message: e.message });
    throw e;
  }
  return c.json({ ok: true, to: user.kindle_email });
});

/** Enlace temporal desde el que Resend descarga el epub para adjuntarlo. Público pero imposible de adivinar. */
app.get("/kindle-file/:token", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT s.book_id, b.epub_name FROM kindle_sends s JOIN books b ON b.id = s.book_id
     WHERE s.token = ? AND s.created_at > datetime('now', ?)`,
  )
    .bind(c.req.param("token"), `-${KINDLE_LINK_MINUTES} minutes`)
    .first<{ book_id: number; epub_name: string | null }>();
  if (!row?.epub_name) throw new HTTPException(404, { message: "Enlace caducado" });
  return epubResponse(c.env, row.book_id, row.epub_name);
});

// ---------- Rondas de votación ----------

async function roundDetail(c: Ctx, roundId: number): Promise<Round> {
  const user = c.get("user");
  const [round, candidates, votes, pending] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id, kind, status, created_at, closed_at, closes_at, winner_book_id FROM rounds WHERE id = ?`).bind(roundId),
    c.env.DB.prepare(
      `${BOOK_SELECT}
       JOIN round_candidates rc ON rc.book_id = b.id AND rc.round_id = ?1
       GROUP BY b.id`,
    ).bind(roundId),
    c.env.DB.prepare(
      `SELECT v.user_id, v.book_id, u.name, u.picture FROM votes v JOIN users u ON u.id = v.user_id
       WHERE v.round_id = ? ORDER BY u.name, v.slot`,
    ).bind(roundId),
    // Miembros que ya han entrado alguna vez y todavía no han votado en esta ronda.
    c.env.DB.prepare(
      `SELECT u.name FROM users u JOIN members m ON m.email = u.email
       WHERE NOT EXISTS (SELECT 1 FROM votes v WHERE v.round_id = ? AND v.user_id = u.id)
       ORDER BY u.name COLLATE NOCASE`,
    ).bind(roundId),
  ]);
  const r = round.results[0] as Pick<Round, "id" | "kind" | "status" | "created_at" | "closed_at" | "closes_at" | "winner_book_id">;
  if (!r) throw new HTTPException(404, { message: "Ronda no encontrada" });
  const rows = votes.results as { user_id: number; book_id: number; name: string; picture: string | null }[];

  const counts = new Map<number, number>();
  const byUser = new Map<number, Ballot>();
  for (const v of rows) {
    counts.set(v.book_id, (counts.get(v.book_id) ?? 0) + 1);
    const ballot = byUser.get(v.user_id) ?? { user_id: v.user_id, name: v.name, picture: v.picture, book_ids: [] };
    ballot.book_ids.push(v.book_id);
    byUser.set(v.user_id, ballot);
  }
  return {
    ...r,
    candidates: (candidates.results as unknown as Book[])
      .map((book) => ({ book, votes: counts.get(book.id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.book.id - b.book.id),
    my_votes: rows.filter((v) => v.user_id === user?.id).map((v) => v.book_id),
    voters: byUser.size,
    total_votes: rows.length,
    // Mientras la ronda está abierta, los votos son anónimos: solo se ven los totales.
    ballots: r.status === "closed" ? [...byUser.values()] : null,
    pending_voters: r.status === "open" ? (pending.results as { name: string }[]).map((p) => p.name) : null,
  };
}

/** Ronda abierta (de libros o de cine, ?kind=movie), o la última cerrada si no hay ninguna abierta. */
app.get("/rounds/current", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id FROM rounds WHERE kind = ? ORDER BY (status = 'open') DESC, id DESC LIMIT 1`,
  )
    .bind(kindOf(c.req.query("kind")))
    .first<{ id: number }>();
  return c.json(row ? await roundDetail(c, row.id) : null);
});

/** Histórico: rondas cerradas de un tipo, de la más reciente a la más antigua. */
app.get("/rounds", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id FROM rounds WHERE kind = ? AND status = 'closed' ORDER BY id DESC LIMIT 50`,
  )
    .bind(kindOf(c.req.query("kind")))
    .all<{ id: number }>();
  return c.json(await Promise.all(results.map((r) => roundDetail(c, r.id))));
});

/** Admin: abrir una ronda nueva. Entran todas las propuestas pendientes. */
app.post("/rounds", async (c) => {
  requireAdmin(c);
  const input = await jsonBody<{ kind?: string; closes_at?: unknown }>(c).catch(() => ({}) as { kind?: string; closes_at?: unknown });
  const kind = kindOf(input.kind);
  const closesAt = localDateTime(input.closes_at, "fecha límite");
  const open = await c.env.DB.prepare(`SELECT 1 FROM rounds WHERE status = 'open' AND kind = ?`).bind(kind).first();
  if (open) bad("Ya hay una ronda abierta");
  const round = await c.env.DB.prepare(`INSERT INTO rounds (kind, closes_at) VALUES (?, ?) RETURNING id`)
    .bind(kind, closesAt)
    .first<{ id: number }>();
  await c.env.DB.prepare(
    `INSERT INTO round_candidates (round_id, book_id)
     SELECT ?, id FROM books WHERE status = 'proposed' AND archived_at IS NULL AND kind = ?`,
  )
    .bind(round!.id, kind)
    .run();
  announce(c, {
    title: "Votación abierta",
    body: kind === "movie" ? "Ya puedes votar la próxima película." : "Ya puedes votar el próximo libro.",
    url: kind === "movie" ? "/cine/votacion" : "/votacion",
  });
  return c.json({ id: round!.id }, 201);
});

/** Admin: poner, cambiar o quitar la fecha límite de la ronda abierta. */
app.patch("/rounds/:id", async (c) => {
  requireAdmin(c);
  const closesAt = localDateTime((await jsonBody<{ closes_at?: unknown }>(c)).closes_at, "fecha límite");
  const res = await c.env.DB.prepare(`UPDATE rounds SET closes_at = ? WHERE id = ? AND status = 'open'`)
    .bind(closesAt, idParam(c))
    .run();
  if (!res.meta.changes) bad("La ronda no está abierta");
  return c.json({ ok: true });
});

/** Repartir mis votos: lista de hasta MAX_VOTES candidatos (se puede repetir uno para darle los dos; nunca a una propuesta propia). Sustituye a los anteriores. */
app.put("/rounds/:id/votes", async (c) => {
  const user = requireUser(c);
  const roundId = idParam(c);
  const { bookIds } = await jsonBody<{ bookIds?: unknown }>(c);
  if (!Array.isArray(bookIds) || bookIds.length > MAX_VOTES || !bookIds.every((id) => Number.isInteger(id))) {
    bad(`Tienes ${MAX_VOTES} votos como máximo`);
  }
  const ids = bookIds as number[];
  const { results } = await c.env.DB.prepare(
    `SELECT rc.book_id, b.proposed_by FROM rounds r
     JOIN round_candidates rc ON rc.round_id = r.id
     JOIN books b ON b.id = rc.book_id
     WHERE r.id = ? AND r.status = 'open'`,
  )
    .bind(roundId)
    .all<{ book_id: number; proposed_by: number | null }>();
  const candidates = new Map(results.map((r) => [r.book_id, r.proposed_by]));
  if (!candidates.size) bad("La ronda no está abierta");
  if (!ids.every((id) => candidates.has(id))) bad("Solo puedes votar a los candidatos de esta ronda");
  if (ids.some((id) => candidates.get(id) === user.id)) bad("No puedes votar tus propias propuestas");
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM votes WHERE round_id = ? AND user_id = ?`).bind(roundId, user.id),
    ...ids.map((bookId, i) =>
      c.env.DB.prepare(`INSERT INTO votes (round_id, user_id, slot, book_id) VALUES (?, ?, ?, ?)`).bind(
        roundId,
        user.id,
        i + 1,
        bookId,
      ),
    ),
  ]);
  return c.json({ ok: true });
});

/** Admin: cerrar la ronda. El más votado pasa a estar en curso (empate: el propuesto antes); el resto se archiva. */
app.post("/rounds/:id/close", async (c) => {
  requireAdmin(c);
  const round = await roundDetail(c, idParam(c));
  if (round.status !== "open") bad("La ronda ya está cerrada");
  const winner = round.candidates[0];
  if (!winner || winner.votes === 0) bad("Nadie ha votado todavía");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE books SET status = 'read', finished_at = datetime('now') WHERE status = 'current' AND kind = ?`,
    ).bind(round.kind),
    c.env.DB.prepare(`UPDATE books SET status = 'current', started_at = datetime('now') WHERE id = ?`).bind(
      winner.book.id,
    ),
    c.env.DB.prepare(
      `UPDATE rounds SET status = 'closed', closed_at = datetime('now'), winner_book_id = ? WHERE id = ?`,
    ).bind(winner.book.id, round.id),
    // Las que pierden dejan de estar pendientes; siguen en el histórico y se pueden volver a proponer.
    c.env.DB.prepare(
      `UPDATE books SET archived_at = datetime('now')
       WHERE status = 'proposed' AND id IN (SELECT book_id FROM round_candidates WHERE round_id = ?)`,
    ).bind(round.id),
  ]);
  announce(c, {
    title: round.kind === "movie" ? "Ya hay película" : "Ya hay libro",
    body: `Ha ganado "${winner.book.title}" con ${winner.votes} voto${winner.votes === 1 ? "" : "s"}.`,
    url: round.kind === "movie" ? "/cine" : "/actual",
  });
  return c.json({ winnerId: winner.book.id });
});

/** Admin: cancelar la ronda abierta. Se borran sus votos; las propuestas siguen para la próxima. */
app.delete("/rounds/:id", async (c) => {
  requireAdmin(c);
  const res = await c.env.DB.prepare(`DELETE FROM rounds WHERE id = ? AND status = 'open'`).bind(idParam(c)).run();
  if (!res.meta.changes) bad("Solo se puede cancelar una ronda abierta");
  return c.json({ ok: true });
});

// ---------- Estadísticas ----------

app.get("/stats", async (c) => {
  const [years, totals, rated, members] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT substr(finished_at, 1, 4) AS year, SUM(kind = 'book') AS books, SUM(kind = 'movie') AS movies
       FROM books WHERE status = 'read' AND finished_at IS NOT NULL GROUP BY year ORDER BY year DESC`,
    ),
    c.env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM books WHERE status = 'read' AND kind = 'book') AS books,
              (SELECT COUNT(*) FROM books WHERE status = 'read' AND kind = 'movie') AS movies,
              (SELECT COUNT(*) FROM ratings) AS ratings,
              (SELECT COUNT(*) FROM comments) AS comments,
              (SELECT COUNT(*) FROM rounds WHERE status = 'closed') AS rounds`,
    ),
    c.env.DB.prepare(
      `SELECT b.id, b.kind, b.title, ROUND(AVG(r.score), 1) AS avg_rating, COUNT(*) AS rating_count
       FROM books b JOIN ratings r ON r.book_id = b.id GROUP BY b.id ORDER BY AVG(r.score) DESC, COUNT(*) DESC, b.id`,
    ),
    c.env.DB.prepare(
      `SELECT u.name,
              (SELECT COUNT(*) FROM books b WHERE b.proposed_by = u.id AND b.status IN ('current', 'read')) AS wins,
              (SELECT COUNT(*) FROM ratings r WHERE r.user_id = u.id) AS ratings,
              (SELECT ROUND(AVG(r.score), 1) FROM ratings r WHERE r.user_id = u.id) AS avg_given,
              (SELECT COUNT(*) FROM comments cm WHERE cm.user_id = u.id) AS comments
       FROM users u JOIN members m ON m.email = u.email ORDER BY u.name COLLATE NOCASE`,
    ),
  ]);
  const items = rated.results as unknown as StatsItem[];
  return c.json<Stats>({
    years: years.results as unknown as Stats["years"],
    totals: totals.results[0] as unknown as Stats["totals"],
    best: items.slice(0, 5),
    // Lo peor valorado solo tiene gracia si hay más cosas puntuadas que las que ya salen como mejores.
    worst: items.length > 5 ? items.slice(-Math.min(3, items.length - 5)).reverse() : [],
    members: members.results as unknown as StatsMember[],
  });
});

// ---------- Avisos push ----------

/** Activar los avisos en este dispositivo. */
app.post("/push/subscribe", async (c) => {
  const user = requireUser(c);
  if (!pushEnabled(c.env)) throw new HTTPException(503, { message: "Los avisos no están configurados" });
  const { endpoint } = await jsonBody<{ endpoint?: unknown }>(c);
  if (!validPushEndpoint(endpoint)) bad("Suscripción no válida");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id) VALUES (?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id`,
    ).bind(endpoint, user.id),
    // Como mucho 5 dispositivos por persona: se quedan los más recientes.
    c.env.DB.prepare(
      `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
         (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT 5)`,
    ).bind(user.id),
  ]);
  return c.json({ ok: true }, 201);
});

/** Desactivar los avisos en este dispositivo. */
app.post("/push/unsubscribe", async (c) => {
  const user = requireUser(c);
  const { endpoint } = await jsonBody<{ endpoint?: unknown }>(c);
  if (typeof endpoint !== "string") bad("Suscripción no válida");
  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`).bind(endpoint, user.id).run();
  return c.json({ ok: true });
});

/** El último aviso: lo pide el service worker al recibir un push (que llega sin contenido). */
app.get("/push/latest", async (c) => {
  const note = await c.env.DB.prepare(
    `SELECT title, body, url FROM notifications WHERE created_at > datetime('now', '-1 day') ORDER BY id DESC LIMIT 1`,
  ).first<ClubNotification>();
  return c.json(note ?? null);
});

// ---------- Administración de miembros ----------

const ROLES = new Set(["member", "admin"]);

function emailParam(c: Ctx) {
  const email = decodeURIComponent(c.req.param("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad("Email no válido");
  return email;
}

app.get("/admin/members", async (c) => {
  requireAdmin(c);
  const [members, requests] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT m.email, m.role, m.created_at, u.id AS user_id, u.name, u.picture, u.last_login_at
       FROM members m LEFT JOIN users u ON u.email = m.email
       ORDER BY m.role = 'admin' DESC, COALESCE(u.name, m.email) COLLATE NOCASE`,
    ),
    c.env.DB.prepare(`SELECT email, name, picture, requested_at FROM access_requests ORDER BY requested_at DESC`),
  ]);
  return c.json({
    members: (members.results as unknown as Member[]).map((m) => ({ ...m, protected: isProtectedAdmin(c.env, m.email) })),
    requests: requests.results as unknown as AccessRequest[],
  });
});

app.post("/admin/members", async (c) => {
  const admin = requireAdmin(c);
  const body = await jsonBody<{ email?: string; role?: string }>(c);
  const email = text(body.email, "email", 200)!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad("Email no válido");
  const role = body.role ?? "member";
  if (!ROLES.has(role)) bad("Rol no válido");
  const exists = await c.env.DB.prepare(`SELECT 1 FROM members WHERE email = ?`).bind(email).first();
  if (exists) bad("Ese email ya es miembro");
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO members (email, role, added_by) VALUES (?, ?, ?)`).bind(email, role, admin.id),
    c.env.DB.prepare(`DELETE FROM access_requests WHERE email = ?`).bind(email),
  ]);
  return c.json({ ok: true }, 201);
});

app.patch("/admin/members/:email", async (c) => {
  const admin = requireAdmin(c);
  const email = emailParam(c);
  const { role } = await jsonBody<{ role?: string }>(c);
  if (!role || !ROLES.has(role)) bad("Rol no válido");
  if (email === admin.email.toLowerCase() && role !== "admin") bad("No puedes quitarte el rol de admin a ti mismo");
  if (isProtectedAdmin(c.env, email) && role !== "admin") bad("Es admin de emergencia (ADMIN_EMAILS): cámbialo en Cloudflare");
  const res = await c.env.DB.prepare(`UPDATE members SET role = ? WHERE email = ?`).bind(role, email).run();
  if (!res.meta.changes) throw new HTTPException(404, { message: "Miembro no encontrado" });
  return c.json({ ok: true });
});

/** Quitar a un miembro: pierde el acceso al momento. Sus comentarios y notas se conservan. */
app.delete("/admin/members/:email", async (c) => {
  const admin = requireAdmin(c);
  const email = emailParam(c);
  if (email === admin.email.toLowerCase()) bad("No puedes quitarte a ti mismo");
  if (isProtectedAdmin(c.env, email)) bad("Es admin de emergencia (ADMIN_EMAILS): quítalo en Cloudflare");
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM members WHERE email = ?`).bind(email),
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)`).bind(email),
  ]);
  return c.json({ ok: true });
});

app.post("/admin/requests/:email/approve", async (c) => {
  const admin = requireAdmin(c);
  const email = emailParam(c);
  const req = await c.env.DB.prepare(`SELECT 1 FROM access_requests WHERE email = ?`).bind(email).first();
  if (!req) throw new HTTPException(404, { message: "Solicitud no encontrada" });
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT OR IGNORE INTO members (email, role, added_by) VALUES (?, 'member', ?)`).bind(email, admin.id),
    c.env.DB.prepare(`DELETE FROM access_requests WHERE email = ?`).bind(email),
  ]);
  return c.json({ ok: true });
});

app.delete("/admin/requests/:email", async (c) => {
  requireAdmin(c);
  await c.env.DB.prepare(`DELETE FROM access_requests WHERE email = ?`).bind(emailParam(c)).run();
  return c.json({ ok: true });
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
