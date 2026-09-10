import { ecosystemLinks } from "../lib/chain/links";

/**
 * Ecosystem links (RF-06.3, AC-06.4).
 *
 * The list comes from `src/lib/chain/links.ts`, which reads the explorer and
 * bridge URLs out of `chainConfig`. Hardcoding them here would leave a deploy
 * configured for another endpoint pointing its users at the wrong explorer —
 * the exact bug the env vars exist to prevent.
 *
 * Every link is external, so all of them carry `rel="noreferrer"` and open in
 * a new tab: `noreferrer` also implies `noopener`, which is what stops the
 * opened page reaching back into `window.opener`.
 */
export function Footer() {
  return (
    <footer
      className="border-t border-border-low px-6 py-6 sm:px-8"
      data-testid="footer"
    >
      <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-4">
        <nav aria-label="Cookie Chain ecosystem">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {ecosystemLinks.map((link) => (
              <li key={link.label}>
                <a
                  className="text-[13px] font-medium text-ink-2 transition-colors duration-[160ms] hover:text-ink"
                  href={link.href}
                  rel="noreferrer"
                  target="_blank"
                  title={link.description}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-[12px] text-ink-4">
          Client-side only. Your keys never leave your wallet.
        </p>
      </div>
    </footer>
  );
}
