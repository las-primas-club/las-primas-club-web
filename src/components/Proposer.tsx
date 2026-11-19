import type { Book } from "../../shared/types";
import { useAuth } from "../auth";
import { KINDS } from "../kinds";

type ProposerBook = Pick<Book, "kind" | "status" | "archived_at" | "proposed_by" | "proposed_by_name">;

/**
 * Quién lo propuso, separado del autor: inicial en un circulito y "Propuesto por Ana".
 * Mientras la propuesta está pendiente es anónima (el servidor no manda el nombre): se avisa de ello,
 * y a quien la propuso se le dice que es suya.
 */
export function Proposer({ book }: { book: ProposerBook }) {
  const { user } = useAuth();
  const pending = book.status === "proposed" && !book.archived_at;
  const mine = Boolean(user && book.proposed_by === user.id);

  if (pending) {
    return (
      <span className="proposer is-anonymous" title="Se sabrá quién la propuso cuando se cierre la votación">
        <span className="proposer-initial" aria-hidden>
          ?
        </span>
        <span>{mine ? "Tu propuesta · nadie más sabe que es tuya" : "Propuesta anónima hasta que se cierre la votación"}</span>
      </span>
    );
  }
  if (!book.proposed_by_name) return null;
  const label = KINDS[book.kind].proposedBy;
  return (
    <span className="proposer">
      <span className="proposer-initial" aria-hidden>
        {book.proposed_by_name[0]?.toUpperCase()}
      </span>
      <span>
        {label[0].toUpperCase() + label.slice(1)} <strong>{book.proposed_by_name}</strong>
      </span>
    </span>
  );
}
