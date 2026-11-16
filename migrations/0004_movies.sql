-- Cine: las películas usan las mismas tablas que los libros (propuestas, rondas, votos, notas y comentarios).
-- kind distingue libro ('book') de película ('movie'). En las películas, author es la dirección
-- y status 'read' significa "vista".

ALTER TABLE books ADD COLUMN kind TEXT NOT NULL DEFAULT 'book' CHECK (kind IN ('book', 'movie'));
ALTER TABLE books ADD COLUMN year TEXT;
ALTER TABLE rounds ADD COLUMN kind TEXT NOT NULL DEFAULT 'book' CHECK (kind IN ('book', 'movie'));

-- Un libro en curso y una película en curso a la vez (antes: uno en total)
DROP INDEX idx_books_one_current;
CREATE UNIQUE INDEX idx_books_one_current ON books(kind) WHERE status = 'current';

-- Una ronda abierta de libros y otra de cine a la vez
DROP INDEX idx_rounds_one_open;
CREATE UNIQUE INDEX idx_rounds_one_open ON rounds(kind) WHERE status = 'open';
