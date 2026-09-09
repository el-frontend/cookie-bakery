import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The one pressable primitive.
 *
 * Press feedback is not decoration: `scale(0.97)` on `:active` is what makes
 * the interface feel like it heard you. 160ms and `--ease-strong-out` because a press
 * is the moment the user is watching most closely — `ease-in` there reads as
 * lag even at the same duration.
 *
 * Only `transform` and colors are animated (no layout). Tailwind v4 already
 * gates `hover:` behind `@media (hover: hover)`, so a tap on a phone cannot
 * leave a button stuck in its hover state.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-lg " +
  "transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[0_10px_30px_-12px_rgba(232,163,61,0.55)] hover:bg-accent-hover",
  secondary:
    "bg-raised text-ink border border-border-strong hover:border-ink-4",
  ghost: "text-ink-2 hover:text-ink",
};

const SIZES: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-6 text-[15px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: Size;
  variant?: Variant;
};

export function Button({
  children,
  className = "",
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
