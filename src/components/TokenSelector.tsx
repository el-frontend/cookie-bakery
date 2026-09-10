import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isAddress,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from "@solana/kit";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { truncateAddress } from "../lib/format/address";
import { fromBaseUnits } from "../lib/token/bakeForm";
import {
  inspectMint,
  MintError,
  type TokenProgramKind,
} from "../lib/token/inspectMint";
import { loadMyTokens, type MyToken } from "../store/myTokens";

/**
 * Pick the token to airdrop (RF-03.4): one of "My tokens" or a pasted mint.
 *
 * EVERY choice is confirmed against the chain, including one that came out of
 * localStorage. The decimals and the token program decide how amounts are
 * scaled and which associated token account is derived, and a stale store
 * entry — a mint created against a different program, or a store written by an
 * older version of this app — would silently derive the wrong account. The
 * stored name and symbol are labels only; the numbers come from the chain.
 */

export type SelectedToken = {
  decimals: number;
  mint: Address;
  name: string;
  program: TokenProgramKind;
  programAddress: Address;
  supply: bigint;
  symbol: string;
};

const PROGRAM_LABEL: Record<TokenProgramKind, string> = {
  token: "SPL Token",
  "token-2022": "Token-2022",
};

/** Two initials for the avatar, from whatever label the token has. */
function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function Avatar({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 font-display text-[13px] font-bold text-accent"
    >
      {initialsOf(label)}
    </span>
  );
}

export function TokenSelector({
  onChange,
  rpc,
  value,
}: {
  onChange: (token: SelectedToken | null) => void;
  rpc: Rpc<GetAccountInfoApi>;
  value: SelectedToken | null;
}) {
  const [mine, setMine] = useState<MyToken[]>([]);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // localStorage is read once: it cannot change under us without a reload.
  useEffect(() => {
    setMine(loadMyTokens());
  }, []);

  const select = useCallback(
    async (mint: string, label: { name: string; symbol: string }) => {
      setError(null);

      if (!isAddress(mint)) {
        setError("That is not a valid base58 address.");
        return;
      }

      setIsChecking(true);
      try {
        const info = await inspectMint(rpc, mint);
        onChange({
          decimals: info.decimals,
          mint: info.address,
          name: label.name || `Mint ${truncateAddress(mint)}`,
          program: info.program,
          programAddress: info.programAddress,
          supply: info.supply,
          symbol: label.symbol,
        });
      } catch (raw) {
        setError(
          raw instanceof MintError
            ? raw.message
            : "Could not read that mint from Cookie Chain. Check the connection and try again."
        );
      } finally {
        setIsChecking(false);
      }
    },
    [onChange, rpc]
  );

  const supplyLabel = useMemo(
    () => (value ? fromBaseUnits(value.supply, value.decimals) : ""),
    [value]
  );

  if (value) {
    return (
      <div
        data-testid="token-selected"
        className="pop-in flex items-center gap-3.5 rounded-xl border border-border-low bg-card px-5 py-4"
      >
        <Avatar label={value.symbol || value.name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[14.5px] font-semibold">
            {value.name}
            {value.symbol ? ` · ${value.symbol}` : null}
          </span>
          <span className="truncate font-mono text-[11.5px] text-ink-3">
            {truncateAddress(value.mint, 8, 8)} · supply {supplyLabel} ·{" "}
            {PROGRAM_LABEL[value.program]}
          </span>
        </div>
        <Button
          className="ml-auto"
          data-testid="token-change"
          onClick={() => onChange(null)}
          variant="secondary"
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="enter flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5">
      {mine.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
            My tokens
          </span>
          <ul className="flex flex-col gap-1.5">
            {mine.map((token) => (
              <li key={token.mint}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-bg1 px-3.5 py-3 text-left transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong disabled:opacity-50"
                  disabled={isChecking}
                  onClick={() =>
                    void select(token.mint, {
                      name: token.name,
                      symbol: token.symbol,
                    })
                  }
                >
                  <Avatar label={token.symbol || token.name} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">
                      {token.name}
                      {token.symbol ? ` · ${token.symbol}` : null}
                    </span>
                    <span className="truncate font-mono text-[11.5px] text-ink-3">
                      {truncateAddress(token.mint, 8, 8)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field
        error={error ?? undefined}
        hint="Token or Token-2022"
        label="Or paste a mint address"
      >
        <div className="flex gap-2">
          <Input
            aria-label="Mint address"
            mono
            onChange={(event) => {
              setPasted(event.target.value.trim());
              setError(null);
            }}
            placeholder="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
            value={pasted}
          />
          <Button
            data-testid="token-use-mint"
            disabled={pasted === "" || isChecking}
            onClick={() => void select(pasted, { name: "", symbol: "" })}
            variant="secondary"
          >
            {isChecking ? "Checking…" : "Use"}
          </Button>
        </div>
      </Field>
    </div>
  );
}
