-- Medias estrellas: la puntuación pasa de entero 1-5 a pasos de 0,5 entre 0,5 y 5.
-- SQLite no permite cambiar un CHECK, así que se rehace la tabla conservando las notas.

CREATE TABLE ratings_new (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       REAL NOT NULL CHECK (score >= 0.5 AND score <= 5 AND score * 2 = CAST(score * 2 AS INTEGER)),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_id)
);

INSERT INTO ratings_new (book_id, user_id, score, updated_at)
SELECT book_id, user_id, score, updated_at FROM ratings;

DROP TABLE ratings;
ALTER TABLE ratings_new RENAME TO ratings;
