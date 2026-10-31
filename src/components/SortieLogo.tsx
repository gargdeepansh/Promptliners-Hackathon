export function SortieLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Sortie Logo"
    >
      {/* Outer subtle shield/frame */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        className="fill-surface stroke-line"
        strokeWidth="1.5"
      />
      {/* Left triage vector (emerald accent) */}
      <path
        d="M8 12L15 16L8 20"
        stroke="var(--accent-teal)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right destination divider lines */}
      <path
        d="M19 10H24M19 16H24M19 22H24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
