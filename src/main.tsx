import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { parsePublicRoute } from "./public/route";
import "./index.css";

/**
 * Both halves of the app load lazily, and that is the whole point of this
 * file: the entry chunk holds the router decision and nothing else.
 *
 * A follower opens `/e/:slug` on a phone, mid-stream, to paste one address or
 * check a draw. A static import of either half would put it in the chunk
 * every visitor downloads — and `providers.tsx` builds the Kit wallet client
 * at module-eval time, so importing the creator shell statically drags the
 * wallet plugin, the RPC plugin and all three creator screens along with it.
 * Same reasoning as the lazy `HoldersChart` in the Oven. See CLAUDE.md
 * § Bundle, and the spec's §8.3 bundle budget.
 */
const PublicApp = lazy(() => import("./public/PublicApp"));
const CreatorApp = lazy(() => import("./CreatorApp"));

const route = parsePublicRoute(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {route ? <PublicApp route={route} /> : <CreatorApp />}
    </Suspense>
  </StrictMode>
);
