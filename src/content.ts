// Textos de la web. Edítalos libremente.

export const CLUB_NAME = "Las Primas Club";

/** Redes del club en el pie de página. Para añadir una: { name, url, icon } (iconos en components/Icons.tsx). */
export const SOCIAL = [
  { name: "GitHub", url: "https://github.com/las-primas-club/las-primas-club-web", icon: "github" },
] as const;

export const ANNOUNCEMENT = "¡Gracias por leer (y ver pelis) con Las Primas Club! 📚🎬";

export const INTRO = {
  tagline: "Libros, películas y sobremesas largas.",
  about:
    "Somos un grupo de amigos a los que nos encanta comer fuera y hablar de libros y cine. Elegimos juntos qué leer y qué ver, y lo comentamos en la sobremesa.",
  howItWorks: [
    {
      emoji: "💡",
      title: "Proponemos",
      text: "Cada uno puede tener hasta dos propuestas de libros y dos de películas. Buscas el título y se rellena solo.",
    },
    {
      emoji: "🗳️",
      title: "Votamos",
      text: "En cada ronda tienes dos votos: repártelos o dale los dos al mismo. Son anónimos hasta que se cierra; luego se ve qué votó cada uno.",
    },
    {
      emoji: "🏆",
      title: "Gana el más votado",
      text: "Al cerrar la ronda, el ganador pasa a ser el libro o la película del momento. El resto queda en el histórico de rondas, por si alguien lo quiere rescatar.",
    },
    {
      emoji: "🍽️",
      title: "Quedamos a comer",
      text: "Leemos o vemos lo elegido y lo comentamos alrededor de una mesa, que es lo que mejor se nos da.",
    },
    {
      emoji: "⭐",
      title: "Puntuamos",
      text: "Cada uno deja aquí su nota y sus comentarios, y todo queda guardado en el historial del club.",
    },
  ],
};
