// Buscar una película en el Jellyfin del club para enlazarla desde su ficha.
// Se empareja por el id de TMDB (Jellyfin lo guarda en ProviderIds.Tmdb); si no, por título y año.

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

async function items(env: Env, params: Record<string, string>): Promise<JellyfinItem[]> {
  const url = new URL("/Items", env.JELLYFIN_URL);
  const query = {
    Recursive: "true",
    IncludeItemTypes: "Movie",
    Fields: "ProviderIds,OriginalTitle",
    EnableImages: "false",
    EnableUserData: "false",
    Limit: "50",
    ...params,
  };
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `MediaBrowser Client="Las Primas Club", Device="Worker", DeviceId="las-primas-club", Version="1", Token="${env.JELLYFIN_API_KEY}"`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Jellyfin respondió ${res.status}`);
  return ((await res.json()) as { Items?: JellyfinItem[] }).Items ?? [];
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
