import { useId } from "react";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

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
  /**
   * Why the button is unavailable, announced when it is `disabled` (RF-06.4).
   *
   * A disabled control with no explanation is a dead end for a screen reader:
   * it says "button, dimmed" and nothing about what would enable it. The
   * reason is linked with `aria-describedby` rather than replacing the label,
   * so the button still announces what it does first.
   */
  disabledReason?: string;
  size?: Size;
  variant?: Variant;
};

export function Button({
  children,
  className = "",
  disabledReason,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  const reasonId = useId();
  const showReason = Boolean(props.disabled && disabledReason);

  return (
    <>
      <button
        aria-describedby={showReason ? reasonId : undefined}
        className={buttonClass({ className, size, variant })}
        title={showReason ? disabledReason : props.title}
        {...props}
      >
        {children}
      </button>
      {showReason ? (
        <span className="sr-only" id={reasonId}>
          {disabledReason}
        </span>
      ) : null}
    </>
  );
}

/** The class string, so an anchor can look like a button without being one. */
export function buttonClass({
  className = "",
  size = "md",
  variant = "primary",
}: {
  className?: string;
  size?: Size;
  variant?: Variant;
} = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  size?: Size;
  variant?: Variant;
};

/**
 * A link wearing the button's clothes.
 *
 * Navigation is an anchor, not a button with an onClick: middle-click,
 * cmd-click and "copy link" all have to keep working, and a screen reader
 * should announce a destination rather than an action.
 */
export function ButtonLink({
  children,
  className = "",
  size = "md",
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <a className={buttonClass({ className, size, variant })} {...props}>
      {children}
    </a>
  );
}
