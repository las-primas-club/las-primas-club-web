import { useState } from "react";
import { Link } from "react-router";
import { MAX_PROPOSALS, type Kind } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { RoundResults } from "../components/RoundResults";
import { SectionNav } from "../components/SectionNav";
import { KINDS } from "../kinds";
import { useAsync } from "../useAsync";

/** Histórico de rondas cerradas: qué se propuso, cuántos votos tuvo cada cosa y qué votó cada uno. */
export function RoundHistory({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  const { user } = useAuth();
  const { data: rounds, loading, error: loadError, reload } = useAsync(() => api.rounds(kind), [kind, user?.id]);
  const { data: proposed, reload: reloadProposed } = useAsync(() => api.books("proposed", kind), [kind]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mine = user ? (proposed ?? []).filter((b) => b.proposed_by === user.id).length : 0;

  const repropose = async (id: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.repropose(id);
      await Promise.all([reload(), reloadProposed()]);
      setNotice(`¡Hecho! Vuelve a estar propuest${kind === "movie" ? "a" : "o"} y entrará en la próxima votación.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <SectionNav kind={kind} />
      <h1 className="page-title">Rondas anteriores</h1>
      <p className="lead">
        Todo lo que se ha propuesto en cada votación{kind === "movie" ? " de cine" : ""}, con sus votos y lo que votó cada
        uno. Si algo se quedó a las puertas, puedes volver a proponerlo.
      </p>
      {user && (
        <p className="muted small">
          Tienes {mine} de {MAX_PROPOSALS} propuestas pendientes. <Link to={k.paths.vote}>Ir a la votación ›</Link>
        </p>
      )}
      {loadError && <p className="error">{loadError}</p>}
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : !rounds?.length ? (
        <p className="muted">Todavía no se ha cerrado ninguna votación.</p>
      ) : (
        <div className="round-list">
          {rounds.map((r) => (
            <RoundResults
              key={r.id}
              round={r}
              busy={busy}
              canRepropose={mine < MAX_PROPOSALS}
              onRepropose={repropose}
            />
          ))}
        </div>
      )}
    </div>
  );
}
