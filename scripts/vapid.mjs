// Genera un par de claves VAPID para los avisos push. Uso: npm run vapid
import { webcrypto as crypto } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const pub = await crypto.subtle.exportKey("raw", pair.publicKey);
const priv = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`Guárdalas como secretos del Worker (no las subas a git):

  npx wrangler secret put VAPID_PUBLIC_KEY     → ${b64url(pub)}
  npx wrangler secret put VAPID_PRIVATE_KEY    → ${priv.d}

Para probar en local, ponlas también en .dev.vars.
Si las cambias más adelante, todo el mundo tendrá que volver a activar los avisos.`);
