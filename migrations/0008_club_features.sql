-- Quedada del libro o la película en curso: fecha/hora (hora local, "YYYY-MM-DDTHH:MM") y sitio.
ALTER TABLE books ADD COLUMN meet_at TEXT;
ALTER TABLE books ADD COLUMN meet_place TEXT;
-- Id de la película en TMDB (para saber en qué plataformas se puede ver).
ALTER TABLE books ADD COLUMN tmdb_id INTEGER;

-- Quién va (1) y quién no puede (0) a la quedada.
CREATE TABLE meetup_rsvps (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  going       INTEGER NOT NULL CHECK (going IN (0, 1)),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_id)
);

-- Por dónde va cada uno: porcentaje leído (en una película, 100 = ya la he visto).
CREATE TABLE progress (
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percent     INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_id)
);

-- Fecha límite (informativa) de una ronda: "YYYY-MM-DDTHH:MM" en hora local. La cierra un admin.
ALTER TABLE rounds ADD COLUMN closes_at TEXT;

-- Comentarios con spoilers: salen tapados hasta que se tocan.
ALTER TABLE comments ADD COLUMN spoiler INTEGER NOT NULL DEFAULT 0;

-- Avisos push: los dispositivos suscritos y los avisos enviados (el service worker pide el último al recibir un push).
CREATE TABLE push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

CREATE TABLE notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  url         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
