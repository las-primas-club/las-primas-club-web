// Integración con el Jellyfin del club:
// - Buscar una película para enlazarla desde su ficha. Se empareja por el id de TMDB (Jellyfin lo guarda en
//   ProviderIds.Tmdb); si no, por título y año.
// - Cuentas: crear el usuario de Jellyfin de cada miembro (solo ve las bibliotecas de películas), desactivarlo
//   si deja el club y dejarle entrar sin contraseña aprobando su código de Quick Connect.

interface JellyfinItem {
  Id: string;
  Name: string;
  OriginalTitle?: string;
  ProductionYear?: number;
  ServerId?: string;
  ProviderIds?: Record<string, string>;
}

export function jellyfinEnabled(env: Env) {
  return Boolean(env.JELLYFIN_URL && env.JELLYFIN_API_KEY);
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Llamada a la API de Jellyfin con la clave del servidor (admin). */
async function jf(env: Env, path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
  const url = new URL(path, env.JELLYFIN_URL);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  return fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `MediaBrowser Client="Las Primas Club", Device="Worker", DeviceId="las-primas-club", Version="1", Token="${env.JELLYFIN_API_KEY}"`,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function jfJson<T>(env: Env, path: string, init?: Parameters<typeof jf>[2]): Promise<T> {
  const res = await jf(env, path, init);
  if (!res.ok) throw new JellyfinError(`Jellyfin respondió ${res.status} en ${path}`, res.status, await res.text().catch(() => ""));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export class JellyfinError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail = "",
  ) {
    super(message);
  }
}

async function items(env: Env, params: Record<string, string>): Promise<JellyfinItem[]> {
  const data = await jfJson<{ Items?: JellyfinItem[] }>(env, "/Items", {
    query: {
      Recursive: "true",
      IncludeItemTypes: "Movie",
      Fields: "ProviderIds,OriginalTitle",
      EnableImages: "false",
      EnableUserData: "false",
      Limit: "50",
      ...params,
    },
  });
  return data.Items ?? [];
}

/** Enlace a la película en Jellyfin, o null si no está en la biblioteca. */
export async function findInJellyfin(
  env: Env,
  movie: { title: string; year: string | null; tmdbId: number | null },
): Promise<string | null> {
  const byTmdb = (list: JellyfinItem[]) =>
    movie.tmdbId ? list.find((i) => i.ProviderIds?.Tmdb === String(movie.tmdbId)) : undefined;
  const byTitle = (list: JellyfinItem[]) => {
    const t = normalize(movie.title);
    return list.find(
      (i) =>
        (normalize(i.Name) === t || (i.OriginalTitle && normalize(i.OriginalTitle) === t)) &&
        (!movie.year || !i.ProductionYear || Math.abs(i.ProductionYear - Number(movie.year)) <= 1),
    );
  };

  // 1) Buscando por título (rápido y suele bastar).
  const found = await items(env, { SearchTerm: movie.title });
  let match = byTmdb(found) ?? byTitle(found);
  // 2) Si en Jellyfin tiene otro título (original, en inglés…), las de ese año y su id de TMDB.
  if (!match && movie.year && movie.tmdbId) {
    const y = Number(movie.year);
    match = byTmdb(await items(env, { Years: `${y - 1},${y},${y + 1}`, Limit: "500" }));
  }
  if (!match) return null;
  const base = env.JELLYFIN_URL.replace(/\/+$/, "");
  return `${base}/web/#/details?id=${match.Id}${match.ServerId ? `&serverId=${match.ServerId}` : ""}`;
}

// ---------- Cuentas ----------

export interface JellyfinUser {
  Id: string;
  Name: string;
  Policy?: JellyfinPolicy;
}
type JellyfinPolicy = Record<string, unknown> & { IsAdministrator?: boolean; IsDisabled?: boolean };

export function listUsers(env: Env) {
  return jfJson<JellyfinUser[]>(env, "/Users");
}

export async function quickConnectEnabled(env: Env) {
  const res = await jf(env, "/QuickConnect/Enabled");
  return res.ok && (await res.json()) === true;
}

/** Ids de las bibliotecas de películas (las únicas que ven los usuarios creados por la web). */
async function movieLibraryIds(env: Env) {
  const folders = await jfJson<{ ItemId: string; CollectionType?: string }[]>(env, "/Library/VirtualFolders");
  return folders.filter((f) => f.CollectionType === "movies").map((f) => f.ItemId);
}

/** Pone a un usuario creado por la web los permisos del club: activo, sin admin y solo con las películas. */
export async function applyClubPolicy(env: Env, userId: string) {
  const [user, libraries] = await Promise.all([jfJson<JellyfinUser>(env, `/Users/${userId}`), movieLibraryIds(env)]);
  if (user.Policy?.IsAdministrator) return; // nunca tocamos a un admin del servidor
  const policy: JellyfinPolicy = {
    ...user.Policy,
    IsAdministrator: false,
    IsDisabled: false,
    EnableAllFolders: false,
    EnabledFolders: libraries,
    EnableAllChannels: false,
    EnabledChannels: [],
    EnableLiveTvAccess: false,
    EnableLiveTvManagement: false,
    EnableContentDeletion: false,
    EnableContentDeletionFromFolders: [],
    EnableRemoteAccess: true,
  };
  const res = await jf(env, `/Users/${userId}/Policy`, { method: "POST", body: policy });
  if (!res.ok) throw new JellyfinError(`No se pudieron poner los permisos (${res.status})`, res.status, await res.text().catch(() => ""));
}

/** Desactiva a un usuario creado por la web (cuando la persona deja el club). */
export async function disableUser(env: Env, userId: string) {
  const user = await jfJson<JellyfinUser>(env, `/Users/${userId}`);
  if (user.Policy?.IsAdministrator) return;
  await jf(env, `/Users/${userId}/Policy`, { method: "POST", body: { ...user.Policy, IsDisabled: true } });
}

/** Nombre de usuario de Jellyfin a partir del nombre de la persona: sin tildes ni símbolos raros. */
function baseUsername(name: string, email: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ._-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return clean || email.split("@")[0].replace(/[^A-Za-z0-9._-]+/g, "") || "miembro";
}

/** Crea el usuario de Jellyfin de un miembro, con un nombre libre y una contraseña larga aleatoria (entra con Quick Connect). */
export async function createClubUser(env: Env, person: { name: string; email: string }) {
  const taken = new Set((await listUsers(env)).map((u) => u.Name.toLowerCase()));
  const base = baseUsername(person.name, person.email);
  let name = base;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`;
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const password = btoa(String.fromCharCode(...bytes));
  const user = await jfJson<JellyfinUser>(env, "/Users/New", { method: "POST", body: { Name: name, Password: password } });
  await applyClubPolicy(env, user.Id);
  return { id: user.Id, name: user.Name };
}

/** Aprueba el código de Quick Connect que muestra Jellyfin para que esa pantalla entre como este usuario. */
export async function authorizeQuickConnect(env: Env, code: string, userId: string) {
  const res = await jf(env, "/QuickConnect/Authorize", { method: "POST", query: { code, userId } });
  if (res.ok) return;
  const detail = await res.text().catch(() => "");
  throw new JellyfinError(`Quick Connect respondió ${res.status}`, res.status, detail);
}
