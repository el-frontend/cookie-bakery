import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConfigError, loadChainConfig } from "../lib/chain/config";

/**
 * The five environment variables, and what happens when one is missing
 * (RF-07.2, AC-07.7).
 *
 * The deploy failure this guards against is silent: a missing `VITE_RPC_URL`
 * in Vercel does not break the build, it ships a bundle that cannot reach any
 * chain. `loadChainConfig` is evaluated at module scope precisely so the app
 * dies at startup with a sentence instead — these tests keep that true.
 */

const REQUIRED = [
  "VITE_BRIDGE_URL",
  "VITE_DAS_URL",
  "VITE_EXPLORER_URL",
  "VITE_RPC_URL",
  "VITE_WALLET_CHAIN",
] as const;

const complete = {
  VITE_BRIDGE_URL: "https://hyperlane.cookiescan.io",
  VITE_DAS_URL: "https://api.cookiescan.io",
  VITE_EXPLORER_URL: "https://cookiescan.io",
  VITE_RPC_URL: "https://rpc.cookiescan.io",
  VITE_WALLET_CHAIN: "solana:mainnet",
};

describe(".env.example declara las cinco VITE_*", () => {
  const example = readFileSync(".env.example", "utf8");

  it("nombra todas las variables obligatorias", () => {
    for (const name of REQUIRED) {
      expect(example, `${name} is not documented`).toContain(`${name}=`);
    }
  });

  it("no documenta variables que la config no lee", () => {
    const declared = [...example.matchAll(/^(VITE_[A-Z_]+)=/gm)].map(
      (match) => match[1]
    );
    // A stale variable in the template is a deploy instruction nobody needs
    // and a reader cannot tell it is dead.
    expect([...declared].sort()).toEqual([...REQUIRED].sort());
  });

  it("no lleva ningún secreto", () => {
    // Everything here ships in the client bundle. A key in this file would be
    // published to every visitor.
    expect(example).not.toMatch(/(PRIVATE|SECRET|MNEMONIC|SEED|API_KEY)/i);
  });
});

describe("la config falla rápido y legible si falta una variable en build", () => {
  it("acepta un entorno completo", () => {
    const config = loadChainConfig(complete, () => {});

    expect(config.rpcUrl).toBe("https://rpc.cookiescan.io");
    expect(config.chain).toBe("solana:mainnet");
  });

  it("nombra la variable que falta, una por una", () => {
    for (const name of REQUIRED) {
      const broken = { ...complete, [name]: undefined };

      expect(() => loadChainConfig(broken, () => {})).toThrow(ConfigError);
      expect(() => loadChainConfig(broken, () => {})).toThrow(new RegExp(name));
      // And it tells the reader how to fix it, not just what broke.
      expect(() => loadChainConfig(broken, () => {})).toThrow(
        /\.env\.example|namespace:reference/
      );
    }
  });

  it("rechaza una cadena vacía igual que una ausente", () => {
    expect(() =>
      loadChainConfig({ ...complete, VITE_RPC_URL: "   " }, () => {})
    ).toThrow(/VITE_RPC_URL/);
  });

  it("rechaza una URL que no lo es", () => {
    expect(() =>
      loadChainConfig(
        { ...complete, VITE_DAS_URL: "api.cookiescan.io" },
        () => {}
      )
    ).toThrow(/not a valid URL/);
  });

  it("avisa, sin fallar, de un namespace de cadena no solana", () => {
    const warnings: string[] = [];
    const config = loadChainConfig(
      { ...complete, VITE_WALLET_CHAIN: "cookie:mainnet" },
      (message) => warnings.push(message)
    );

    // Allowed — the plugin is chain-agnostic — but worth saying out loud,
    // because discovery filters on it and an empty wallet list looks like
    // "no wallet installed".
    expect(config.chain).toBe("cookie:mainnet");
    expect(warnings.join(" ")).toMatch(/wallet list will look empty/);
  });
});

describe("el ejemplo y la CSP del deploy concuerdan", () => {
  it("los hosts de .env.example están permitidos por la CSP", () => {
    const example = readFileSync(".env.example", "utf8");
    const csp = readFileSync("vercel.json", "utf8");

    // `connect-src https:` covers every https endpoint in the template, so
    // repointing the RPC cannot silently break the app.
    expect(example).toMatch(/VITE_RPC_URL=https:/);
    expect(csp).toMatch(/connect-src[^;"]*https:/);
  });
});
