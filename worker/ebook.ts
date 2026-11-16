// Epubs (guardados en Workers KV) y envío al Kindle por email con Resend.
//
// Para no gastar CPU del Worker (10 ms en el plan gratuito) no codificamos el epub en base64:
// le pasamos a Resend un enlace temporal (/api/kindle-file/<token>) y Resend lo descarga él mismo.

/** KV admite valores de hasta 25 MiB; Resend, emails de hasta 40 MB en base64 (≈ 30 MB de archivo). */
export const MAX_EPUB_BYTES = 25 * 1024 * 1024;

/** Direcciones de "Enviar a Kindle": nombre@kindle.com (también free.kindle.com y kindle.cn). */
export const KINDLE_ADDRESS = /^[^\s@]+@(free\.)?kindle\.(com|cn)$/i;

export const epubKey = (bookId: number) => `epub:${bookId}`;

export function kindleEnabled(env: Env) {
  return Boolean(env.RESEND_API_KEY && env.KINDLE_FROM);
}

/** Un epub es un zip: empieza por "PK\x03\x04". */
export function looksLikeEpub(head: Uint8Array) {
  return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/** Nombre de archivo limpio que siempre termina en .epub. */
export function epubFileName(name: string | null | undefined, fallback: string) {
  const base = (name ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\.epub$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
  return `${base || fallback}.epub`;
}

/** Cabecera de descarga que funciona con tildes y eñes. */
export function contentDisposition(filename: string) {
  const ascii = filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "libro.epub";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export class KindleSendError extends Error {
  constructor(
    message: string,
    readonly status: 429 | 502,
  ) {
    super(message);
  }
}

export async function sendToKindle(
  env: Env,
  opts: { to: string; fileUrl: string; filename: string; title: string; author: string; senderName: string },
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.KINDLE_FROM,
      to: [opts.to],
      subject: opts.title,
      text: `${opts.title}, de ${opts.author}.\n\nEnviado desde Las Primas Club a petición de ${opts.senderName}. ¡Feliz lectura!`,
      attachments: [{ path: opts.fileUrl, filename: opts.filename, content_type: "application/epub+zip" }],
    }),
  });
  if (res.ok) return;
  const detail = await res.text().catch(() => "");
  console.error("Resend rechazó el envío", res.status, detail);
  if (res.status === 429) {
    throw new KindleSendError("Hoy ya se han enviado demasiados libros desde el club. Prueba mañana.", 429);
  }
  throw new KindleSendError("No se pudo enviar el libro ahora mismo. Inténtalo más tarde.", 502);
}
