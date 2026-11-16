import { Link } from "react-router";
import type { StatsItem } from "../../shared/types";
import { api } from "../api";
import { Stars } from "../components/Stars";
import { formatScore } from "../format";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

function Ranking({ title, items, empty }: { title: string; items: StatsItem[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section className="panel stats-panel">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="stats-ranking">
          {items.map((b) => (
            <li key={b.id}>
              <span>
                <span aria-hidden>{KINDS[b.kind].emoji}</span> <Link to={KINDS[b.kind].paths.item(b.id)}>{b.title}</Link>
              </span>
              <span className="stats-score">
                <Stars value={b.avg_rating} size="sm" />
                <strong>{formatScore(b.avg_rating, true)}</strong>
                <span className="muted small">({b.rating_count})</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Los números del club: cuánto llevamos, lo mejor valorado y qué hace cada uno. */
export function StatsPage() {
  const { data, loading, error } = useAsync(api.stats);
  if (loading) return <p className="muted">Cargando…</p>;
  if (error || !data) return <p className="error">{error ?? "No se pudieron cargar los datos"}</p>;

  const { totals, members } = data;
  const raters = members.filter((m) => m.ratings >= 2 && m.avg_given != null);
  const toughest = [...raters].sort((a, b) => a.avg_given! - b.avg_given!)[0];
  const kindest = [...raters].sort((a, b) => b.avg_given! - a.avg_given!)[0];
  const topProposer = [...members].sort((a, b) => b.wins - a.wins)[0];
  const chattiest = [...members].sort((a, b) => b.comments - a.comments)[0];
  const maxYear = Math.max(1, ...data.years.map((y) => y.books + y.movies));

  const awards = [
    topProposer?.wins ? { emoji: "🎯", label: "Mejor ojo proponiendo", name: topProposer.name, detail: `${topProposer.wins} propuesta${topProposer.wins === 1 ? "" : "s"} elegida${topProposer.wins === 1 ? "" : "s"}` } : null,
    toughest ? { emoji: "🧐", label: "Crítica más dura", name: toughest.name, detail: `media de ${formatScore(toughest.avg_given!, true)}` } : null,
    kindest && kindest !== toughest ? { emoji: "🥰", label: "Le gusta todo", name: kindest.name, detail: `media de ${formatScore(kindest.avg_given!, true)}` } : null,
    chattiest?.comments ? { emoji: "💬", label: "Quien más comenta", name: chattiest.name, detail: `${chattiest.comments} comentario${chattiest.comments === 1 ? "" : "s"}` } : null,
  ].filter((a) => a !== null);

  return (
    <div className="page stats">
      <h1 className="page-title">Los datos del club</h1>
      <p className="section-sub">Lo que llevamos leído, visto, votado y discutido.</p>

      <ul className="stats-totals">
        {[
          ["📖", totals.books, totals.books === 1 ? "libro leído" : "libros leídos"],
          ["🎬", totals.movies, totals.movies === 1 ? "película vista" : "películas vistas"],
          ["🗳️", totals.rounds, totals.rounds === 1 ? "votación" : "votaciones"],
          ["⭐", totals.ratings, totals.ratings === 1 ? "puntuación" : "puntuaciones"],
          ["💬", totals.comments, totals.comments === 1 ? "comentario" : "comentarios"],
        ].map(([emoji, n, label]) => (
          <li key={label}>
            <span aria-hidden>{emoji}</span>
            <strong>{n}</strong>
            <span className="muted small">{label}</span>
          </li>
        ))}
      </ul>

      {awards.length > 0 && (
        <ul className="stats-awards">
          {awards.map((a) => (
            <li key={a.label}>
              <span className="stats-award-emoji" aria-hidden>
                {a.emoji}
              </span>
              <span className="muted small">{a.label}</span>
              <strong>{a.name}</strong>
              <span className="muted small">{a.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="stats-grid">
        <Ranking title="🏆 Lo mejor valorado" items={data.best} empty="Todavía no hay puntuaciones." />
        <Ranking title="🍅 Lo que menos gustó" items={data.worst} />
      </div>

      {data.years.length > 0 && (
        <section className="panel stats-panel">
          <h2>📅 Año a año</h2>
          <ul className="stats-years">
            {data.years.map((y) => (
              <li key={y.year}>
                <strong>{y.year}</strong>
                <div className="bar" aria-hidden>
                  <span style={{ width: `${((y.books + y.movies) / maxYear) * 100}%` }} />
                </div>
                <span className="muted small">
                  {y.books} libro{y.books === 1 ? "" : "s"} · {y.movies} peli{y.movies === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {members.length > 0 && (
        <section className="panel stats-panel">
          <h2>👥 Cada uno</h2>
          <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Miembro</th>
                  <th>Elegidas</th>
                  <th>Puntuaciones</th>
                  <th>Media que da</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.wins}</td>
                    <td>{m.ratings}</td>
                    <td>{m.avg_given != null ? formatScore(m.avg_given, true) : "–"}</td>
                    <td>{m.comments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">"Elegidas" son las propuestas suyas que ganaron una votación o se eligieron directamente.</p>
        </section>
      )}
    </div>
  );
}
