// Abrir enlaces de fuera (Jellyfin) en el navegador de verdad cuando la web está instalada como app (PWA).
// Dentro de la app, Android los abre en una "pestaña personalizada" encima de la app e iOS en una vista de Safari
// incrustada: al volver a la app para meter el código de Quick Connect, esa pantalla se cierra y el código se pierde.

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * URL para abrir `url` en el navegador del sistema, fuera de la app instalada.
 * - iOS 17+: el esquema x-safari-https:// abre Safari con la URL completa.
 * - Android: un enlace intent:// que abre Chrome como app aparte (si no está, abre la URL normal). Android pierde
 *   lo que va tras "#", así que con rutas tipo "/web/#/details?id=…" se deja la URL normal: se abre en la pestaña
 *   de Chrome encima de la app, que comparte la sesión de Jellyfin con Chrome.
 * - Fuera de la app instalada (o en el ordenador), la URL tal cual (con target="_blank").
 */
export function browserUrl(url: string) {
  if (!isStandalone()) return url;
  const u = new URL(url);
  const scheme = u.protocol.replace(":", "");
  if (isIOS()) return `x-safari-${scheme}://${u.host}${u.pathname}${u.search}${u.hash}`;
  if (isAndroid() && !u.hash) {
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return url;
}
