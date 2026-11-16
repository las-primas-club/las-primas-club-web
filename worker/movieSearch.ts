// Búsqueda de películas en TMDB (The Movie Database), gratis para uso no comercial.
// Necesita TMDB_API_KEY: vale tanto la "API Key" corta como el "API Read Access Token" largo.
import type { BookSuggestion } from "../shared/types";

const CACHE = { cacheTtl: 86400, cacheEverything: true }; // 1 día en la caché de Cloudflare
const MAX_DESCRIPTION = 2000;
const WITH_DIRECTOR = 6; // a los primeros resultados les buscamos la dirección (una petición más cada uno)

interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  popularity?: number;
}

function tmdb(path: string, key: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "es-ES");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // El token largo (JWT) va en la cabecera; la clave corta, como parámetro.
  const bearer = key.length > 40;
  if (!bearer) url.searchParams.set("api_key", key);
  return fetch(url, { cf: CACHE, headers: bearer ? { Authorization: `Bearer ${key}` } : {} });
}

async function directors(id: number, key: string): Promise<string> {
  try {
    const res = await tmdb(`/movie/${id}/credits`, key);
    if (!res.ok) return "";
    const data = (await res.json()) as { crew?: { job: string; name: string }[] };
    return (data.crew ?? [])
      .filter((c) => c.job === "Director")
      .map((c) => c.name)
      .slice(0, 3)
      .join(", ");
  } catch {
    return "";
  }
}

export async function searchMovies(query: string, key: string): Promise<BookSuggestion[]> {
  const res = await tmdb("/search/movie", key, { query, include_adult: "false", page: "1" });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = (await res.json()) as { results?: TmdbMovie[] };
  const movies = (data.results ?? []).slice(0, 8);
  const names = await Promise.all(movies.map((m, i) => (i < WITH_DIRECTOR ? directors(m.id, key) : "")));
  return movies.map((m, i) => {
    const overview = (m.overview ?? "").trim();
    return {
      key: `tmdb:${m.id}`,
      title: m.title || m.original_title || "",
      author: names[i],
      description: overview.length > MAX_DESCRIPTION ? `${overview.slice(0, MAX_DESCRIPTION - 1)}…` : overview,
      cover_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
      year: m.release_date?.slice(0, 4) ?? "",
    };
  });
}

export interface WatchProvider {
  name: string;
  logo: string;
}
export interface WatchInfo {
  /** Página de TMDB/JustWatch con los enlaces a cada plataforma. */
  link: string;
  /** Incluida en la suscripción, alquiler y compra (España). */
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

/** Busca el id de TMDB de una película por título (y año, si lo hay). */
export async function findMovieId(title: string, year: string | null, key: string): Promise<number | null> {
  const res = await tmdb("/search/movie", key, { query: title, include_adult: "false", ...(year ? { year } : {}) });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: TmdbMovie[] };
  return data.results?.[0]?.id ?? null;
}

/** En qué plataformas se puede ver en España (datos de JustWatch a través de TMDB). */
export async function watchProviders(id: number, key: string): Promise<WatchInfo | null> {
  const res = await tmdb(`/movie/${id}/watch/providers`, key);
  if (!res.ok) return null;
  type Raw = { provider_name: string; logo_path?: string | null };
  const data = (await res.json()) as { results?: Record<string, { link?: string; flatrate?: Raw[]; rent?: Raw[]; buy?: Raw[] }> };
  const es = data.results?.ES;
  const list = (items?: Raw[]) =>
    (items ?? []).slice(0, 8).map((p) => ({ name: p.provider_name, logo: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : "" }));
  return {
    link: es?.link ?? `https://www.themoviedb.org/movie/${id}/watch?locale=ES`,
    flatrate: list(es?.flatrate),
    rent: list(es?.rent),
    buy: list(es?.buy),
  };
}
