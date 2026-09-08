import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // The app validates its network config at import time and throws when a
    // variable is missing. Tests supply the same five values a real .env does,
    // so importing `providers` does not depend on a developer's local file.
    env: {
      VITE_BRIDGE_URL: "https://hyperlane.cookiescan.io",
      VITE_DAS_URL: "https://api.cookiescan.io",
      VITE_EXPLORER_URL: "https://cookiescan.io",
      VITE_RPC_URL: "https://rpc.cookiescan.io",
      VITE_WALLET_CHAIN: "solana:mainnet",
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
