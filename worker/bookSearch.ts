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
}

async function searchOpenLibrary(query: string): Promise<BookSuggestion[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "key,title,author_name,cover_i,first_publish_year");
  const res = await fetch(url, { cf: CACHE, headers: { "User-Agent": "LasPrimasClub/1.0 (book club site)" } });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map((d) => ({
    key: `ol:${d.key}`,
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
