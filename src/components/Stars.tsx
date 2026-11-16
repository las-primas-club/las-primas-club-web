import { useState } from "react";

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
  return (
    <span className={`stars stars-${size} ${onChange ? "stars-input" : ""}`} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, shown - n + 1));
        const star = (
          <span className="star" style={{ "--fill": `${fill * 100}%` } as React.CSSProperties}>
            ★
          </span>
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}
