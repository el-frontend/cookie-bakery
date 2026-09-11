/**
 * The path split that keeps the follower's page out of the creator's app.
 *
 * A router is not worth its weight for two routes, and `vercel.json` already
 * rewrites every path to index.html, so matching on the pathname is enough.
 *
 * The slug alphabet is restricted HERE rather than trusted downstream: it
 * reaches both a query and the DOM, and one narrow gate beats escaping it
 * everywhere afterwards.
 */

export type PublicRoute =
  { kind: "register"; slug: string } | { kind: "verify"; slug: string };

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function parsePublicRoute(pathname: string): PublicRoute | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "e") return null;

  const slug = parts[1];
  if (slug === undefined || !SLUG.test(slug)) return null;

  if (parts.length === 2) return { kind: "register", slug };
  if (parts.length === 3 && parts[2] === "verify")
    return { kind: "verify", slug };
  return null;
}
