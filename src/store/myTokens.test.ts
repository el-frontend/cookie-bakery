import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addMyToken,
  loadMyTokens,
  MY_TOKENS_KEY,
  MY_TOKENS_VERSION,
  saveMyTokens,
  type MyToken,
  type StorageLike,
} from "./myTokens";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } satisfies StorageLike;
}

function token(overrides: Partial<MyToken> = {}): MyToken {
  return {
    createdAt: "2026-09-08T00:00:00.000Z",
    decimals: 6,
    description: "",
    metadataUri: "",
    mint: "Mint1",
    name: "Bakery Cookie",
    program: "token-2022",
    signature: "Sig1",
    supply: "1000000000000",
    symbol: "BAKE",
    ...overrides,
  };
}

let storage: StorageLike;

beforeEach(() => {
  storage = memoryStorage();
});

describe("myTokens", () => {
  it("persists and re-reads a token", () => {
    saveMyTokens([token()], storage);
    expect(loadMyTokens(storage)).toEqual([token()]);
  });

  it("writes the versioned envelope", () => {
    saveMyTokens([token()], storage);
    const raw = storage.getItem(MY_TOKENS_KEY);
    expect(JSON.parse(raw as string)).toMatchObject({ v: MY_TOKENS_VERSION });
  });

  it("returns [] for corrupt JSON", () => {
    storage.setItem(MY_TOKENS_KEY, "{not json");
    expect(loadMyTokens(storage)).toEqual([]);
  });

  it("returns [] for an unknown schema version", () => {
    storage.setItem(
      MY_TOKENS_KEY,
      JSON.stringify({ tokens: [token()], v: 99 })
    );
    expect(loadMyTokens(storage)).toEqual([]);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadMyTokens(storage)).toEqual([]);
  });

  it("drops entries that do not match the shape", () => {
    storage.setItem(
      MY_TOKENS_KEY,
      JSON.stringify({
        tokens: [token(), { mint: 42 }, null, { ...token(), program: "nope" }],
        v: MY_TOKENS_VERSION,
      })
    );
    expect(loadMyTokens(storage)).toEqual([token()]);
  });

  it("does not duplicate the same mint, keeping the newest entry", () => {
    addMyToken(token(), storage);
    addMyToken(token({ mint: "Mint2", symbol: "TWO" }), storage);
    const list = addMyToken(token({ signature: "Sig2" }), storage);

    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ mint: "Mint1", signature: "Sig2" });
    expect(list[1].mint).toBe("Mint2");
  });

  it("degrades to a no-op when storage is unavailable", () => {
    expect(loadMyTokens(null)).toEqual([]);
    expect(() => saveMyTokens([token()], null)).not.toThrow();
    expect(addMyToken(token(), null)).toEqual([token()]);
  });

  it("survives a storage that throws on write", () => {
    const throwing = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    } satisfies StorageLike;

    expect(() => saveMyTokens([token()], throwing)).not.toThrow();
    expect(throwing.setItem).toHaveBeenCalled();
  });
});
