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
