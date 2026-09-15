import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { parseSurface } from "./surface";
import "./index.css";

/**
 * All three surfaces load lazily, and that is the whole point of this file:
 * the entry chunk holds the route decision and nothing else.
 *
 * A follower opens `/e/:slug` on a phone, mid-stream, to paste one address or
 * check a draw. A static import of any surface would put it in the chunk
 * every visitor downloads — and `providers.tsx` builds the Kit wallet client
 * at module-eval time, so importing the creator shell statically drags the
 * wallet plugin, the RPC plugin and all four creator screens along with it.
 * Same reasoning as the lazy `HoldersChart` in the Oven. See CLAUDE.md
 * § Bundle, and the spec's §8.3 bundle budget.
 *
 * The landing is split off for the same reason read in the other direction:
 * it is the busiest page and the only one someone arrives at cold, so it must
 * not carry a wallet, an RPC client or a router it never uses.
 */
const Landing = lazy(() => import("./landing/Landing"));
const PublicApp = lazy(() => import("./public/PublicApp"));
const CreatorApp = lazy(() => import("./CreatorApp"));

const surface = parseSurface(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {surface.kind === "public" ? (
        <PublicApp route={surface.route} />
      ) : surface.kind === "app" ? (
        <CreatorApp />
      ) : (
        <Landing />
      )}
    </Suspense>
  </StrictMode>
);
