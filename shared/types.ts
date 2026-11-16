// Tipos compartidos entre la web (src/) y la API (worker/)

export type BookStatus = "proposed" | "current" | "read";

/** Libros y películas comparten modelo. En una película, author es la dirección y "read" significa vista. */
export type Kind = "book" | "movie";

export interface User {
  id: number;
  name: string;
  email: string;
  picture: string | null;
  isAdmin: boolean;
  /** Dirección "Enviar a Kindle" (solo la ve su dueño). */
  kindle_email: string | null;
}

export interface Book {
  id: number;
  kind: Kind;
  title: string;
  author: string;
  cover_url: string | null;
  description: string | null;
  year: string | null;
  status: BookStatus;
  proposed_by: number | null;
  proposed_by_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  avg_rating: number | null;
  rating_count: number;
  /** Nombre y tamaño (bytes) del epub subido por un admin, si lo hay. */
  epub_name: string | null;
  epub_size: number | null;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  user_id: number;
  user_name: string;
  user_picture: string | null;
}

export interface Rating {
  user_name: string;
  score: number;
}

export interface BookDetail extends Book {
  my_rating: number | null;
  ratings: Rating[];
  comments: Comment[];
}

export interface Candidate {
  book: Book;
  votes: number;
}

export interface Round {
  id: number;
  kind: Kind;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  winner_book_id: number | null;
  candidates: Candidate[];
  my_vote: number | null;
  voters: number;
}

export interface AppConfig {
  googleClientId: string;
  devLogin: boolean;
  /** Remitente de los envíos al Kindle, o null si el envío no está configurado. */
  kindleFrom: string | null;
  /** Hay clave de TMDB: al proponer películas se buscan y rellenan solas. */
  movieSearch: boolean;
}

export interface BookSuggestion {
  key: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  year: string;
}

export type Role = "member" | "admin";

export interface Member {
  email: string;
  role: Role;
  created_at: string;
  user_id: number | null;
  name: string | null;
  picture: string | null;
  last_login_at: string | null;
  /** Admin de emergencia definido en ADMIN_EMAILS: no se puede quitar desde la web. */
  protected: boolean;
}

export interface AccessRequest {
  email: string;
  name: string;
  picture: string | null;
  requested_at: string;
}
