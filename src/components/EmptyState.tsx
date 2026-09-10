import type { ReactNode } from "react";
import { Button, ButtonLink } from "./ui/Button";

/**
 * The one empty state (RF-06.2, AC-06.3).
 *
 * Every screen has a moment before it has anything to show, and the rule the
 * PRD sets is that this moment must name the NEXT ACTION rather than describe
 * the absence. "No token selected" tells someone nothing; "Pick a token to
 * airdrop" tells them what to do.
 *
 * So the action is not optional in the API: an empty state without one is a
 * dead end, and making it required means nobody can add a dead end by
 * forgetting a prop.
 */

export type EmptyStateAction =
  | { href: string; label: string; onClick?: never }
  | { href?: never; label: string; onClick: () => void };

export function EmptyState({
  action,
  children,
  detail,
  icon,
  secondary,
  testId = "empty-state",
  title,
}: {
  action: EmptyStateAction;
  children?: ReactNode;
  detail: string;
  icon?: ReactNode;
  /** An optional escape hatch, e.g. a link to the setup instructions. */
  secondary?: { href: string; label: string };
  testId?: string;
  title: string;
}) {
  return (
    <section
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-card/40 px-6 py-12 text-center"
      data-testid={testId}
    >
      {icon ? <div className="text-ink-3">{icon}</div> : null}

      <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">
        {title}
      </h2>
      <p className="max-w-[380px] text-sm leading-relaxed text-ink-2">
        {detail}
      </p>

      {children}

      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        {action.href ? (
          <ButtonLink
            href={action.href}
            // `_blank` only for a destination outside the app; an in-app
            // anchor stays in the tab so the back button keeps working.
            {...(action.href.startsWith("http")
              ? { rel: "noreferrer", target: "_blank" }
              : {})}
          >
            {action.label}
          </ButtonLink>
        ) : (
          <Button onClick={action.onClick}>{action.label}</Button>
        )}

        {secondary ? (
          <a
            className="text-sm font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
            href={secondary.href}
            rel="noreferrer"
            target="_blank"
          >
            {secondary.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
