/** Las fechas de D1 vienen como "YYYY-MM-DD HH:MM:SS" en UTC. */
export function parseDate(s: string) {
  return new Date(s.replace(" ", "T") + "Z");
}

export function formatDate(s: string | null) {
  if (!s) return "";
  return parseDate(s).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(s: string) {
  return parseDate(s).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Puntuación con coma decimal: 4 → "4", 3.5 → "3,5". Con fixed, siempre un decimal (medias: "4,0"). */
export function formatScore(n: number, fixed = false) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: fixed ? 1 : 0, maximumFractionDigits: 1 });
}
