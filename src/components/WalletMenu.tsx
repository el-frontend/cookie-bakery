import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "@solana/kit";
import type { ClientWithWallet } from "@solana/kit-plugin-wallet";
import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useSelectAccount,
  useWallets,
} from "@solana/kit-plugin-wallet/react";
import { useCookBalance } from "../hooks/useCookBalance";
import { useToast } from "../hooks/useToast";
import { mapError } from "../lib/errors/mapError";
import { truncateAddress } from "../lib/format/address";
import { formatCook } from "../lib/format/lamports";

/**
 * The connected-wallet chip in the header, and the menu behind it (RF-01).
 *
 * Once a wallet is connected the big connection card disappears, so this menu
 * is the ONLY place the two exits live: switching to a different wallet, and
 * disconnecting. Without it a wrong-wallet connection is a dead end that only
 * a page reload — or the extension itself — can undo.
 *
 * The three ways to change identity, cheapest first:
 *
 * - **Another account of the connected wallet** — `selectAccount` is
 *   synchronous and prompt-free, because those accounts are already
 *   authorized. It is the common case: one extension, several accounts.
 * - **Another discovered wallet** — `connect` opens that wallet's prompt. The
 *   previous wallet stays authorized, which is what makes switching back
 *   prompt-free.
 * - **Disconnect** — drops the connection and the persisted account, so the
 *   next load starts at the connection card instead of reconnecting.
 *
 * `role="menu"` rather than a plain popover: the arrow keys are what a menu
 * promises, and the list of wallets can be long enough for them to matter.
 */

const ITEM =
  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:bg-raised focus-visible:bg-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const SECTION =
  "px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3";

export function WalletMenu({ client }: { client: ClientWithWallet }) {
  const connected = useConnectedWallet(client);
  const wallets = useWallets(client);
  const selectAccount = useSelectAccount(client);
  const {
    dispatch: connect,
    error: connectError,
    isRunning: isConnecting,
    reset: resetConnect,
  } = useConnect(client);
  const { dispatch: disconnect, isRunning: isDisconnecting } =
    useDisconnect(client);

  const address = connected?.account.address;
  const { lamports } = useCookBalance(address as Address | undefined);

  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /**
   * Roving focus across the enabled items, the part `role="menu"` promises.
   *
   * Bound to the document rather than the panel: a click on the chip leaves
   * focus on the chip, which is OUTSIDE the panel, so a handler on the panel
   * would never see the first ArrowDown — the one that is supposed to walk
   * into the menu.
   */
  const moveFocus = useCallback((event: KeyboardEvent) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])'
      ) ?? []
    );
    if (items.length === 0) return;

    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;
    items[next].focus();
  }, []);

  // Closed by anything that is not this menu: a click elsewhere, Escape, or
  // Tab leaving it. Escape and Tab hand focus back to the chip; a pointer
  // click already put focus wherever it landed.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key === "Tab") {
        // Tabbing out of an item would unmount the focused node and drop focus
        // to the body. Handing it back to the chip first means the default Tab
        // continues from the chip, i.e. into whatever follows the header.
        close(rootRef.current?.contains(document.activeElement) ?? false);
        return;
      }
      moveFocus(event);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, moveFocus, open]);

  // The connection went away (disconnected, or the extension dropped it):
  // there is no chip left to anchor the menu to.
  useEffect(() => {
    if (!connected) setOpen(false);
  }, [connected]);

  // A switch that fails is otherwise silent: the menu has already closed and
  // the chip still shows the old wallet, which reads as "nothing happened"
  // rather than "you dismissed the prompt". `reset()` clears the error, so the
  // effect settles after one toast.
  useEffect(() => {
    if (!connectError) return;
    const mapped = mapError(connectError);
    toast.show({
      action: mapped.action,
      detail: mapped.detail,
      title: mapped.title,
      variant: "error",
    });
    resetConnect();
  }, [connectError, resetConnect, toast]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    if (!address) return;
    void navigator.clipboard
      .writeText(address)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }, [address]);

  if (!connected || !address) return null;

  const activeWallet = connected.wallet;
  const others = wallets.filter((wallet) => wallet.name !== activeWallet.name);
  const otherAccounts = activeWallet.accounts.filter(
    (account) => account.address !== address
  );
  const busy = isConnecting || isDisconnecting;

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Wallet ${activeWallet.name}, ${address}`}
        className="flex items-center gap-[9px] rounded-md border border-border-low bg-card py-[7px] pl-3 pr-2 transition-[transform,border-color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        data-testid="wallet-menu-trigger"
        onClick={() => setOpen((was) => !was)}
        ref={triggerRef}
      >
        <span className="font-mono text-[12.5px] text-ink">
          {truncateAddress(address)}
        </span>
        <span className="rounded-[6px] bg-raised px-[9px] py-1 text-[11.5px] font-semibold text-accent num">
          {lamports == null ? "…" : `${formatCook(lamports)} COOK`}
        </span>
        <span
          aria-hidden
          className={
            "text-[10px] text-ink-3 transition-transform duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
            (open ? "rotate-180" : "")
          }
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          aria-label="Wallet"
          className="menu-pop absolute right-0 top-[calc(100%+8px)] z-50 w-[268px] rounded-xl border border-border-low bg-card p-1.5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
          data-testid="wallet-menu"
          role="menu"
        >
          <div className="flex flex-col gap-0.5 px-3 pb-2.5 pt-2">
            <span className="text-[13px] font-semibold text-ink">
              {activeWallet.name}
            </span>
            <span className="font-mono text-[11.5px] text-ink-3">
              {truncateAddress(address, 8, 8)}
            </span>
          </div>

          <button className={ITEM} onClick={copy} role="menuitem">
            <span className="text-ink-2">Copy address</span>
            <span className="text-[11.5px] text-ink-3">
              {copied ? "Copied" : null}
            </span>
          </button>

          {otherAccounts.length > 0 ? (
            <>
              <p className={SECTION}>Accounts</p>
              {otherAccounts.map((account) => (
                <button
                  className={ITEM}
                  disabled={busy}
                  key={account.address}
                  onClick={() => {
                    selectAccount(account);
                    close();
                  }}
                  role="menuitem"
                >
                  <span className="truncate font-mono text-[12px] text-ink-2">
                    {truncateAddress(account.address, 6, 6)}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-ink-3">Use</span>
                </button>
              ))}
            </>
          ) : null}

          <p className={SECTION}>Wallets</p>
          {others.length > 0 ? (
            others.map((wallet) => (
              <button
                className={ITEM}
                disabled={busy}
                key={wallet.name}
                onClick={() => {
                  connect(wallet);
                  close();
                }}
                role="menuitem"
              >
                <span className="truncate text-ink-2">{wallet.name}</span>
                <span className="shrink-0 text-[11.5px] text-ink-3">
                  {isConnecting ? "Connecting…" : "Connect"}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 pb-1.5 text-[12px] text-ink-3">
              No other wallets detected.
            </p>
          )}

          <div className="mx-3 my-1.5 border-t border-border-low" />

          <button
            className={ITEM + " text-danger"}
            disabled={isDisconnecting}
            data-testid="wallet-disconnect"
            onClick={() => {
              disconnect();
              close();
            }}
            role="menuitem"
          >
            {isDisconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
