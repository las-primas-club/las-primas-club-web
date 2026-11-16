import { useState } from "react";
import { formatScore } from "../format";

/** Puntuación que corresponde a pulsar/pasar por encima de la estrella n: mitad izquierda = media estrella. */
function scoreAt(e: React.PointerEvent | React.MouseEvent, n: number) {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientX - rect.left < rect.width / 2 ? n - 0.5 : n;
}

const clamp = (v: number) => Math.max(0.5, Math.min(5, v));

/**
 * Estrellas de 0,5 a 5. Sin onChange solo muestran el valor (admite cualquier decimal, p. ej. medias del club).
 * Con onChange se puede puntuar en medias estrellas: con el ratón o el dedo (mitad izquierda = media)
 * o con las flechas del teclado.
 */
export function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  const stars = [1, 2, 3, 4, 5].map((n) => {
    const fill = Math.max(0, Math.min(1, shown - n + 1));
    const star = (
      <span className="star" style={{ "--fill": `${fill * 100}%` } as React.CSSProperties}>
        ★
      </span>
    );
    if (!onChange) return <span key={n}>{star}</span>;
    return (
      <button
        key={n}
        type="button"
        tabIndex={-1}
        aria-hidden
        onPointerMove={(e) => e.pointerType === "mouse" && setHover(scoreAt(e, n))}
        onClick={(e) => {
          setHover(null);
          onChange(scoreAt(e, n));
        }}
      >
        {star}
      </button>
    );
  });

  if (!onChange) {
    return (
      <span className={`stars stars-${size}`} role="img" aria-label={value != null ? `${formatScore(value)} de 5` : "Sin puntuar"}>
        {stars}
      </span>
    );
  }

  return (
    <span
      className={`stars stars-${size} stars-input`}
      role="slider"
      tabIndex={0}
      aria-label="Tu puntuación"
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value != null ? `${formatScore(value)} de 5 estrellas` : "Sin puntuar"}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        onChange(clamp((value ?? 0) + step));
      }}
    >
      {stars}
    </span>
  );
}
