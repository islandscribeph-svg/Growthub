export function Logo() {
  return (
    <span className="logo">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="8" fill="#176A60" />
        <rect x="7" y="7" width="7" height="7" rx="1" fill="#FFFEFA" />
        <rect x="17" y="7" width="7" height="7" rx="1" fill="#FFFEFA" />
        <rect x="7" y="17" width="7" height="7" rx="1" fill="#FFFEFA" />
        <rect x="17" y="17" width="7" height="7" rx="1" fill="#FFFEFA" />
        <path
          d="M17 21 l4 4 l8 -10"
          fill="none"
          stroke="#DCEEE7"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="logo-word">BLKJN</span>
    </span>
  );
}
