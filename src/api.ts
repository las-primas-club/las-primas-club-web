import type { AppConfig, Book, BookDetail, Round, User } from "../shared/types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
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

  books: (status?: string) => request<Book[]>("GET", `/books${status ? `?status=${status}` : ""}`),
  currentBook: () => request<BookDetail | null>("GET", "/books/current"),
  book: (id: number) => request<BookDetail>("GET", `/books/${id}`),
  proposeBook: (b: { title: string; author: string; description?: string; cover_url?: string }) =>
    request<{ id: number }>("POST", "/books", b),
  deleteBook: (id: number) => request("DELETE", `/books/${id}`),
  startBook: (id: number) => request("POST", `/books/${id}/start`),
  finishBook: (id: number) => request("POST", `/books/${id}/finish`),
  rate: (id: number, score: number) => request("PUT", `/books/${id}/rating`, { score }),
  comment: (id: number, body: string) => request("POST", `/books/${id}/comments`, { body }),
  deleteComment: (id: number) => request("DELETE", `/comments/${id}`),

  currentRound: () => request<Round | null>("GET", "/rounds/current"),
  openRound: () => request("POST", "/rounds"),
  vote: (roundId: number, bookId: number) => request("POST", `/rounds/${roundId}/vote`, { bookId }),
  closeRound: (roundId: number) => request<{ winnerId: number }>("POST", `/rounds/${roundId}/close`),
};
