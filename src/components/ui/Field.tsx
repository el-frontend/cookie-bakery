import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Form primitives for the Bake screen.
 *
 * The label is a small, wide-tracked cap line in --ink-3, which clears AA on
 * both the canvas and the card. Inputs sit on the CANVAS colour rather than the
 * card so a field reads as a well cut into the surface, not a box stacked on it.
 */

const LABEL =
  "block text-xs font-semibold uppercase tracking-[0.06em] text-ink-3";

export function Field({
  children,
  error,
  hint,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className={LABEL}>
        {label}
        {hint ? (
          <span className="ml-1.5 font-normal normal-case tracking-normal text-ink-4">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  mono?: boolean;
};

export function Input({
  className = "",
  invalid = false,
  mono = false,
  ...props
}: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={
        "h-[46px] w-full rounded-md border bg-bg1 px-3.5 outline-none " +
        "transition-[border-color,box-shadow] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        (mono ? "font-mono text-sm num " : "text-[14.5px] ") +
        (invalid
          ? "border-danger focus:shadow-[0_0_0_3px_rgba(226,104,95,0.15)] "
          : "border-border-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(232,163,61,0.15)] ") +
        className
      }
      {...props}
    />
  );
}

/**
 * A real checkbox underneath (keyboard, form semantics, a11y tree) with the
 * native box hidden and a drawn one in its place — the native control cannot
 * be tinted to the accent on a dark surface.
 */
export function Checkbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={
        "group flex items-center gap-2.5 text-sm " +
        (disabled ? "cursor-not-allowed text-ink-4" : "cursor-pointer")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border " +
          "transition-[background-color,border-color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent " +
          (checked
            ? "border-accent bg-accent"
            : "border-border-strong bg-bg1 group-hover:border-ink-4")
        }
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={
            // The tick grows into the box on the box's own timing, so checking
            // reads as one movement. Never from scale(0): it comes from
            // something, not from nothing.
            "transition-[opacity,transform] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
            (checked ? "opacity-100 scale-100" : "opacity-0 scale-75")
          }
        >
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#1a1410"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={disabled ? undefined : "text-ink"}>{label}</span>
    </label>
  );
}
