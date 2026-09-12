import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// `.env` is not loaded into the Vitest process automatically (that's a Vite
// dev-server/build-time behavior, not a test-runner one). `loadEnv` reads the
// same `.env` files Vite would, but with prefix "" instead of "VITE_" so the
// non-VITE_ secrets (SUPABASE_SECRET_KEY, SUPABASE_DB_URL) come through too.
// This is how src/lib/supabase/rls.test.ts reaches the real remote Supabase
// project without its values ever being pasted into a source file.
const env = loadEnv("test", process.cwd(), "");

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
      // Placeholders — no module reads these yet (the Supabase client is a
      // later task). Deliberately not the real project's URL/key, so no
      // credential value sits in source; the RLS suite gets the real ones
      // straight from `.env` below, under its own variable names.
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_WALLET_CHAIN: "solana:mainnet",
      // Real remote credentials, for src/lib/supabase/rls.test.ts only. Read
      // from `.env` rather than hardcoded — a fake key cannot authenticate
      // against a real project. Empty string (not undefined) when `.env`
      // lacks them, so that suite's own reachability guard can tell
      // "not configured" apart from "misconfigured".
      SUPABASE_RLS_ANON_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_RLS_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? "",
      SUPABASE_RLS_URL: env.VITE_SUPABASE_URL ?? "",
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
