import type { WatchProvider } from "../../shared/types";
import { api } from "../api";
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

/** En qué plataformas se puede ver la película en España. No sale nada si no hay datos. */
export function WatchPanel({ bookId }: { bookId: number }) {
  const { data: info } = useAsync(() => api.watch(bookId), [bookId]);
  if (!info) return null;
  const none = !info.flatrate.length && !info.rent.length && !info.buy.length;
  return (
    <section className="detail-section">
      <h2 className="rule-title">Dónde verla</h2>
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
    </section>
  );
}
