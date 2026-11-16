// Búsqueda de libros en servicios gratuitos.
// - Google Books (mejores datos en español): necesita GOOGLE_BOOKS_API_KEY; sin clave la cuota compartida suele estar agotada.
// - Open Library: sin clave, se usa como respaldo.
import type { BookSuggestion } from "../shared/types";

const MAX_DESCRIPTION = 2000;
const CACHE = { cacheTtl: 86400, cacheEverything: true }; // 1 día en la caché de Cloudflare

function clean(text: string | undefined) {
  if (!text) return "";
  const plain = text
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain.length > MAX_DESCRIPTION ? `${plain.slice(0, MAX_DESCRIPTION - 1)}…` : plain;
}

interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

async function searchGoogle(query: string, key: string): Promise<BookSuggestion[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("printType", "books");
  url.searchParams.set("key", key);
  const res = await fetch(url, { cf: CACHE });
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = (await res.json()) as { items?: GoogleVolume[] };
  return (data.items ?? [])
    .filter((v) => v.volumeInfo.title)
    .map(({ id, volumeInfo: v }) => {
      const thumb = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "";
      return {
        key: `g:${id}`,
        title: v.title!,
        author: (v.authors ?? []).join(", "),
        description: clean(v.description),
        cover_url: thumb.replace(/^http:/, "https:").replace("&edge=curl", ""),
        year: v.publishedDate?.slice(0, 4) ?? "",
      };
    });
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  editions?: { docs?: { key: string }[] };
}

const OL_HEADERS = { "User-Agent": "LasPrimasClub/1.0 (book club site)" };

async function searchOpenLibrary(query: string): Promise<BookSuggestion[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "key,title,author_name,cover_i,first_publish_year,editions,editions.key");
  const res = await fetch(url, { cf: CACHE, headers: OL_HEADERS });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map((d) => ({
    // La búsqueda no trae sinopsis: la clave lleva la obra y la edición que mejor encaja para pedirla luego.
    key: `ol:${d.key}${d.editions?.docs?.[0]?.key ? `|${d.editions.docs[0].key}` : ""}`,
    title: d.title,
    author: (d.author_name ?? []).slice(0, 3).join(", "),
    description: "",
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : "",
    year: d.first_publish_year ? String(d.first_publish_year) : "",
  }));
}

export async function searchBooks(query: string, googleKey: string | undefined): Promise<BookSuggestion[]> {
  if (googleKey) {
    try {
      const results = await searchGoogle(query, googleKey);
      if (results.length > 0) return results;
    } catch (e) {
      console.warn("Google Books falló, uso Open Library", e);
    }
  }
  return searchOpenLibrary(query);
}

// ---------- Sinopsis de un resultado ----------

/** Open Library guarda la sinopsis como texto o como { value }, a veces con enlaces de fuente al final. */
function openLibraryText(value: unknown): string {
  const raw = typeof value === "string" ? value : (value as { value?: string } | undefined)?.value ?? "";
  const body = raw
    .split(/\n-{3,}\n|\(\[source\]|\[source\]/i)[0]
    .replace(/^\s*\[\d+\]:.*$/gm, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/(\*\*|\*|__|_)(\S(?:.*?\S)?)\1/g, "$2"); // *cursiva* y **negrita** de Markdown
  return clean(body);
}

async function openLibraryDescription(path: string): Promise<string> {
  if (!/^\/(works|books)\/OL\d+[WM]$/.test(path)) return "";
  const res = await fetch(`https://openlibrary.org${path}.json`, { cf: CACHE, headers: OL_HEADERS });
  if (!res.ok) return "";
  return openLibraryText(((await res.json()) as { description?: unknown }).description);
}

/** Sinopsis de un resultado de búsqueda de Open Library: la de la obra o, si no tiene, la de la edición. */
export async function bookDescription(key: string): Promise<string> {
  if (!key.startsWith("ol:")) return "";
  const [work, edition] = key.slice(3).split("|");
  return (await openLibraryDescription(work)) || (edition ? await openLibraryDescription(edition) : "");
}
