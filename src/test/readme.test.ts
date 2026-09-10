import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The README the bounty is graded on (RF-07.4, AC-07.2).
 *
 * The anchor test is the load-bearing one: `NoWalletEmptyState` links to
 * `#how-to-connect-nightly`, and a rename in the README would turn the app's
 * only wallet-setup instruction into a 404 that nothing else would catch.
 */

const readme = readFileSync("README.md", "utf8");

const REQUIRED_VARS = [
  "VITE_BRIDGE_URL",
  "VITE_DAS_URL",
  "VITE_EXPLORER_URL",
  "VITE_RPC_URL",
  "VITE_WALLET_CHAIN",
];

describe("incluye las secciones obligatorias", () => {
  it("describe qué es la app", () => {
    expect(readme).toMatch(/^# .*Cookie Bakery/m);
    expect(readme).toMatch(/client-side/i);
  });

  it("nombra las tres pantallas", () => {
    for (const screen of ["Bake", "Airdrop", "Oven"]) {
      expect(readme).toContain(screen);
    }
  });

  it("declara el stack sin framework-kit", () => {
    expect(readme).toContain("@solana/kit");
    expect(readme).toContain("@solana/kit-plugin-rpc");
    expect(readme).toContain("@solana/kit-plugin-wallet");
    // The banned packages must not appear as things the app uses.
    expect(readme).toMatch(/are not used anywhere|no se usan/);
  });

  it("explica el setup local", () => {
    expect(readme).toContain("npm install");
    expect(readme).toContain("npm run dev");
    expect(readme).toContain("cp .env.example .env");
  });

  it("tiene una sección de capturas, aunque diga que faltan", () => {
    expect(readme).toMatch(/## Screenshots|### Screenshots/);
  });

  it("declara la licencia MIT", () => {
    expect(readme).toMatch(/MIT/);
    expect(readme).toContain("./LICENSE");
  });

  it("enlaza al PRD y a las decisiones", () => {
    expect(readme).toContain("docs/prds/PRD-cookie-bakery.md");
    expect(readme).toContain("docs/decisions.md");
  });
});

describe("documenta las cinco variables", () => {
  it.each(REQUIRED_VARS)("documenta %s", (name) => {
    expect(readme).toContain(name);
  });

  it("avisa de que VITE_WALLET_CHAIN falla en silencio", () => {
    // The single most expensive misconfiguration in this app: an empty wallet
    // list with no error at all.
    expect(readme).toMatch(/empty wallet list with no error/i);
  });

  it("documenta los valores de Cookie Chain mainnet", () => {
    expect(readme).toContain("https://rpc.cookiescan.io");
    expect(readme).toContain("https://api.cookiescan.io");
    expect(readme).toContain("https://hyperlane.cookiescan.io");
  });
});

describe("tiene el ancla como-conectar-nightly", () => {
  it("define el ancla a la que enlaza el estado vacío sin wallet", () => {
    // NoWalletEmptyState builds this URL from links.ts; if the anchor moves,
    // the app's only wallet-setup pointer breaks.
    expect(readme).toContain('id="how-to-connect-nightly"');
  });

  it("cubre los cuatro pasos en orden", () => {
    const section = readme.slice(
      readme.indexOf("how-to-connect-nightly"),
      readme.indexOf("## Demo tokens")
    );
    expect(section).toMatch(/Install \[?Nightly/);
    expect(section).toMatch(/Add Cookie Chain/);
    expect(section).toMatch(/Get some COOK/);
    expect(section).toMatch(/connect/i);
  });
});

describe("el README no promete lo que no existe", () => {
  it("marca la URL pública y el token demo como pendientes", () => {
    // AC-07.3 and AC-07.4 need a funded wallet. Saying so is the honest state;
    // inventing a mint address would be worse than an empty section.
    expect(readme).toMatch(/not deployed yet|_pending_/);
    expect(readme).toMatch(/## What is still missing/);
  });

  it("no contiene una firma o un mint inventados", () => {
    const demoSection = readme.slice(
      readme.indexOf("## Demo tokens"),
      readme.indexOf("## Deploying")
    );
    // Nothing in the demo table may look like a real base58 address yet.
    expect(demoSection).not.toMatch(/\b[1-9A-HJ-NP-Za-km-z]{32,88}\b/);
  });
});

/*
 * RF-07.3 — the real mint address and at least one real airdrop signature in
 * the README. It cannot pass until "Bakery Cookie (BAKE)" is created on Cookie
 * Chain mainnet with real COOK, which is the one blocker no code can remove.
 * Kept as a visible reminder rather than deleted or faked green.
 */
describe.todo(
  "el README contiene un mint address y al menos una firma (RF-07.3, needs funded wallet)"
);
