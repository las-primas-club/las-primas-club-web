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
  /** Propuesta que perdió una votación: ya no está pendiente, pero se puede volver a proponer. */
  archived_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  avg_rating: number | null;
  rating_count: number;
  /** Nombre y tamaño (bytes) del epub subido por un admin, si lo hay. */
  epub_name: string | null;
  epub_size: number | null;
  /** Quedada para comentarlo: "YYYY-MM-DDTHH:MM" (hora local) y sitio. */
  meet_at: string | null;
  meet_place: string | null;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  /** Fecha de la última edición, si se editó. */
  edited_at: string | null;
  user_id: number;
  user_name: string;
  user_picture: string | null;
  /** Sale tapado hasta que se toca. */
  spoiler: boolean;
}

/** Respuesta de alguien a la quedada. */
export interface Rsvp {
  user_id: number;
  name: string;
  going: boolean;
}

/** Por dónde va alguien: porcentaje leído (película: 100 = vista). */
export interface Progress {
  user_id: number;
  name: string;
  percent: number;
}

export interface WatchProvider {
  name: string;
  logo: string;
}
/** Dónde ver una película en España (JustWatch vía TMDB). */
export interface WatchInfo {
  link: string;
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

export interface ClubNotification {
  title: string;
  body: string;
  url: string;
}

export interface StatsItem {
  id: number;
  kind: Kind;
  title: string;
  avg_rating: number;
  rating_count: number;
}
export interface StatsMember {
  name: string;
  /** Propuestas suyas que han salido elegidas. */
  wins: number;
  ratings: number;
  avg_given: number | null;
  comments: number;
}
export interface Stats {
  /** Terminados por año y tipo. */
  years: { year: string; books: number; movies: number }[];
  totals: { books: number; movies: number; ratings: number; comments: number; rounds: number };
  best: StatsItem[];
  worst: StatsItem[];
  members: StatsMember[];
}

export interface Rating {
  user_name: string;
  score: number;
}

export interface BookDetail extends Book {
  my_rating: number | null;
  ratings: Rating[];
  comments: Comment[];
  rsvps: Rsvp[];
  progress: Progress[];
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
  /** Fecha límite para votar ("YYYY-MM-DDTHH:MM", hora local), si el admin la ha puesto. */
  closes_at: string | null;
  /** Mientras está abierta: nombres de quienes aún no han votado (no se ve qué vota nadie). */
  pending_voters: string[] | null;
  winner_book_id: number | null;
  candidates: Candidate[];
  /** Mis votos en esta ronda (un id por voto; repetido si di varios al mismo). */
  my_votes: number[];
  /** Personas que han votado. */
  voters: number;
  total_votes: number;
  /** Cómo votó cada uno. Solo cuando la ronda está cerrada: mientras está abierta, los votos son anónimos. */
  ballots: Ballot[] | null;
}

export interface Ballot {
  user_id: number;
  name: string;
  picture: string | null;
  book_ids: number[];
}

/** Normas del club. Las cambia un admin desde el panel; se aplican a libros y a cine por separado. */
export interface Settings {
  /** Votos por persona en cada ronda. */
  maxVotes: number;
  /** Propuestas pendientes por persona y sección. */
  maxProposals: number;
  /** ¿Se pueden dar varios votos al mismo candidato? */
  stackVotes: boolean;
  /** ¿Se puede votar una propuesta propia? */
  voteOwn: boolean;
  /** Envíos al Kindle por persona y día. */
  kindleSendsPerDay: number;
}

/** Valores por defecto: los que se usan mientras un admin no los cambie. */
export const DEFAULT_SETTINGS: Settings = {
  maxVotes: 2,
  maxProposals: 2,
  stackVotes: true,
  voteOwn: false,
  kindleSendsPerDay: 10,
};

/** Mínimo y máximo de las normas numéricas (el máximo de votos lo marca también la base de datos). */
export const SETTING_LIMITS = {
  maxVotes: [1, 10],
  maxProposals: [1, 10],
  kindleSendsPerDay: [1, 50],
} as const satisfies Partial<Record<keyof Settings, readonly [number, number]>>;

export interface AppConfig {
  googleClientId: string;
  devLogin: boolean;
  /** Remitente de los envíos al Kindle, o null si el envío no está configurado. */
  kindleFrom: string | null;
  /** Hay clave de TMDB: al proponer películas se buscan y rellenan solas. */
  movieSearch: boolean;
  /** Clave pública VAPID para los avisos push, o null si no están configurados. */
  pushKey: string | null;
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
