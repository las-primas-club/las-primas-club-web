import type { WatchProvider } from "../../shared/types";
import { api } from "../api";
import { browserUrl } from "../external";
import { JellyfinAccess } from "./JellyfinAccess";
import { useAsync } from "../useAsync";

function Providers({ label, items }: { label: string; items: WatchProvider[] }) {
  if (!items.length) return null;
  return (
    <div className="watch-group">
      <span className="panel-label">{label}</span>
      <ul className="watch-list">
        {items.map((p) => (
          <li key={p.name} title={p.name}>
            {p.logo && <img src={p.logo} alt="" loading="lazy" width={32} height={32} />}
            <span>{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dónde ver la película: en el Jellyfin del club si la tiene y, si aún no la hemos visto, en qué plataformas está en España. */
export function WatchPanel({ bookId, watched }: { bookId: number; watched: boolean }) {
  const { data: jellyfin } = useAsync(() => api.jellyfin(bookId), [bookId]);
  const { data: info } = useAsync(() => (watched ? Promise.resolve(null) : api.watch(bookId)), [bookId, watched]);
  if (!info && !jellyfin) return null;
  const none = info && !info.flatrate.length && !info.rent.length && !info.buy.length;
  return (
    <section className="detail-section">
      <h2 className="rule-title">Dónde verla</h2>
      {jellyfin && (
        <div className="jellyfin-box">
          <div className="jellyfin-head">
            <strong>Está en el Jellyfin del club</strong>
            <a className="btn" href={browserUrl(jellyfin)} target="_blank" rel="noopener noreferrer">
              Ver en Jellyfin
            </a>
          </div>
          <JellyfinAccess compact />
        </div>
      )}
      {info && (
        <>
          {none ? (
            <p className="muted">Ahora mismo no está en ninguna plataforma en España.</p>
          ) : (
            <div className="watch">
              <Providers label="Incluida en" items={info.flatrate} />
              <Providers label="Alquiler" items={info.rent} />
              <Providers label="Compra" items={info.buy} />
            </div>
          )}
          <p className="muted small tmdb-credit">
            Disponibilidad en España según JustWatch (vía TMDB).{" "}
            <a href={info.link} target="_blank" rel="noopener noreferrer">
              Ver enlaces ›
            </a>
          </p>
        </>
      )}
    </section>
  );
}
