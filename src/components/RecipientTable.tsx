/**
 * The pre-flight recipient list (RF-03.3, AC-03.3).
 *
 * Every parsed line is shown, valid or not, with its ORIGINAL line number.
 * A table that hides the bad rows leaves someone diffing their spreadsheet by
 * hand; the whole point is to point at the three lines that need fixing.
 *
 * Addresses come from a pasted file, so they are rendered as text and never as
 * markup — React escapes them, and nothing here interpolates them into a URL.
 */

export type RecipientRow = {
  address: string;
  /** Formatted for display; the bigint lives in the validation result. */
  amount: string;
  /** Null until the accounts have been probed. */
  ata: "exists" | "new" | null;
  /** Human-readable problem, or null when the row is fine. */
  error: string | null;
  line: number;
  /** Lines that were folded into this one, when duplicates were merged. */
  mergedFrom: readonly number[] | null;
};

function AtaChip({ state }: { state: "exists" | "new" }) {
  return state === "new" ? (
    <span className="rounded-chip bg-accent/12 px-2 py-[3px] text-[11px] font-semibold text-accent">
      + ATA
    </span>
  ) : (
    <span className="rounded-chip bg-raised px-2 py-[3px] text-[11px] font-semibold text-ink-3">
      ATA exists
    </span>
  );
}

function Status({ row }: { row: RecipientRow }) {
  if (row.error) {
    return (
      <span className="flex items-center justify-end gap-1.5 text-right text-[12.5px] text-danger">
        {row.error}
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1.5 text-[12.5px] text-success">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {row.mergedFrom && row.mergedFrom.length > 1
        ? `Merged from ${row.mergedFrom.join(", ")}`
        : "Valid"}
    </span>
  );
}

export function RecipientTable({
  rows,
  symbol,
}: {
  rows: readonly RecipientRow[];
  symbol: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border-low bg-card"
      data-testid="recipient-table"
    >
      <table className="w-full min-w-[540px] border-collapse text-left">
        <caption className="sr-only">Airdrop recipients</caption>
        <thead>
          <tr className="border-b border-border-low text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            <th className="px-4 py-3 font-semibold" scope="col">
              #
            </th>
            <th className="px-2 py-3 font-semibold" scope="col">
              Recipient
            </th>
            <th className="px-2 py-3 text-right font-semibold" scope="col">
              Amount
            </th>
            <th className="px-4 py-3 text-right font-semibold" scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={
                "border-b border-border-low/60 last:border-0 " +
                (row.error ? "bg-danger/[0.06]" : "")
              }
              key={`${row.line}-${row.address}`}
            >
              <td className="px-4 py-3 font-mono text-[12px] text-ink-3 num">
                {row.line}
              </td>
              <td className="px-2 py-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-[12.5px]">
                    {row.address}
                  </span>
                  {row.ata ? <AtaChip state={row.ata} /> : null}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right font-mono text-[13px] num">
                {row.amount}
                {symbol ? (
                  <span className="ml-1 text-ink-3">{symbol}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right">
                <Status row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
