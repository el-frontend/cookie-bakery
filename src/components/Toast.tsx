import { explorer } from "../lib/chain/explorer";
import { truncateAddress } from "../lib/format/address";
import type { Toast as ToastModel } from "../lib/toast/types";

const VARIANT_STYLE: Record<ToastModel["variant"], string> = {
  error: "border-border-strong",
  pending: "border-border-low",
  success: "border-border-low",
};

const VARIANT_LABEL: Record<ToastModel["variant"], string> = {
  error: "Error",
  pending: "In progress",
  success: "Done",
};

export function Toast({
  isLeaving = false,
  onDismiss,
  toast,
}: {
  /** Dismissed, but still mounted for the length of its exit transition. */
  isLeaving?: boolean;
  onDismiss: (id: number) => void;
  toast: ToastModel;
}) {
  return (
    <li
      // Errors are announced assertively; progress updates should not
      // interrupt a screen reader mid-sentence.
      role={toast.variant === "error" ? "alert" : "status"}
      data-testid="toast"
      data-variant={toast.variant}
      data-leaving={isLeaving ? "true" : undefined}
      className={`toast-item pointer-events-auto w-full max-w-sm space-y-1 rounded-xl border ${VARIANT_STYLE[toast.variant]} bg-card p-4 text-sm shadow-[0_20px_60px_-40px_rgba(0,0,0,0.5)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{toast.title}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label={`Dismiss: ${toast.title}`}
          className="-mt-1 rounded px-1 text-muted transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:text-foreground cursor-pointer"
        >
          ×
        </button>
      </div>

      <span className="sr-only">{VARIANT_LABEL[toast.variant]}</span>

      {toast.detail ? (
        <p className="text-muted" data-testid="toast-detail">
          {toast.detail}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-1">
        {toast.signature ? (
          <a
            className="font-medium underline underline-offset-2"
            href={explorer.txUrl(toast.signature)}
            target="_blank"
            rel="noreferrer"
          >
            View {truncateAddress(toast.signature)}
          </a>
        ) : null}
        {toast.action ? (
          <a
            className="font-medium underline underline-offset-2"
            href={toast.action.href}
            target="_blank"
            rel="noreferrer"
          >
            {toast.action.label}
          </a>
        ) : null}
      </div>
    </li>
  );
}
