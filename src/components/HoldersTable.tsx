import type { Holder, HolderSource } from "../lib/token/holders";
import { explorer } from "../lib/chain/explorer";
import { truncateAddress } from "../lib/format/address";
import { formatTokenAmount } from "../lib/format/tokenAmount";

/**
 * Top holders of a mint (RF-04.6, AC-04.3).
 *
 * Doubles as the accessible alternative to the distribution chart, which is
 * why it lives right beside it and carries the same numbers rather than a
 * rounded summary.
 *
 * The row shows the OWNER where the source knew it and falls back to the token
 * account otherwise, labelled so the two are never confused. That distinction
 * matters: `getTokenLargestAccounts` only returns accounts, and presenting an
 * associated token account as if it were a wallet would have people searching
 * CookieScan for an address that is not theirs.
 */

const SOURCE_NOTE: Record<HolderSource, string> = {
  das: "Holders indexed by CookieScan.",
  rpc: "CookieScan's index is unavailable, so this is the top 20 straight from the RPC.",
};

export function HoldersTable({
  decimals,
  holders,
  source,
  symbol,
  total,
}: {
  decimals: number;
  holders: readonly Holder[];
  source: HolderSource;
  symbol: string;
  /** Holder count for the whole mint; null when only the RPC answered. */
  total: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Top holders
        </h3>
        <span className="text-[12px] text-ink-3">
          {total == null
            ? `${holders.length} shown`
            : `${holders.length} of ${total.toLocaleString()}`}
        </span>
      </div>

      {holders.length === 0 ? (
        <p className="rounded-xl border border-border-low bg-card px-4 py-6 text-center text-sm text-ink-3">
          Nobody holds this token yet.
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border border-border-low bg-card"
          data-testid="holders-table"
        >
          <table className="w-full min-w-[480px] border-collapse text-left">
            <caption className="sr-only">
              Top holders by share of supply
            </caption>
            <thead>
              <tr className="border-b border-border-low text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                <th className="px-4 py-3 font-semibold" scope="col">
                  #
                </th>
                <th className="px-2 py-3 font-semibold" scope="col">
                  Holder
                </th>
                <th className="px-2 py-3 text-right font-semibold" scope="col">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {holders.map((holder, index) => {
                const isOwner = holder.owner !== null;
                const shown = holder.owner ?? holder.account;
                return (
                  <tr
                    className="border-b border-border-low/60 last:border-0"
                    key={holder.account}
                  >
                    <td className="px-4 py-3 font-mono text-[12px] text-ink-3 num">
                      {index + 1}
                    </td>
                    <td className="px-2 py-3">
                      <a
                        className="font-mono text-[12.5px] text-ink hover:text-accent hover:underline"
                        href={explorer.addressUrl(shown)}
                        rel="noreferrer"
                        target="_blank"
                        title={shown}
                      >
                        {truncateAddress(shown, 6, 6)}
                      </a>
                      {isOwner ? null : (
                        <span
                          className="ml-2 rounded-chip bg-raised px-2 py-[2px] text-[10.5px] font-semibold text-ink-3"
                          title="The RPC returned a token account without naming its owner"
                        >
                          token account
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[13px] num">
                      {formatTokenAmount(holder.amount, decimals)}
                      {symbol ? (
                        <span className="ml-1 text-ink-3">{symbol}</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-[13px] font-semibold text-accent num">
                      {holder.percent.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-ink-3">{SOURCE_NOTE[source]}</p>
    </div>
  );
}
