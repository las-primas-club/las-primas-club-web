import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva (borrar, cancelar…): botón en rojo. */
  danger?: boolean;
}

type Confirm = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Modal de confirmación con el estilo de la web, en lugar del confirm() del navegador.
 * Usa <dialog> nativo: atrapa el foco, se cierra con Esc y bloquea la página de detrás.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const confirm = useCallback<Confirm>((o) => {
    resolver.current?.(false);
    setOpts(typeof o === "string" ? { title: o } : o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    dialog.current?.close();
    setOpts(null);
  }, []);

  useEffect(() => {
    if (opts && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [opts]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="modal-title"
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
        onClick={(e) => e.target === e.currentTarget && close(false)}
      >
        {opts && (
          <div className="modal-body">
            <h2 id="modal-title">{opts.title}</h2>
            {opts.message && <div className="modal-message">{opts.message}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                {opts.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                className={`btn ${opts.danger ? "btn-danger" : ""}`}
                onClick={() => close(true)}
                autoFocus
              >
                {opts.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm fuera de ConfirmProvider");
  return ctx;
}
