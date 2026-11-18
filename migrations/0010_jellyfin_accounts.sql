-- Cuenta de Jellyfin enlazada a cada miembro. jellyfin_managed = 1 si la creó la web (entonces la web
-- le pone los permisos —solo películas— y la desactiva si la persona deja el club).
ALTER TABLE users ADD COLUMN jellyfin_user_id TEXT;
ALTER TABLE users ADD COLUMN jellyfin_name TEXT;
ALTER TABLE users ADD COLUMN jellyfin_managed INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_users_jellyfin ON users(jellyfin_user_id) WHERE jellyfin_user_id IS NOT NULL;
