-- Normas del club configurables desde el panel de admin (clave → valor). Lo que no esté aquí usa el valor
-- por defecto del código (shared/types.ts), que es el que había hasta ahora: nada cambia al aplicar esta migración.
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Los votos tenían el hueco limitado a 1 o 2. Para poder subir el número de votos por persona se amplía a 1-10.
-- SQLite no deja cambiar un CHECK: se crea la tabla nueva, se copian TODOS los votos tal cual y se sustituye.
CREATE TABLE votes_new (
  round_id    INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 10),
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, user_id, slot)
);
INSERT INTO votes_new (round_id, user_id, slot, book_id, created_at)
  SELECT round_id, user_id, slot, book_id, created_at FROM votes;
DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;
CREATE INDEX idx_votes_book ON votes(book_id);
