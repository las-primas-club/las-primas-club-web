-- Comentarios editables: guardamos cuándo se editó para mostrar "editado".
ALTER TABLE comments ADD COLUMN edited_at TEXT;
