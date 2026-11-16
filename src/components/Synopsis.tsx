import { useLayoutEffect, useRef, useState } from "react";

/** Sinopsis recortada a unas líneas; si no cabe, aparece "Leer más" para desplegarla. */
export function Synopsis({ text, lines, className = "" }: { text: string; lines: number; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, expanded]);

  return (
    <div className="synopsis">
      <p
        ref={ref}
        className={`${className} ${expanded ? "" : "clamped"}`}
        style={expanded ? undefined : { WebkitLineClamp: lines }}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button type="button" className="link-btn synopsis-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Leer menos" : "Leer más"}
        </button>
      )}
    </div>
  );
}
