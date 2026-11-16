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

```bash
npx wrangler secret put ALLOWED_EMAILS   # p. ej. ana@gmail.com,luis@gmail.com,...
npx wrangler secret put ADMIN_EMAILS     # quienes abren y cierran votaciones
```

Si `ALLOWED_EMAILS` está vacío, cualquiera con cuenta de Google puede entrar. Los emails de `ADMIN_EMAILS`
siempre tienen acceso.

### 4. Desplegar

```bash
npm run deploy    # build + migraciones remotas + wrangler deploy
```

### 5. Despliegue automático en cada push (opcional, gratis)

En el panel de Cloudflare: **Workers & Pages → las-primas-club → Settings → Builds → Connect** y elige este repositorio de GitHub.

- Build command: `npm run build`
- Deploy command: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

## Cómo se usa

- **Proponer**: cualquier miembro propone libros en *Votación*. Si hay una ronda abierta, entran como candidatos;
  si no, entran en la siguiente.
- **Votar**: un voto por persona y ronda; se puede cambiar mientras siga abierta.
- **Admin**: abre la ronda y la cierra (el más votado pasa a ser el libro en curso y el anterior se marca como leído).
  También puede marcar un libro como terminado o empezar uno sin votación (*leer ya*, útil para el primer libro).
- **Puntuar y comentar**: en el libro en curso y en cualquier libro leído.

## Roadmap

- [ ] Sección de cine (mismo modelo: propuestas, votación y reseñas)
- [ ] Subir epub a R2 y descargarlos (R2 gratis hasta 10 GB)
- [ ] Enviar al ebook/Kindle por email (Cloudflare Email Service)
