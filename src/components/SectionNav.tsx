import { NavLink } from "react-router";
import type { Kind } from "../../shared/types";
import { KINDS } from "../kinds";

/** Pestañas de una sección (Libros o Cine): en curso · votación · historial. */
export function SectionNav({ kind }: { kind: Kind }) {
  const k = KINDS[kind];
  return (
    <nav className="section-nav" aria-label={k.section}>
      {/* stay: al tocar esta pestaña se ve la página aunque no haya nada en curso (sin redirigir a otra). */}
      <NavLink to={k.paths.now} state={{ stay: true }} end>
        {k.nowShort}
      </NavLink>
      <NavLink to={k.paths.vote}>
        Votación
      </NavLink>
      <NavLink to={k.paths.done} end>
        {k.doneShort}
      </NavLink>
    </nav>
  );
}
