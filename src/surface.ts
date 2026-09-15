import { parsePublicRoute, type PublicRoute } from "./public/route";

/**
 * The three-way split at the root of the app, and the only routing decision
 * the entry chunk makes.
 *
 * It stays a plain string match rather than a router on purpose. `main.tsx`
 * runs this before it knows which half of the app to download, so anything
 * imported here is imported by every visitor — including the follower who
 * opened `/e/:slug` on a phone, mid-stream, to paste one address. react-router
 * lives one level down, inside the creator chunk, where only creators pay for
 * it (CLAUDE.md § Bundle, spec §8.3).
 *
 * The `/app` prefix is matched here and consumed by `<BrowserRouter
 * basename="/app">` in `CreatorApp`, so the sections below it never appear in
 * this file. Adding a section is a change to `App.tsx` alone.
 */

export type Surface =
  | { kind: "app" }
  | { kind: "landing" }
  | { kind: "public"; route: PublicRoute };

/** The prefix `CreatorApp` mounts its router under. */
export const APP_BASENAME = "/app";

/**
 * Unknown paths resolve to the landing rather than 404ing.
 *
 * Both deploys rewrite every path to `index.html` so deep links work, which
 * means this function — not the CDN — decides what a typo renders. The landing
 * is the honest answer: it names the product and links to everything, where a
 * bare creator shell would leave someone who mistyped a slug staring at an
 * empty Bake form with no idea where they are.
 */
export function parseSurface(pathname: string): Surface {
  const route = parsePublicRoute(pathname);
  if (route) return { kind: "public", route };

  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] === "app") return { kind: "app" };

  return { kind: "landing" };
}
