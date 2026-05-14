// FK.market — графическая марка (Squircle, концепция A)
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="FK.market"
      className={className}
    >
      <defs>
        <linearGradient id="fkLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="80" height="80" rx="20" fill="url(#fkLogoGrad)" />
      <text
        x="40"
        y="54"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="#fff"
        textAnchor="middle"
        letterSpacing="-1.5"
      >
        FK
      </text>
    </svg>
  );
}
