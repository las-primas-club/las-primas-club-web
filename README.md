# Las Primas Club

Web del club de lectura: presentación del club, libro en curso, votación del siguiente libro y libros leídos,
con puntuaciones (1–5) y comentarios de cada miembro. Login con Google.

Todo funciona en el **plan gratuito de Cloudflare**:

| Pieza | Servicio | Límite gratuito |
|---|---|---|
| Web (React + Vite) | Workers Static Assets | ficheros estáticos sin límite |
| API (`/api/*`, Hono) | Cloudflare Workers | 100.000 peticiones/día |
| Base de datos (SQLite) | Cloudflare D1 | 5 GB, 5 M lecturas/día |
| Despliegue automático | Workers Builds | minutos de build incluidos en el plan Free |

No hace falta tarjeta de crédito para nada de esto.

## Estructura

```
src/          Web en React (páginas en src/pages, textos editables en src/content.ts)
worker/       API (Cloudflare Worker con Hono) + verificación del login de Google
shared/       Tipos compartidos entre web y API
migrations/   Esquema SQL de D1
```

## Desarrollo local

```bash
npm install
cp .dev.vars.example .dev.vars   # DEV_LOGIN=true permite entrar sin Google en local
npm run db:migrate:local
npm run dev                       # http://localhost:5173
```

Con `DEV_LOGIN=true` aparece el botón **Entrar (dev)** para probar con cualquier email
(`dev@example.com` es admin según `.dev.vars.example`). Ese login solo funciona desde `localhost`.

## Puesta en producción (una sola vez)

### 1. Cuenta de Cloudflare y base de datos

```bash
npx wrangler login
npx wrangler d1 create las-primas-club
```

Copia el `database_id` que devuelve en `wrangler.jsonc`.

### 2. Client ID de Google (gratis)

1. Entra en <https://console.cloud.google.com/>, crea un proyecto y ve a
   **APIs y servicios → Pantalla de consentimiento de OAuth** (tipo *Externo*; bastan el nombre de la app y tu email).
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
3. En **Orígenes de JavaScript autorizados** añade:
   - `http://localhost:5173` y `http://localhost` (para desarrollo)
   - la URL de producción: `https://las-primas-club.rdvl.net`
   - Al publicar la app, el logo y los enlaces de dominio son opcionales. Subir un logo obliga a una
     verificación de marca de Google que tarda días; si algún día se quiere, está en `branding/logo-google-120.png`.
4. Copia el *Client ID* (`xxxx.apps.googleusercontent.com`) en `GOOGLE_CLIENT_ID` dentro de `wrangler.jsonc`
   (es público, no es un secreto). Para probar Google en local, ponlo también en `.dev.vars`.

### 3. Quién puede entrar y quién administra

Solo entran los **miembros**, que se gestionan desde la propia web en **Admin → Miembros**:

- Añadir a alguien por su email de Google, como *miembro* o *admin*.
- Si alguien que no es miembro intenta entrar, queda una **solicitud de acceso** que un admin acepta o rechaza.
- Cambiar roles o quitar a alguien (pierde el acceso al momento; sus comentarios se conservan).

Quien ya había entrado antes de la migración `0002_members.sql` pasa a ser admin. Como red de seguridad, los emails del
secreto opcional `ADMIN_EMAILS` son siempre admins y no se pueden quitar desde la web:

```bash
npx wrangler secret put ADMIN_EMAILS     # opcional, p. ej. tu-email@gmail.com
```

### 4. Buscar películas (opcional, gratis)

Al proponer una película se busca en [TMDB](https://www.themoviedb.org) y se rellenan solos póster, año, dirección y
sinopsis. Crea una cuenta gratuita → **Ajustes → API** → pide una clave (uso personal / no comercial) y guárdala:

```bash
npx wrangler secret put TMDB_API_KEY   # vale la "API Key" o el "API Read Access Token"
```

Sin clave, las películas se proponen a mano (título, dirección, año…).

### 5. Enviar al Kindle (opcional, gratis)

Los epub se guardan en **Workers KV** (namespace `EPUBS`, ya en `wrangler.jsonc`; gratis hasta 1 GB y 25 MB por archivo).
Descargarlos funciona sin más. Para el botón **Enviar a mi Kindle** hace falta [Resend](https://resend.com)
(plan gratuito: 100 emails/día; el Email Sending de Cloudflare exige el plan de pago para enviar a direcciones de fuera):

1. Crea la cuenta en Resend → **Domains → Add domain** → `las-primas-club.rdvl.net`. Usa *Auto configure* con Cloudflare
   o copia los registros DNS (DKIM, SPF y MX en subdominios; no tocan la web) en la zona `rdvl.net`. Espera a que salga *Verified*.
2. **API Keys → Create** (permiso *Sending access*) y guárdala en el Worker:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
3. El remitente es `KINDLE_FROM` en `wrangler.jsonc` (`libros@las-primas-club.rdvl.net`). Cada miembro debe añadirlo a su
   *Lista de direcciones de correo electrónico aprobadas* de Amazon; la web le explica cómo.

Resend descarga el epub de un enlace temporal (`/api/kindle-file/<token>`, válido 60 min) en vez de recibirlo en base64,
para no pasar de los 10 ms de CPU del plan gratuito de Workers.

### 6. Desplegar

```bash
npm run deploy    # build + migraciones remotas + wrangler deploy
```

### 7. Despliegue automático con GitHub Actions

`.github/workflows/deploy.yml` hace, en cada push a `main`: build → migraciones de D1 (`--remote`) → `wrangler deploy` →
comprobación de que `/api/config` responde. En las PR solo comprueba que compila.

Configuración (una vez):

1. Cloudflare → **My Profile → API Tokens → Create Token** → plantilla **Edit Cloudflare Workers**, y añade el permiso
   **Account → D1 → Edit** (la plantilla ya incluye *Workers KV Storage*). Limita *Account Resources* a tu cuenta y *Zone Resources* a `rdvl.net`.
2. En GitHub (o con `gh`):
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN          # pega el token cuando lo pida
   gh variable set CLOUDFLARE_ACCOUNT_ID --body "<id de tu cuenta>"
   ```

Las migraciones nuevas van en `migrations/000N_descripcion.sql` y se aplican solas al hacer push.
No actives también *Workers Builds* en Cloudflare, o se desplegaría dos veces.

## Cómo se usa

- **Proponer**: cualquier miembro propone libros en *Votación*. Si hay una ronda abierta, entran como candidatos;
  si no, entran en la siguiente.
- **Votar**: un voto por persona y ronda; se puede cambiar mientras siga abierta.
- **Admin** (panel en `/admin`): gestiona miembros, edita o borra libros y abre, cierra o cancela rondas. Abre la ronda y la cierra (el más votado pasa a ser el libro en curso y el anterior se marca como leído).
  También puede marcar un libro como terminado o empezar uno sin votación (*leer ya*, útil para el primer libro).
- **Puntuar y comentar**: en el libro en curso y en cualquier libro leído.
- **Cine**: igual que los libros, con su propia ronda de votación (pueden estar abiertas las dos a la vez), la película
  que toca ver, puntuaciones, comentarios y el historial de vistas. Internamente comparten tablas (`books.kind`).
- **Epub**: un admin lo sube desde la ficha del libro (*subir epub*). Cualquier miembro puede descargarlo o, tras guardar
  su dirección `@kindle.com`, mandárselo al Kindle (máx. 10 envíos al día por persona).

## Roadmap

- [x] Sección de cine (mismo modelo: propuestas, votación y reseñas)
- [x] Subir epub y descargarlos (Workers KV)
- [x] Enviar al Kindle por email (Resend)
