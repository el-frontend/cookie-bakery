import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./providers";
import App from "./App";
import { ChainProbe } from "./dev/ChainProbe";
import "./index.css";

// RF-01.1 spike hatch — `?probe` renders the chain probe outside the Providers
// tree, so raw Wallet Standard discovery is not filtered by the client's chain.
// Remove together with src/dev/ChainProbe.tsx once VITE_WALLET_CHAIN is pinned.
const isProbe = new URLSearchParams(window.location.search).has("probe");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isProbe ? (
      <ChainProbe />
    ) : (
      <Providers>
        <App />
      </Providers>
    )}
  </StrictMode>
);
