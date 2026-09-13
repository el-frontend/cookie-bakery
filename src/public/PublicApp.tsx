import { Register } from "./Register";
import { Verify } from "./Verify";
import type { PublicRoute } from "./route";

/**
 * The follower-facing shell — the entire reason `route.ts` exists.
 *
 * Deliberately NOT wrapped in `Providers`: neither `Register` nor `Verify`
 * touches a Kit client, and mounting one here would pull `@solana/kit-plugin-
 * wallet` into the one chunk that must stay small enough for a bad phone
 * connection mid-stream (CLAUDE.md § Bundle, spec §8.3). `main.tsx` lazy-loads
 * this whole module for the same reason.
 *
 * Default export because `main.tsx` reaches it through `React.lazy`, which
 * needs one.
 */
export default function PublicApp({ route }: { route: PublicRoute }) {
  if (route.kind === "verify") return <Verify slug={route.slug} />;
  return <Register slug={route.slug} />;
}
