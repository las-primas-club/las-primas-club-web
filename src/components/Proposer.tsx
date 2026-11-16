import type { Book } from "../../shared/types";
import { KINDS } from "../kinds";

/** Quién lo propuso, separado del autor: inicial en un circulito y "Propuesto por Ana". */
export function Proposer({ book }: { book: Pick<Book, "kind" | "proposed_by_name"> }) {
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
