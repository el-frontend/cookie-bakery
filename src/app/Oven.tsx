import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useClient } from "@solana/react";
import type { Address } from "@solana/kit";
import { AddressChip } from "../components/AddressChip";
import { EmptyState } from "../components/EmptyState";
import { HoldersTable } from "../components/HoldersTable";
import { TokenSelector, type SelectedToken } from "../components/TokenSelector";
import { Button, ButtonLink } from "../components/ui/Button";
import { cookieSwapPoolUrl } from "../lib/chain/links";
import { explorer } from "../lib/chain/explorer";
import { buildDistribution, concentration } from "../lib/token/distribution";
import { fetchHolders, type HoldersResult } from "../lib/token/holders";
import {
  fetchRemoteMetadata,
  plainText,
  type RemoteMetadata,
} from "../lib/token/metadata";
import { readMint, type MintDetails } from "../lib/token/readMint";
import { mapError } from "../lib/errors/mapError";
import type { MappedError } from "../lib/errors/types";
import { truncateAddress } from "../lib/format/address";
import { formatTokenAmount } from "../lib/format/tokenAmount";
import { loadRuns, progressOf, type AirdropRun } from "../store/airdropHistory";
import type { AppClient } from "../providers";

/**
 * The Oven — everything known about one mint (RF-04.6).
 *
 * ## Untrusted by default
 *
 * The name, symbol, image and description all come from whoever created the
 * token, either from the on-chain `TokenMetadata` extension or from a JSON
 * document at a URI they chose. Every one of those strings goes through
 * `plainText` before it reaches the DOM, the image is only ever rendered from
 * an `https:` URL with `referrerPolicy="no-referrer"`, and nothing found in
 * that content is treated as an instruction. React escaping alone is not
 * enough — see `metadata.ts` on bidi overrides, which are not markup and which
 * escaping does nothing about.
 *
 * ## Three independent loads
 *
 * The mint, the holders and the remote metadata fail independently, so they
 * are stored independently. A metadata server that is down must not blank out
 * the supply, and the DAS being down must not stop the authorities rendering —
 * it just means the holders arrive from the RPC instead.
 */

/**
 * Recharts is ~390 kB of the bundle and this is its only consumer, on one of
 * three screens. Loading it eagerly made every visitor pay for a chart they
 * may never open, so it is split out and fetched when the Oven renders one.
 *
 * The fallback reserves the same height the chart will take, so the panels
 * below it do not jump when it arrives.
 */
const HoldersChart = lazy(() =>
  import("../components/HoldersChart").then((module) => ({
    default: module.HoldersChart,
  }))
);

type Loaded = {
  holders: HoldersResult;
  /** Already sanitised by `fetchRemoteMetadata`. */
  metadata: RemoteMetadata | null;
  mint: MintDetails;
};

/** A label for the token, preferring the most specific source available. */
function tokenLabel(
  selected: SelectedToken,
  mint: MintDetails | null,
  remoteName: string | null
): { name: string; symbol: string } {
  const onChain = mint?.onChainMetadata;
  return {
    name:
      remoteName ??
      plainText(onChain?.name) ??
      plainText(selected.name) ??
      `Mint ${truncateAddress(selected.mint)}`,
    symbol: plainText(onChain?.symbol) ?? plainText(selected.symbol) ?? "",
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-low bg-bg1 p-3.5">
      <span className="font-mono text-[15px] font-semibold num">{value}</span>
      <span className="text-xs text-ink-3">{label}</span>
    </div>
  );
}

function AuthorityRow({
  label,
  state,
}: {
  label: string;
  state: { address: Address | null; revoked: boolean };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-ink-2">{label}</span>
      {state.revoked ? (
        <span className="rounded-chip bg-success/12 px-2 py-[3px] text-[11px] font-semibold text-success">
          Revoked
        </span>
      ) : (
        <a
          className="font-mono text-[12.5px] text-ink hover:text-accent hover:underline"
          href={explorer.addressUrl(state.address!)}
          rel="noreferrer"
          target="_blank"
          title={state.address!}
        >
          {truncateAddress(state.address!, 6, 6)}
        </a>
      )}
    </div>
  );
}

