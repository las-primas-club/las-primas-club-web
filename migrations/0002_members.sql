-- Miembros del club: solo estos emails pueden entrar. Los gestiona un admin desde /admin.
CREATE TABLE members (
  email       TEXT PRIMARY KEY COLLATE NOCASE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  added_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Personas que han intentado entrar sin estar en la lista: el admin las acepta o rechaza.
CREATE TABLE access_requests (
  email         TEXT PRIMARY KEY COLLATE NOCASE,
  name          TEXT NOT NULL,
  picture       TEXT,
  requested_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE users ADD COLUMN last_login_at TEXT;

-- Quien ya había entrado antes de este cambio pasa a ser admin, para que nadie se quede fuera.
-- (En producción solo existía la cuenta de quien creó la web.)
INSERT INTO members (email, role) SELECT email, 'admin' FROM users;
