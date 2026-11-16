import type { AccessRequest, AppConfig, Book, BookDetail, BookSuggestion, Kind, Member, Role, Round, User } from "../shared/types";

export interface BookInput {
  title: string;
  author: string;
  description?: string | null;
  cover_url?: string | null;
  year?: string | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Error ${res.status}`);
  return data as T;
}

export const api = {
  config: () => request<AppConfig>("GET", "/config"),
  me: () => request<User | null>("GET", "/me"),
  loginGoogle: (credential: string) => request("POST", "/auth/google", { credential }),
  loginDev: (name: string, email: string) => request("POST", "/auth/dev", { name, email }),
  logout: () => request("POST", "/auth/logout"),

  /** kind "all" devuelve libros y películas (panel de admin). */
  books: (status: string | undefined, kind: Kind | "all" = "book") =>
    request<Book[]>("GET", `/books?kind=${kind}${status ? `&status=${status}` : ""}`),
  currentBook: (kind: Kind = "book") => request<BookDetail | null>("GET", `/books/current?kind=${kind}`),
  book: (id: number) => request<BookDetail>("GET", `/books/${id}`),
  proposeBook: (kind: Kind, b: BookInput) => request<{ id: number }>("POST", "/books", { ...b, kind }),
  deleteBook: (id: number) => request("DELETE", `/books/${id}`),
  repropose: (id: number) => request("POST", `/books/${id}/repropose`),
  startBook: (id: number) => request("POST", `/books/${id}/start`),
  finishBook: (id: number) => request("POST", `/books/${id}/finish`),
  rate: (id: number, score: number) => request("PUT", `/books/${id}/rating`, { score }),
  comment: (id: number, body: string) => request("POST", `/books/${id}/comments`, { body }),
  editComment: (id: number, body: string) => request("PATCH", `/comments/${id}`, { body }),
  deleteComment: (id: number) => request("DELETE", `/comments/${id}`),
  unrate: (id: number) => request("DELETE", `/books/${id}/rating`),

  epubUrl: (id: number) => `/api/books/${id}/epub`,
  uploadEpub: (id: number, file: File) =>
    fetch(`/api/books/${id}/epub`, {
      method: "PUT",
      headers: { "Content-Type": "application/epub+zip", "X-Filename": encodeURIComponent(file.name) },
      body: file,
      credentials: "same-origin",
    }).then((r) => parse(r)),
  deleteEpub: (id: number) => request("DELETE", `/books/${id}/epub`),
  saveKindleEmail: (email: string | null) => request("PUT", "/me/kindle", { email }),
  sendToKindle: (id: number) => request<{ ok: true; to: string }>("POST", `/books/${id}/kindle`),

  searchBooks: (kind: Kind, q: string, signal?: AbortSignal) =>
    fetch(`/api/search?kind=${kind}&q=${encodeURIComponent(q)}`, { signal, credentials: "same-origin" }).then(async (r) => {
      if (!r.ok) throw new Error("No se pudo buscar");
      return (await r.json()) as BookSuggestion[];
    }),

  bookDescription: (key: string) =>
    request<{ description: string }>("GET", `/search/description?key=${encodeURIComponent(key)}`).then((r) => r.description),
  editBook: (id: number, b: BookInput) => request("PATCH", `/books/${id}`, b),
  cancelRound: (roundId: number) => request("DELETE", `/rounds/${roundId}`),

  admin: {
    members: () => request<{ members: Member[]; requests: AccessRequest[] }>("GET", "/admin/members"),
    addMember: (email: string, role: Role) => request("POST", "/admin/members", { email, role }),
    setRole: (email: string, role: Role) => request("PATCH", `/admin/members/${encodeURIComponent(email)}`, { role }),
    removeMember: (email: string) => request("DELETE", `/admin/members/${encodeURIComponent(email)}`),
    approve: (email: string) => request("POST", `/admin/requests/${encodeURIComponent(email)}/approve`),
    reject: (email: string) => request("DELETE", `/admin/requests/${encodeURIComponent(email)}`),
  },

  currentRound: (kind: Kind = "book") => request<Round | null>("GET", `/rounds/current?kind=${kind}`),
  openRound: (kind: Kind = "book") => request("POST", "/rounds", { kind }),
  rounds: (kind: Kind) => request<Round[]>("GET", `/rounds?kind=${kind}`),
  /** Mis votos de la ronda (hasta MAX_VOTES ids, repetidos si van al mismo). */
  setVotes: (roundId: number, bookIds: number[]) => request("PUT", `/rounds/${roundId}/votes`, { bookIds }),
  closeRound: (roundId: number) => request<{ winnerId: number }>("POST", `/rounds/${roundId}/close`),
};
