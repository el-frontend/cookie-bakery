import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";
import { chainConfig } from "../lib/chain/config";
import { COOKIE_TELEGRAM_URL, REPO_URL } from "../lib/chain/links";

describe("Footer", () => {
  it("incluye los cinco links", () => {
    render(<Footer />);

    const nav = screen.getByRole("navigation", {
      name: "Cookie Chain ecosystem",
    });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(labels).toEqual([
      "GitHub",
      "CookieScan",
      "Docs",
      "Bridge",
      "Telegram",
    ]);
  });

  it("todos llevan rel noreferrer", () => {
    render(<Footer />);

    for (const link of within(
      screen.getByRole("navigation", { name: "Cookie Chain ecosystem" })
    ).getAllByRole("link")) {
      // noreferrer implies noopener, which is what blocks window.opener.
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("la url del explorer sale de la config", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "CookieScan" })).toHaveAttribute(
      "href",
      chainConfig.explorerUrl
    );
    expect(screen.getByRole("link", { name: "Bridge" })).toHaveAttribute(
      "href",
      chainConfig.bridgeUrl
    );
  });

  it("enlaza al repo y al Telegram del proyecto", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      REPO_URL
    );
    expect(screen.getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      COOKIE_TELEGRAM_URL
    );
  });
});
