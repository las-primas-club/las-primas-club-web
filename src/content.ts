// Textos de la web. Edítalos libremente.
import type { Settings } from "../shared/types";

export const CLUB_NAME = "Las Primas Club";

/** Redes del club en el pie de página. Para añadir una: { name, url, icon } (iconos en components/Icons.tsx). */
export const SOCIAL = [
  { name: "GitHub", url: "https://github.com/las-primas-club/las-primas-club-web", icon: "github" },
] as const;

export const ANNOUNCEMENT = "¡Gracias por leer (y ver pelis) con Las Primas Club!";

export const INTRO = {
  tagline: "Libros, películas y sobremesas largas.",
  about: "Un grupo de amigos que elige juntos qué leer y qué ver, y lo comenta comiendo fuera.",
};

const NUMBERS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
/** 2 → "dos" (femenino en el uno: "una propuesta"). */
const word = (n: number) => NUMBERS[n] ?? String(n);

/** Los pasos de "Cómo funciona", redactados según las normas actuales del club. */
export function howItWorks(s: Settings) {
  const proposals =
    s.maxProposals === 1
      ? "Cada uno puede tener una propuesta de libro y una de película."
      : `Cada uno puede tener hasta ${word(s.maxProposals)} propuestas de libros y ${word(s.maxProposals)} de películas.`;
  const votes =
    s.maxVotes === 1
      ? "En cada ronda tienes un voto"
      : `En cada ronda tienes ${word(s.maxVotes).replace(/^una$/, "un")} votos: repártelos${s.stackVotes ? " o dale varios al mismo" : " entre candidatos distintos"}`;
  return [
    { title: "Proponemos", text: `${proposals} Buscas el título y se rellena solo.` },
    {
      title: "Votamos",
      text: `${votes}${s.voteOwn ? "" : " (a lo tuyo no vale)"}. Son anónimos hasta que se cierra; luego se ve qué votó cada uno.`,
    },
    {
      title: "Gana el más votado",
      text: "Al cerrar la ronda, el ganador pasa a ser el libro o la película del momento. El resto queda en el histórico de rondas, por si alguien lo quiere rescatar.",
    },
    {
      title: "Quedamos a comer",
      text: "Leemos o vemos lo elegido y lo comentamos alrededor de una mesa, que es lo que mejor se nos da.",
    },
    {
      title: "Puntuamos",
      text: "Cada uno deja aquí su nota y sus comentarios, y todo queda guardado en el historial del club.",
    },
  ];
}
