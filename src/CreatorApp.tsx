import { Providers } from "./providers";
import App from "./App";
import { ToastProvider } from "./components/ToastProvider";

/**
 * The creator-facing half of the app, behind its own lazy boundary.
 *
 * This exists so `main.tsx` can import it dynamically. `providers.tsx` builds
 * the Kit wallet client at module-eval time, so a static import would pull the
 * wallet plugin, the RPC plugin and all three creator screens into the entry
 * chunk — which every visitor downloads, including a follower who opened
 * `/e/:slug` on a phone to paste one address. See CLAUDE.md § Bundle.
 */
export default function CreatorApp() {
  return (
    <Providers>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Providers>
  );
}
