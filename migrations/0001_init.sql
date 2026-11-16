-- Esquema inicial del club de lectura

CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  picture     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,           -- token aleatorio (cookie HttpOnly)
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- status: 'proposed' (propuesto para votar), 'current' (en curso), 'read' (leído)
CREATE TABLE books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  author       TEXT NOT NULL,
  cover_url    TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'current', 'read')),
  proposed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at   TEXT,
  finished_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Solo puede haber un libro en curso a la vez
CREATE UNIQUE INDEX idx_books_one_current ON books(status) WHERE status = 'current';

-- Rondas de votación. Solo una abierta a la vez.
CREATE TABLE rounds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  winner_book_id  INTEGER REFERENCES books(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT
);
CREATE UNIQUE INDEX idx_rounds_one_open ON rounds(status) WHERE status = 'open';

CREATE TABLE round_candidates (
  round_id  INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  book_id   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, book_id)
);

-- Un voto por persona y ronda (se puede cambiar mientras la ronda esté abierta)
CREATE TABLE votes (
  round_id    INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, user_id)
);

-- Una puntuación (1-5) por persona y libro
CREATE TABLE ratings (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_id)
);

-- Comentarios (varios por persona y libro)
CREATE TABLE comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_book ON comments(book_id, created_at);
