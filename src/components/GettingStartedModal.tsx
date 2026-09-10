import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "./ui/Button";
import { chainConfig } from "../lib/chain/config";
import { COOKIE_DOCS_URL, NIGHTLY_URL } from "../lib/chain/links";

/**
 * "How to start", the four steps in order (RF-06.1, AC-06.2, AC-06.5).
 *
 * Accessibility here is the requirement, not a nicety, so the three things
 * that are usually skipped are all present and all tested:
 *
 * - **The focus is trapped.** Tab from the last control returns to the first
 *   and Shift+Tab from the first wraps to the last, so a keyboard user cannot
 *   tab out into a page that is behind a scrim and inert.
 * - **The focus is RESTORED** to whatever opened the modal. Without it, a
 *   keyboard user lands back at the top of the document and has to travel the
 *   whole header again.
 * - **Escape, the backdrop and the button all close it.** Three ways out,
 *   because a dialog with one is a trap for whoever does not know which one.
 *
 * The RPC URL is read from `chainConfig`, never written down here: a deploy
 * pointed at a different endpoint must tell people to add THAT endpoint.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Step({
  children,
  index,
  title,
}: {
  children: React.ReactNode;
  index: number;
  title: string;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/12 font-display text-[13px] font-bold text-accent"
      >
        {index}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-[14.5px] font-semibold">{title}</h3>
        <div className="text-[13px] leading-relaxed text-ink-2">{children}</div>
      </div>
    </li>
  );
}

export function GettingStartedModal({
  isClosing = false,
  onClose,
}: {
  /** Closing, but still mounted for the length of the scrim's fade out. */
  isClosing?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const copyRpc = useCallback(() => {
    void navigator.clipboard
      .writeText(chainConfig.rpcUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setCopied(false));
  }, []);

  useEffect(() => {
    // Captured before the modal steals focus, restored on the way out.
    const opener = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;

      const list = [...nodes];
      const start = list[0];
      const end = list[list.length - 1];

      // The wrap has to be done by hand: the browser's own tab order does not
      // know the rest of the page is behind a scrim.
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-5"
      data-closing={isClosing ? "true" : undefined}
      data-testid="getting-started-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="getting-started-title"
        aria-modal="true"
        className="pop-in w-full max-w-[520px] rounded-xl border border-border-strong bg-card p-6 shadow-2xl"
        data-testid="getting-started-modal"
        ref={dialogRef}
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2
              className="font-display text-[22px] font-bold tracking-[-0.03em]"
              id="getting-started-title"
            >
              How to start
            </h2>
            <p className="text-[13px] text-ink-3">
              Four steps, about two minutes.
            </p>
          </div>
          <Button
            aria-label="Close"
            data-testid="getting-started-close"
            onClick={onClose}
            variant="ghost"
          >
            Close
          </Button>
        </div>

        <ol className="flex flex-col gap-5">
          <Step index={1} title="Install Nightly">
            Cookie Bakery talks to your wallet through the Wallet Standard.
            Nightly is the one verified against this chain.
            <div className="mt-2">
              <ButtonLink
                href={NIGHTLY_URL}
                rel="noreferrer"
                target="_blank"
                variant="secondary"
              >
                Get Nightly
              </ButtonLink>
            </div>
          </Step>

          <Step index={2} title="Add Cookie Chain">
            In Nightly, add a custom network with this RPC endpoint. Cookie
            Chain is its own SVM, not Solana mainnet — the app never sends
            through the wallet's own endpoint.
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-md border border-border-low bg-bg1 px-2.5 py-1.5 font-mono text-[12px]">
                {chainConfig.rpcUrl}
              </code>
              <Button
                data-testid="copy-rpc"
                onClick={copyRpc}
                variant="secondary"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </Step>

          <Step index={3} title="Get some COOK">
            Every transaction costs COOK for fees and rent. Bridge assets in to
            fund the wallet you are going to bake with.
            <div className="mt-2">
              <ButtonLink
                href={chainConfig.bridgeUrl}
                rel="noreferrer"
                target="_blank"
                variant="secondary"
              >
                Open the bridge
              </ButtonLink>
            </div>
          </Step>

          <Step index={4} title="Come back and bake">
            Connect the wallet, fill in a name and a supply, and check the cost
            before you sign. The mint, your token account and the whole supply
            land in one transaction.
          </Step>
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-low pt-4">
          <a
            className="text-[12.5px] font-medium text-ink-2 underline underline-offset-2 hover:text-ink"
            href={COOKIE_DOCS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Cookie Chain docs
          </a>
          <Button data-testid="getting-started-done" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
