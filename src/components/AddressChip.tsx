import { useEffect, useState } from "react";
import { truncateAddress } from "../lib/format/address";

/**
 * Shows a truncated address with a copy button.
 *
 * The full address goes to the clipboard, never the truncated form — copying
 * an ellipsis would silently produce an unusable address.
 */
export function AddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (insecure origin, denied permission).
      // Leaving the label unchanged is honest: nothing was copied.
      setCopied(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        data-testid="address-text"
        title={address}
        className="rounded-lg border border-border-low bg-cream px-3 py-2 font-mono text-xs"
      >
        {truncateAddress(address)}
      </span>
      <button
        onClick={copy}
        aria-label={`Copy address ${address}`}
        className="rounded-lg border border-border-low bg-card px-2 py-2 text-xs font-medium transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong active:scale-[0.97] cursor-pointer"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
