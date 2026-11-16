-- Epub del libro (el archivo se guarda en KV con la clave "epub:<id>") y envíos al Kindle

ALTER TABLE books ADD COLUMN epub_name TEXT;
ALTER TABLE books ADD COLUMN epub_size INTEGER;
ALTER TABLE books ADD COLUMN epub_uploaded_at TEXT;

-- Dirección "Enviar a Kindle" de cada persona (p. ej. nombre_xyz@kindle.com)
ALTER TABLE users ADD COLUMN kindle_email TEXT;

-- Cada envío genera un enlace temporal de un solo uso desde el que Resend descarga el epub
CREATE TABLE kindle_sends (
  token         TEXT PRIMARY KEY,
  book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kindle_email  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_kindle_sends_user ON kindle_sends(user_id, created_at);
