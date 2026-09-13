import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";
import App from "./App";
import { ToastProvider } from "./components/ToastProvider";
import { parsePublicRoute } from "./public/route";
import "./index.css";

// The follower opens this on a phone, mid-stream, and must not pay for
// Recharts or the launcher just to paste an address or check a draw. Same
// reasoning as the lazy `HoldersChart` in the Oven and the lazy `Events`
// screen in App.tsx — see CLAUDE.md § Bundle.
const PublicApp = lazy(() => import("./public/PublicApp"));

const route = parsePublicRoute(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {route ? (
      <Suspense fallback={null}>
        <PublicApp route={route} />
      </Suspense>
    ) : (
      <Providers>
        <ToastProvider>
          <App />
        </ToastProvider>
      </Providers>
    )}
  </StrictMode>
);
