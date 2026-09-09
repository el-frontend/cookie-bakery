/** The cookie mark. Stroke-based so it recolors and scales cleanly. */
export function BakeryMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9.2" cy="9.6" r="1.35" fill="currentColor" />
      <circle cx="14.6" cy="12.4" r="1.1" fill="currentColor" />
      <circle cx="10" cy="15.2" r="1" fill="currentColor" />
    </svg>
  );
}
