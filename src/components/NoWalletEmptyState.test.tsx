import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoWalletEmptyState } from "./NoWalletEmptyState";

describe("NoWalletEmptyState", () => {
  it("enlaza a nightly.app", () => {
    render(<NoWalletEmptyState chain="solana:mainnet" />);
    const link = screen.getByRole("link", { name: "Get Nightly" });
    expect(link).toHaveAttribute("href", "https://nightly.app");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("enlaza a la sección Cómo conectar Nightly del README", () => {
    render(<NoWalletEmptyState chain="solana:mainnet" />);
    expect(
      screen.getByRole("link", { name: "How to connect Nightly" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining("#how-to-connect-nightly")
    );
  });

  it("nombra la cadena configurada", () => {
    // Without this, a wrong VITE_WALLET_CHAIN is indistinguishable from
    // "no wallet installed" — the exact trap the spike was run to avoid.
    render(<NoWalletEmptyState chain="cookie:mainnet" />);
    expect(screen.getByTestId("no-wallet-empty-state")).toHaveTextContent(
      "cookie:mainnet"
    );
  });
});
