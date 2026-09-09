import { describe, expect, it, vi } from "vitest";
import { address, type ClientWithGetMinimumBalance } from "@solana/kit";
import { getMintSize } from "@solana-program/token-2022";
import {
  BAKE_SIGNATURE_COUNT,
  buildMintExtensions,
  canAfford,
  computeMintSpace,
  estimateBakeCost,
  LAMPORTS_PER_SIGNATURE,
  type MintExtensionOptions,
} from "./sizing";

const MINT = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const AUTHORITY = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function options(
  overrides: Partial<MintExtensionOptions> = {}
): MintExtensionOptions {
  return {
    authority: AUTHORITY,
    mint: MINT,
    mintCloseAuthority: false,
    name: "Bakery Cookie",
    symbol: "BAKE",
    transferFee: null,
    uri: "https://example.com/meta.json",
    ...overrides,
  };
}

/** Rent is ~6960 lamports per byte-year over 2 years, plus a 128-byte header. */
function fakeClient(): ClientWithGetMinimumBalance {
  return {
    getMinimumBalance: vi.fn(async (space: number) =>
      BigInt((space + 128) * 6960 * 2)
    ),
  } as unknown as ClientWithGetMinimumBalance;
}

describe("buildMintExtensions", () => {
  it("always includes the metadata pointer and the metadata itself", () => {
    const kinds = buildMintExtensions(options()).map((e) => e.__kind);
    expect(kinds).toContain("MetadataPointer");
    expect(kinds).toContain("TokenMetadata");
  });

  it("adds an entry per enabled advanced option", () => {
    const kinds = buildMintExtensions(
      options({
        mintCloseAuthority: true,
        transferFee: { basisPoints: 250, maximumFee: 1_000n },
      })
    ).map((e) => e.__kind);

    expect(kinds).toContain("TransferFeeConfig");
    expect(kinds).toContain("MintCloseAuthority");
  });

  it("points the metadata at the mint itself", () => {
    const metadata = buildMintExtensions(options()).find(
      (e) => e.__kind === "TokenMetadata"
    );
    expect(metadata).toMatchObject({ mint: MINT, name: "Bakery Cookie" });
  });
});

describe("computeMintSpace", () => {
  it("returns the bare 82-byte base for no extensions, not getMintSize([])", () => {
    // Regression guard: getMintSize([]) is 166 because an empty array still
    // encodes the TLV header. A classic SPL mint must be exactly 82 bytes.
    expect(getMintSize([])).toBe(166);
    expect(computeMintSpace([])).toEqual({ allocated: 82, rentBearing: 82 });
  });

  it("funds the metadata realloc beyond the allocated space", () => {
    const space = computeMintSpace(buildMintExtensions(options()));
    expect(space.rentBearing).toBeGreaterThan(space.allocated);
  });

  it("excludes TokenMetadata from the allocated size", () => {
    const extensions = buildMintExtensions(options());
    const preInitialize = extensions.filter(
      (e) => e.__kind !== "TokenMetadata"
    );
    expect(computeMintSpace(extensions).allocated).toBe(
      getMintSize(preInitialize)
    );
  });

  it("grows when TransferFeeConfig is enabled", () => {
    const plain = computeMintSpace(buildMintExtensions(options()));
    const withFee = computeMintSpace(
      buildMintExtensions(
        options({ transferFee: { basisPoints: 100, maximumFee: 1_000n } })
      )
    );
    expect(withFee.allocated).toBeGreaterThan(plain.allocated);
  });

  it("grows with a longer name and symbol", () => {
    const short = computeMintSpace(buildMintExtensions(options()));
    const long = computeMintSpace(
      buildMintExtensions(options({ name: "A".repeat(32) }))
    );
    expect(long.rentBearing).toBeGreaterThan(short.rentBearing);
  });
});

describe("estimateBakeCost", () => {
  it("sums mint rent, ATA rent and the fee", async () => {
    const client = fakeClient();
    const cost = await estimateBakeCost(client, buildMintExtensions(options()));

    expect(cost.ataSpace).toBe(165);
    expect(cost.fee).toBe(LAMPORTS_PER_SIGNATURE * BAKE_SIGNATURE_COUNT);
    expect(cost.total).toBe(cost.mintRent + cost.ataRent + cost.fee);
  });

  it("prices the mint at the rent-bearing size, not the allocated one", async () => {
    const client = fakeClient();
    const extensions = buildMintExtensions(options());
    const cost = await estimateBakeCost(client, extensions);

    expect(client.getMinimumBalance).toHaveBeenCalledWith(
      cost.space.rentBearing
    );
    expect(client.getMinimumBalance).not.toHaveBeenCalledWith(
      cost.space.allocated
    );
  });
});

describe("canAfford", () => {
  it("is exact at the boundary", async () => {
    const cost = await estimateBakeCost(
      fakeClient(),
      buildMintExtensions(options())
    );
    expect(canAfford(cost.total, cost)).toBe(true);
    expect(canAfford(cost.total - 1n, cost)).toBe(false);
  });
});
