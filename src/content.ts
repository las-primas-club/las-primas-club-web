// Textos de la web. Edítalos libremente.

export const CLUB_NAME = "Las Primas Club";

/** Redes del club en el pie de página. Para añadir una: { name, url, icon } (iconos en components/Icons.tsx). */
export const SOCIAL = [
  { name: "GitHub", url: "https://github.com/las-primas-club/las-primas-club-web", icon: "github" },
] as const;

export const ANNOUNCEMENT = "¡Gracias por leer (y ver pelis) con Las Primas Club! 📚🎬";

export const INTRO = {
  tagline: "Un club de lectura y cine entre amigos, libros y sobremesas largas.",
  paragraphs: [
    "Somos un grupo de amigos que leemos un libro cada vez y quedamos para comentarlo. En cada ronda cualquiera puede proponer un título y entre todos votamos el siguiente.",
    "Aquí tienes el libro que estamos leyendo, la película que toca ver, las votaciones abiertas y todo lo que ya hemos leído y visto, con nuestras puntuaciones y comentarios.",
  ],
  howItWorks: [
    { title: "Proponemos", text: "Cualquiera sugiere libros o películas para la siguiente ronda." },
    { title: "Votamos", text: "Un voto por persona y gana el más votado." },
    { title: "Leemos, vemos y comentamos", text: "Puntúa y deja tus impresiones." },
  ],
};
