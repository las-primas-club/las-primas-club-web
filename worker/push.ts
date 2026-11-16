// Avisos push (Web Push) sin dependencias de pago.
//
// Mandamos el push SIN contenido: así no hay que cifrar nada en el Worker (solo firmar un token VAPID).
// Al recibirlo, el service worker pide el último aviso a /api/push/latest y lo muestra.
import { SignJWT, importJWK } from "jose";

export function pushEnabled(env: Env) {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** Solo aceptamos suscripciones de servicios push conocidos (evita usar el Worker para llamar a URLs arbitrarias). */
const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|windows\.com|microsoft\.com)$/;

export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

function b64urlToBytes(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}
function bytesToB64url(b: Uint8Array) {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Token VAPID (JWT ES256) para un servicio push concreto. La clave pública es el punto P-256 sin comprimir (65 bytes). */
async function vapidToken(env: Env, audience: string, subject: string) {
  const pub = b64urlToBytes(env.VAPID_PUBLIC_KEY!);
  const key = await importJWK(
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      d: env.VAPID_PRIVATE_KEY!,
    },
    "ES256",
  );
  return new SignJWT({}).setProtectedHeader({ alg: "ES256", typ: "JWT" }).setAudience(audience).setSubject(subject).setExpirationTime("12h").sign(key);
}

const MAX_DEVICES = 40; // el plan gratuito permite 50 peticiones salientes por ejecución

/** Guarda el aviso y manda un push a todos los dispositivos suscritos. Pensado para ir dentro de waitUntil. */
export async function notifyAll(env: Env, origin: string, note: { title: string; body: string; url: string }) {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO notifications (title, body, url) VALUES (?, ?, ?)`).bind(note.title, note.body, note.url),
    env.DB.prepare(`DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY id DESC LIMIT 20)`),
  ]);
  if (!pushEnabled(env)) return;
  // Solo a quien sigue siendo miembro.
  const { results } = await env.DB.prepare(
    `SELECT p.endpoint FROM push_subscriptions p JOIN users u ON u.id = p.user_id JOIN members m ON m.email = u.email
     ORDER BY p.created_at DESC LIMIT ?`,
  )
    .bind(MAX_DEVICES)
    .all<{ endpoint: string }>();
  const tokens = new Map<string, Promise<string>>();
  const gone: string[] = [];
  await Promise.all(
    results.map(async ({ endpoint }) => {
      try {
        const audience = new URL(endpoint).origin;
        if (!tokens.has(audience)) tokens.set(audience, vapidToken(env, audience, origin));
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${await tokens.get(audience)}, k=${env.VAPID_PUBLIC_KEY}`,
            TTL: "86400",
            Urgency: "normal",
            "Content-Length": "0",
          },
        });
        // 404/410: ese dispositivo ya no está suscrito.
        if (res.status === 404 || res.status === 410) gone.push(endpoint);
        else if (!res.ok) console.warn("Push rechazado", res.status, await res.text().catch(() => ""));
      } catch (e) {
        console.warn("No se pudo enviar el push", e);
      }
    }),
  );
  if (gone.length) {
    await env.DB.batch(gone.map((e) => env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(e)));
  }
}