export function Oven({
  client,
  onAirdrop,
  onBake,
}: {
  client: AppClient;
  /** Hands the mint to the Airdrop screen. */
  onAirdrop: (token: SelectedToken) => void;
  onBake: () => void;
}) {
  useClient<AppClient>();

  const [token, setToken] = useState<SelectedToken | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<MappedError | null>(null);
  const [runs, setRuns] = useState<AirdropRun[]>([]);

  useEffect(() => {
    setRuns(loadRuns());
  }, []);

  const load = useCallback(
    async (selected: SelectedToken) => {
      setIsLoading(true);
      setError(null);
      setLoaded(null);

      try {
        const mint = await readMint(client.rpc, selected.mint);

        // Holders and metadata are settled, not awaited together: either one
        // failing must not take the mint panel down with it.
        const [holdersResult, metadataResult] = await Promise.allSettled([
          fetchHolders(client.rpc, selected.mint, mint.supply),
          mint.onChainMetadata?.uri
            ? fetchRemoteMetadata(mint.onChainMetadata.uri)
            : Promise.resolve(null),
        ]);

        setLoaded({
          holders:
            holdersResult.status === "fulfilled"
              ? holdersResult.value
              : { holders: [], source: "rpc", total: null },
          metadata:
            metadataResult.status === "fulfilled" ? metadataResult.value : null,
          mint,
        });
      } catch (raw) {
        setError(mapError(raw));
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const select = useCallback(
    (next: SelectedToken | null) => {
      setToken(next);
      setLoaded(null);
      setError(null);
      if (next) void load(next);
    },
    [load]
  );

  /*
   * Precedence for the display name: the remote JSON, then the on-chain
   * extension, then whatever the store remembered, then the bare mint. The
   * remote document wins because it is the one the creator can correct without
   * a transaction — but it is also the least trustworthy, which is why it has
   * already been through `plainText` by the time it gets here.
   */
  const label = token
    ? tokenLabel(token, loaded?.mint ?? null, loaded?.metadata?.name ?? null)
    : null;

  const distribution = useMemo(
    () =>
      loaded
        ? buildDistribution(loaded.holders.holders, loaded.mint.supply)
        : [],
    [loaded]
  );

  const mintRuns = useMemo(
    () => (token ? runs.filter((run) => run.mint === token.mint) : []),
    [runs, token]
  );

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <EmptyState
          action={{ label: "Bake a token", onClick: onBake }}
          detail="Pick one of your tokens or paste any mint address to see its supply, authorities, extensions and holders."
          testId="oven-empty-state"
          title="Nothing in the oven yet"
        />
        <TokenSelector onChange={select} rpc={client.rpc} value={null} />
      </div>
    );
  }

  return (
    <section aria-label="Token dashboard" className="flex flex-col gap-5">
      <TokenSelector onChange={select} rpc={client.rpc} value={token} />

      {isLoading ? (
        <p className="rounded-xl border border-border-low bg-card px-5 py-8 text-center text-sm text-ink-3">
          Reading the mint from Cookie Chain…
        </p>
      ) : null}

      {error ? (
        <div
          className="rounded-lg border border-danger/30 bg-danger/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-danger"
          role="alert"
        >
          <span className="font-semibold">{error.title}</span> — {error.detail}
        </div>
      ) : null}

      {loaded && label ? (
        <>
          <header className="flex flex-wrap items-center gap-4 rounded-xl border border-border-low bg-card p-5">
            {loaded.metadata?.image ? (
              /*
               * `referrerPolicy` stops the token creator's server learning
               * which page loaded the image. The URL is already restricted to
               * https by `safeImageUrl`; a data: URI would be an arbitrary
               * payload with no origin to attribute it to.
               */
              <img
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-border-low object-cover"
                height={56}
                referrerPolicy="no-referrer"
                src={loaded.metadata.image}
                width={56}
              />
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/12 font-display text-base font-bold text-accent"
              >
                {(label.symbol || label.name).slice(0, 2).toUpperCase()}
              </span>
            )}

            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">
                {label.name}
                {label.symbol ? (
                  <span className="ml-2 text-base font-semibold text-ink-3">
                    {label.symbol}
                  </span>
                ) : null}
              </h2>
              {loaded.metadata?.description ? (
                <p className="max-w-[520px] text-[13px] leading-relaxed text-ink-2">
                  {loaded.metadata.description}
                </p>
              ) : null}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <AddressChip address={token.mint} />
              <ButtonLink
                href={explorer.tokenUrl(token.mint)}
                rel="noreferrer"
                target="_blank"
                variant="secondary"
              >
                CookieScan
              </ButtonLink>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat
              label="Total supply"
              value={formatTokenAmount(
                loaded.mint.supply,
                loaded.mint.decimals
              )}
            />
            <Stat label="Decimals" value={String(loaded.mint.decimals)} />
            <Stat
              label="Holders"
              value={
                loaded.holders.total == null
                  ? `${loaded.holders.holders.length}+`
                  : loaded.holders.total.toLocaleString()
              }
            />
            <Stat
              label="Top 10 hold"
              value={`${concentration(loaded.holders.holders, loaded.mint.supply).toFixed(1)}%`}
            />
          </div>

          <div className="flex flex-col gap-3.5 rounded-xl border border-border-low bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
              Mint authorities
            </h3>
            <AuthorityRow label="Mint authority" state={loaded.mint.minting} />
            <AuthorityRow label="Freeze authority" state={loaded.mint.freeze} />
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-ink-2">Token program</span>
              <span className="font-mono text-[12.5px]">
                {loaded.mint.program === "token-2022"
                  ? "Token-2022"
                  : "SPL Token"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 rounded-xl border border-border-low bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
              Extensions
            </h3>
            {loaded.mint.extensionSummaries.length === 0 ? (
              <p className="text-[13px] text-ink-3">
                No Token-2022 extensions are active on this mint.
              </p>
            ) : (
              <ul
                className="flex flex-col gap-2.5"
                data-testid="extension-list"
              >
                {loaded.mint.extensionSummaries.map((extension) => (
                  <li className="flex flex-col gap-0.5" key={extension.kind}>
                    <span className="text-[13px] font-semibold">
                      {extension.label}
                    </span>
                    {extension.detail ? (
                      <span className="break-all font-mono text-[11.5px] text-ink-3">
                        {extension.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Suspense
            fallback={
              <div className="h-[220px] animate-pulse rounded-xl border border-border-low bg-card" />
            }
          >
            <HoldersChart
              decimals={loaded.mint.decimals}
              slices={distribution}
              symbol={label.symbol}
            />
          </Suspense>

          <HoldersTable
            decimals={loaded.mint.decimals}
            holders={loaded.holders.holders}
            source={loaded.holders.source}
            symbol={label.symbol}
            total={loaded.holders.total}
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
              Airdrops from this device
            </h3>
            {mintRuns.length === 0 ? (
              <p className="rounded-xl border border-border-low bg-card px-4 py-5 text-sm text-ink-3">
                No airdrop of this token has been run from this browser.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5" data-testid="oven-history">
                {mintRuns.map((run) => {
                  const done = progressOf(run);
                  const signatures = run.batches
                    .filter((batch) => batch.signature)
                    .map((batch) => batch.signature!);
                  return (
                    <li
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border-low bg-card px-4 py-3"
                      key={run.id}
                    >
                      <span className="font-mono text-[11.5px] text-ink-3">
                        {run.startedAt.slice(0, 16).replace("T", " ")}
                      </span>
                      <span className="text-[12.5px] text-ink-2">
                        {done.confirmed}/{done.total} batches
                      </span>
                      <span className="flex flex-wrap gap-2">
                        {signatures.map((signature) => (
                          <a
                            className="font-mono text-[11.5px] text-accent underline underline-offset-2"
                            href={explorer.txUrl(signature)}
                            key={signature}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {truncateAddress(signature, 5, 5)}
                          </a>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              data-testid="oven-airdrop-more"
              onClick={() => onAirdrop(token)}
            >
              Airdrop more
            </Button>
            <ButtonLink
              data-testid="oven-cookieswap"
              href={cookieSwapPoolUrl(token.mint)}
              rel="noreferrer"
              target="_blank"
              variant="secondary"
            >
              Create a pool on CookieSwap
            </ButtonLink>
          </div>
        </>
      ) : null}
    </section>
  );
}
