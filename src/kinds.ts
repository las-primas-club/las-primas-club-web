// Textos y rutas de cada sección. Libros y películas comparten páginas; solo cambia esto.
import type { Kind } from "../shared/types";

export interface KindInfo {
  kind: Kind;
  section: string; // nombre de la sección en la navegación
  /** "el libro" / "la película" */
  the: string;
  noun: string;
  nounPlural: string;
  /** Persona que lo creó: "Autor/a" / "Dirección" */
  creatorLabel: string;
  /** Antes del nombre: "De " Gabriel García Márquez / "Dirigida por " Denis Villeneuve */
  byPrefix: string;
  /** "propuesto por" / "propuesta por" */
  proposedBy: string;
  nowLabel: string; // pill de "en curso"
  nowShort: string; // pestaña
  doneLabel: string; // pill de terminado
  doneTitle: string; // página del historial
  doneShort: string;
  doneSub: string;
  doneEmpty: string;
  doneAction: string; // botón de admin
  doneConfirm: string;
  startAction: string; // "leer ya" / "ver ya"
  noneCurrent: string;
  voteLead: string;
  proposeTitle: string;
  searchLabel: string;
  searchPlaceholder: string;
  coverLabel: string;
  paths: { now: string; vote: string; rounds: string; done: string; item: (id: number) => string };
}

export const KINDS: Record<Kind, KindInfo> = {
  book: {
    kind: "book",
    section: "Libros",
    the: "el libro",
    noun: "libro",
    nounPlural: "libros",
    creatorLabel: "Autor/a",
    byPrefix: "De ",
    proposedBy: "propuesto por",
    nowLabel: "Leyendo ahora",
    nowShort: "Leyendo",
    doneLabel: "Leído",
    doneTitle: "Libros leídos",
    doneShort: "Leídos",
    doneSub: "Todo lo que hemos leído, con la media de nuestras puntuaciones.",
    doneEmpty: "Todavía no hemos terminado ningún libro.",
    doneAction: "Marcar como terminado",
    doneConfirm: "¿Dar por terminado este libro?",
    startAction: "leer ya",
    noneCurrent: "Ningún libro en curso",
    voteLead: "Elige el próximo libro.",
    proposeTitle: "Proponer un libro",
    searchLabel: "Busca el libro",
    searchPlaceholder: "Título, autor/a o ISBN…",
    coverLabel: "URL de la portada",
    paths: { now: "/actual", vote: "/votacion", rounds: "/votacion/rondas", done: "/leidos", item: (id) => `/libros/${id}` },
  },
  movie: {
    kind: "movie",
    section: "Cine",
    the: "la película",
    noun: "película",
    nounPlural: "películas",
    creatorLabel: "Dirección",
    byPrefix: "Dirigida por ",
    proposedBy: "propuesta por",
    nowLabel: "Toca ver",
    nowShort: "Toca ver",
    doneLabel: "Vista",
    doneTitle: "Películas vistas",
    doneShort: "Vistas",
    doneSub: "Todas las películas que hemos visto, con la media de nuestras puntuaciones.",
    doneEmpty: "Todavía no hemos visto ninguna película.",
    doneAction: "Marcar como vista",
    doneConfirm: "¿Dar por vista esta película?",
    startAction: "ver ya",
    noneCurrent: "Ninguna película elegida",
    voteLead: "Elige la próxima película.",
    proposeTitle: "Proponer una película",
    searchLabel: "Busca la película",
    searchPlaceholder: "Título de la película…",
    coverLabel: "URL del póster",
    paths: { now: "/cine", vote: "/cine/votacion", rounds: "/cine/votacion/rondas", done: "/cine/vistas", item: (id) => `/peliculas/${id}` },
  },
};
