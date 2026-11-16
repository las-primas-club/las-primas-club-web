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
    "Somos un grupo de amigos a los que nos encanta comer fuera y alargar la sobremesa hablando de lo último que hemos leído o visto. Este club es nuestra excusa: elegimos juntos un libro y una película, y luego quedamos a comentarlos.",
  howItWorks: [
    {
      emoji: "💡",
      title: "Proponemos",
      text: "Cualquiera puede proponer libros o películas en su sección. Buscas el título y se rellena solo.",
    },
    {
      emoji: "🗳️",
      title: "Votamos",
      text: "Cuando se abre una ronda, cada uno tiene un voto y puede cambiarlo hasta que se cierre. Libros y cine se votan por separado.",
    },
    {
      emoji: "🏆",
      title: "Gana el más votado",
      text: "Al cerrar la ronda, el ganador pasa a ser el libro o la película del momento. Si hay empate, gana el que se propuso antes.",
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
