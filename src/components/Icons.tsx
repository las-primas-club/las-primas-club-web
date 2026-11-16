// Iconos de línea sencillos para la barra inferior del móvil.
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const BookIcon = () => (
  <svg {...base}>
    <path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5Z" />
    <path d="M12 6.5V20" />
  </svg>
);

export const VoteIcon = () => (
  <svg {...base}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

export const ShelfIcon = () => (
  <svg {...base}>
    <path d="M4 4h3v16H4zM9 4h3v16H9z" />
    <path d="m14.5 5 2.9-.8 3.6 15.3-2.9.8z" />
  </svg>
);

export const AdminIcon = () => (
  <svg {...base}>
    <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const FilmIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
  </svg>
);
