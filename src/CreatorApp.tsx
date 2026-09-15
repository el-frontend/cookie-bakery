import { BrowserRouter } from "react-router";
import { Providers } from "./providers";
import App from "./App";
import { ToastProvider } from "./components/ToastProvider";
import { APP_BASENAME } from "./surface";

/**
 * The creator-facing half of the app, behind its own lazy boundary.
 *
 * This exists so `main.tsx` can import it dynamically. `providers.tsx` builds
 * the Kit wallet client at module-eval time, so a static import would pull the
 * wallet plugin, the RPC plugin and all four creator screens into the entry
 * chunk — which every visitor downloads, including a follower who opened
 * `/e/:slug` on a phone to paste one address. See CLAUDE.md § Bundle.
 *
 * The router is mounted HERE rather than in `main.tsx` for the same reason.
 * Only the creator sections need real URLs; putting `BrowserRouter` at the
 * root would bill the landing and the follower's register page for a router
 * neither one navigates. `basename` consumes the `/app` prefix that
 * `parseSurface` matched, so `App` only ever deals in `/bake`, `/airdrop`,
 * `/oven` and `/events`.
 */
export default function CreatorApp() {
  return (
    <BrowserRouter basename={APP_BASENAME}>
      <Providers>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Providers>
    </BrowserRouter>
  );
}
