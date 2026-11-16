-- Dos votos por persona y ronda (se pueden dar los dos al mismo candidato): una fila por voto, con su hueco 1 o 2.
CREATE TABLE votes_new (
  round_id    INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot IN (1, 2)),
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, user_id, slot)
);
INSERT INTO votes_new (round_id, user_id, slot, book_id, created_at)
  SELECT round_id, user_id, 1, book_id, created_at FROM votes;
DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;
CREATE INDEX idx_votes_book ON votes(book_id);

-- Las propuestas que pierden una votación se archivan: dejan de contar como pendientes,
-- siguen en el histórico de rondas y cualquiera puede volver a proponerlas.
ALTER TABLE books ADD COLUMN archived_at TEXT;
