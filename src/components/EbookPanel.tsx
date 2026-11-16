import { useRef, useState } from "react";
import type { BookDetail } from "../../shared/types";
import { api } from "../api";
import { useAuth } from "../auth";
import { useConfirm } from "./Dialog";

const MAX_MB = 25;

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Las Primas Club <libros@dominio>" → "libros@dominio" */
function bareAddress(from: string) {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

/** Descargar el epub del libro o mandarlo al Kindle. Los admins suben, cambian o quitan el archivo. */
export function EbookPanel({ book, onChange }: { book: BookDetail; onChange: () => void }) {
  const { user, config, refresh } = useAuth();
  const ask = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingKindle, setEditingKindle] = useState(false);
  const [kindleEmail, setKindleEmail] = useState(user?.kindle_email ?? "");

  if (!user || (!book.epub_name && !user.isAdmin)) return null;
  const kindleFrom = config?.kindleFrom ? bareAddress(config.kindleFrom) : null;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (!/\.epub$/i.test(file.name)) return setError("Tiene que ser un archivo .epub");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`El epub no puede pasar de ${MAX_MB} MB`);
    void run(async () => {
      await api.uploadEpub(book.id, file);
      onChange();
      return "Epub subido. Ya se puede descargar y enviar al Kindle.";
    });
  };

  const saveKindle = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.saveKindleEmail(kindleEmail.trim() || null);
      await refresh();
      setEditingKindle(false);
    });
  };

  const send = () =>
    run(async () => {
      const { to } = await api.sendToKindle(book.id);
      return `📬 Enviado a ${to}. Aparecerá en tu Kindle en unos minutos.`;
    });

  const showKindleForm = kindleFrom && (!user.kindle_email || editingKindle);

  return (
    <section className="detail-section">
      <h2 className="rule-title">Llévatelo a tu ebook</h2>

      {book.epub_name ? (
        <div className="ebook-box">
          <div className="ebook-file">
            <span className="ebook-icon" aria-hidden>📗</span>
            <div>
              <strong>{book.epub_name}</strong>
              <span className="muted small"> · {formatSize(book.epub_size)}</span>
            </div>
          </div>

          <div className="ebook-actions">
            {kindleFrom && user.kindle_email && (
              <button className="btn" disabled={busy} onClick={send}>
                {busy ? "Enviando…" : "Enviar a mi Kindle"}
              </button>
            )}
            <a className="btn btn-ghost" href={api.epubUrl(book.id)} download>
              Descargar epub
            </a>
          </div>

          {kindleFrom && user.kindle_email && !editingKindle && (
            <p className="muted small">
              Se enviará a <b>{user.kindle_email}</b> ·{" "}
              <button className="link-btn" onClick={() => setEditingKindle(true)}>
                cambiar
              </button>
            </p>
          )}

          {showKindleForm && (
            <form className="kindle-form" onSubmit={saveKindle}>
              <label className="panel-label" htmlFor="kindle-email">
                Tu dirección de Kindle
              </label>
              <div className="kindle-row">
                <input
                  id="kindle-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="tunombre_abc@kindle.com"
                  value={kindleEmail}
                  onChange={(e) => setKindleEmail(e.target.value)}
                />
                <button className="btn btn-dark" disabled={busy}>
                  Guardar
                </button>
              </div>
              <details className="kindle-help" open={!user.kindle_email}>
                <summary>Cómo prepararlo (solo la primera vez)</summary>
                <ol>
                  <li>
                    Entra en{" "}
                    <a href="https://www.amazon.es/myk" target="_blank" rel="noreferrer">
                      Amazon → Gestionar contenido y dispositivos
                    </a>{" "}
                    → <b>Preferencias</b> → <b>Configuración de documentos personales</b>.
                  </li>
                  <li>
                    Copia tu <b>dirección de correo electrónico de Enviar a Kindle</b> (termina en @kindle.com) y pégala
                    aquí arriba.
                  </li>
                  <li>
                    En esa misma página, en <b>Lista de direcciones de correo electrónico aprobadas</b>, añade{" "}
                    <code>{kindleFrom}</code>. Si no, Amazon descarta el libro sin avisar.
                  </li>
                </ol>
              </details>
            </form>
          )}
        </div>
      ) : (
        <p className="muted">Todavía no hay epub de este libro.</p>
      )}

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {user.isAdmin && (
        <div className="ebook-admin">
          <span className="muted small">Admin:</span>
          <input
            ref={fileInput}
            type="file"
            accept=".epub,application/epub+zip"
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <button className="link-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
            {busy ? "Subiendo…" : book.epub_name ? "reemplazar epub" : "subir epub"}
          </button>
          {book.epub_name && (
            <button
              className="link-btn"
              disabled={busy}
              onClick={async () =>
                (await ask({
                  title: "¿Quitar el epub?",
                  message: "Nadie podrá descargarlo ni enviarlo al Kindle hasta que subas otro.",
                  confirmLabel: "Quitar epub",
                  danger: true,
                })) &&
                run(async () => {
                  await api.deleteEpub(book.id);
                  onChange();
                })
              }
            >
              quitar epub
            </button>
          )}
        </div>
      )}
    </section>
  );
}
