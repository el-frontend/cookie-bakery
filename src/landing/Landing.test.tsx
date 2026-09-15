import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Landing from "./Landing";

/**
 * The landing at `/`.
 *
 * Two kinds of check here, and the second is the one that will actually save
 * someone. The rendering tests cover the claims the page makes; the source
 * test covers the constraint that makes the page cheap, which no rendering
 * test can see — a stray `import { client } from "../providers"` would still
 * render fine here and would quietly put the wallet plugin and the RPC client
 * into the chunk every cold visitor downloads.
 */

describe("Landing", () => {
  it("leads with what the app does", () => {
    render(<Landing />);
    expect(
      screen.getByRole("heading", { level: 1, name: /launch a token/i })
    ).toBeInTheDocument();
  });

  it("points every call to action at /app", () => {
    render(<Landing />);
    const ctas = screen.getAllByRole("link", { name: /open the app/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/app");
    }
  });

  /**
   * `getAllBy` rather than `getBy`: the shared footer carries its own GitHub
   * link, and every one of them has to be safe, not just the first.
   */
  it("links out to the repo without leaking the referrer", () => {
    render(<Landing />);
    const links = [
      ...screen.getAllByRole("link", { name: /github/i }),
      ...screen.getAllByRole("link", { name: /read the source/i }),
    ];

    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        "https://github.com/el-frontend/cookie-bakery"
      );
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("names the four things a creator does", () => {
    render(<Landing />);
    for (const name of [/^bake$/i, /^airdrop$/i, /^oven$/i, /^pay$/i]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("explains the draw as commit-reveal against a future block", () => {
    render(<Landing />);
    expect(
      screen.getByRole("heading", { name: /checkable by anyone/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/does not exist yet/i)).toBeInTheDocument();
    expect(screen.getByText(/recomputes the whole draw/i)).toBeInTheDocument();
  });

  /**
   * The load-bearing honesty check. The draw's whole value is that it does not
   * overclaim, so a landing that sells it without both caveats is worse than
   * one that never mentioned the draw.
   */
  it("states the two things the draw does NOT prove", () => {
    render(<Landing />);
    expect(screen.getByText(/not a VRF/i)).toBeInTheDocument();
    expect(
      screen.getByText(/checkable, not the creator trustworthy/i)
    ).toBeInTheDocument();
  });

  it("says no address ever reaches the verify page", () => {
    render(<Landing />);
    expect(
      screen.getByText(/no address ever appears on the verify page/i)
    ).toBeInTheDocument();
  });

  it("ships the screenshots with intrinsic dimensions", () => {
    render(<Landing />);
    const shots = screen
      .getAllByRole("img")
      .filter((img) => img.getAttribute("src")?.startsWith("/shots/"));

    expect(shots).toHaveLength(3);
    for (const shot of shots) {
      // Without both, the three images reflow the page as they decode.
      expect(shot).toHaveAttribute("width");
      expect(shot).toHaveAttribute("height");
      expect(shot).toHaveAttribute("loading", "lazy");
      expect(shot.getAttribute("alt")).toBeTruthy();
    }
  });

  it("keeps the shared ecosystem footer", () => {
    render(<Landing />);
    const footer = screen.getByTestId("footer");
    expect(
      within(footer).getByRole("link", { name: "CookieScan" })
    ).toBeInTheDocument();
  });
});

describe("the landing chunk stays cold-start cheap", () => {
  const sources = ["src/landing/Landing.tsx", "src/surface.ts"];

  it.each(sources)("%s pulls in no wallet, RPC or router", (path) => {
    const source = readFileSync(path, "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

    for (const specifier of imports) {
      expect(specifier).not.toMatch(/^@solana\//);
      expect(specifier).not.toMatch(/^react-router/);
      expect(specifier).not.toMatch(/^swr$/);
      expect(specifier).not.toMatch(/recharts/);
      expect(specifier).not.toMatch(/providers$/);
    }
  });

  /**
   * The landing renders no state and runs no effects, and that is a property
   * worth pinning rather than a coincidence.
   *
   * The scroll entrance was an `IntersectionObserver` first. Hiding content by
   * default and waiting for a callback means a callback that never arrives —
   * throttled tab, offscreen renderer, restored scroll position — leaves a
   * blank page on the one screen a visitor reaches cold. `.reveal` is now
   * pure CSS (`animation-timeline: view()`), so the finished page is what a
   * browser without scroll-driven animations shows.
   */
  it("renders without state, effects or an observer", () => {
    const source = readFileSync("src/landing/Landing.tsx", "utf8");
    for (const banned of [
      "useState",
      "useEffect",
      "useRef",
      "IntersectionObserver",
    ]) {
      expect(source).not.toContain(banned);
    }
  });
});
