import { describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  loadChainConfig,
  parseChainIdentifier,
  type RawEnv,
} from "./config";

const VALID: RawEnv = {
  VITE_BRIDGE_URL: "https://hyperlane.cookiescan.io",
  VITE_DAS_URL: "https://api.cookiescan.io",
  VITE_EXPLORER_URL: "https://cookiescan.io",
  VITE_RPC_URL: "https://rpc.cookiescan.io",
  VITE_WALLET_CHAIN: "solana:mainnet",
};

describe("loadChainConfig", () => {
  it("lanza si falta VITE_RPC_URL", () => {
    const env = { ...VALID, VITE_RPC_URL: undefined };
    expect(() => loadChainConfig(env)).toThrow(ConfigError);
    expect(() => loadChainConfig(env)).toThrow(/VITE_RPC_URL/);
  });

  it("trata una variable en blanco como ausente", () => {
    expect(() => loadChainConfig({ ...VALID, VITE_DAS_URL: "   " })).toThrow(
      /VITE_DAS_URL/
    );
  });

  it("rechaza una url malformada", () => {
    expect(() =>
      loadChainConfig({ ...VALID, VITE_EXPLORER_URL: "cookiescan" })
    ).toThrow(/not a valid URL/);
  });

  it("normaliza las urls quitando la barra final", () => {
    const config = loadChainConfig({
      ...VALID,
      VITE_EXPLORER_URL: "https://cookiescan.io/",
    });
    expect(config.explorerUrl).toBe("https://cookiescan.io");
  });

  it("devuelve las cinco claves cuando el entorno es válido", () => {
    expect(loadChainConfig(VALID)).toEqual({
      bridgeUrl: "https://hyperlane.cookiescan.io",
      chain: "solana:mainnet",
      dasUrl: "https://api.cookiescan.io",
      explorerUrl: "https://cookiescan.io",
      rpcUrl: "https://rpc.cookiescan.io",
    });
  });
});

describe("parseChainIdentifier", () => {
  it("rechaza un chain id sin namespace", () => {
    expect(() => parseChainIdentifier("mainnet")).toThrow(ConfigError);
    expect(() => parseChainIdentifier("mainnet")).toThrow(
      /namespace:reference/
    );
  });

  it("rechaza un chain id con espacios o segmentos de más", () => {
    expect(() => parseChainIdentifier("solana: mainnet")).toThrow(ConfigError);
    expect(() => parseChainIdentifier("solana:main:net")).toThrow(ConfigError);
  });

  it("acepta un chain id personalizado no solana", () => {
    // El tipo instalado es `SolanaChain | (IdentifierString & {})`: cualquier
    // `namespace:reference` es válido. Cookie Chain podría anunciar el suyo.
    const warn = vi.fn();
    expect(parseChainIdentifier("cookie:mainnet", warn)).toBe("cookie:mainnet");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/filtered out of discovery/);
  });

  it("acepta el chain id resuelto en el spike", () => {
    // RF-01.1: la spike enumeró el registro Wallet Standard crudo en Chrome.
    // Nightly anuncia solana:mainnet | mainnet-beta | testnet | devnet para
    // Solana, y NINGUNA wallet anuncia un identificador propio de Cookie Chain.
    // solana:mainnet es además el único que comparten Phantom, MetaMask, OKX y
    // Nightly: mainnet-beta solo lo anuncia Nightly y filtraría al resto.
    const warn = vi.fn();
    expect(parseChainIdentifier("solana:mainnet", warn)).toBe("solana:mainnet");
    expect(warn).not.toHaveBeenCalled();
  });

  it("no avisa para un namespace solana", () => {
    const warn = vi.fn();
    expect(parseChainIdentifier("solana:devnet", warn)).toBe("solana:devnet");
    expect(warn).not.toHaveBeenCalled();
  });
});
