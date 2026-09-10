import { describe, expect, it } from "vitest";
import { getAddressDecoder, type Address } from "@solana/kit";
import type { Holder } from "./holders";
import { buildDistribution, concentration, TOP_N } from "./distribution";

const decoder = getAddressDecoder();
function seeded(seed: number): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = 3;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return decoder.decode(bytes);
}

function holder(seed: number, amount: bigint): Holder {
  return {
    account: seeded(seed + 100),
    amount,
    owner: seeded(seed),
    percent: 0,
  };
}

/** `count` holders each holding `each` base units. */
function holders(count: number, each: bigint): Holder[] {
  return Array.from({ length: count }, (_, i) => holder(i, each));
}

describe("buildDistribution", () => {
  it("otros = supply menos el top 10", () => {
    // 12 holders of 10 each = 120; supply 200. Top 10 hold 100, so Others = 100.
    const supply = 200n;
    const slices = buildDistribution(holders(12, 10n), supply);

    expect(slices).toHaveLength(TOP_N + 1);
    const others = slices[slices.length - 1];
    expect(others?.isOthers).toBe(true);
    expect(others?.amount).toBe(100n);
    expect(others?.percent).toBe(50);

    // Every slice accounted for, nothing invented.
    const total = slices.reduce((sum, s) => sum + s.amount, 0n);
    expect(total).toBe(supply);
  });

  it("con menos de 10 holders no genera segmento otros", () => {
    // Three holders who between them hold the entire supply.
    const slices = buildDistribution(
      [holder(0, 50n), holder(1, 30n), holder(2, 20n)],
      100n
    );

    expect(slices).toHaveLength(3);
    expect(slices.some((s) => s.isOthers)).toBe(false);
    expect(slices.map((s) => s.percent)).toEqual([50, 30, 20]);
  });

  it("no produce porcentajes negativos", () => {
    // The supply and the holder list are two reads at two different slots, so
    // the holders can legitimately add up to more than the supply.
    const slices = buildDistribution([holder(0, 500n), holder(1, 400n)], 100n);

    expect(slices.some((s) => s.isOthers)).toBe(false);
    for (const slice of slices) {
      expect(slice.percent).toBeGreaterThanOrEqual(0);
      expect(slice.amount).toBeGreaterThanOrEqual(0n);
    }
  });

  it("omite otros cuando el top 10 cubre el supply exactamente", () => {
    const slices = buildDistribution(holders(TOP_N, 10n), 100n);

    expect(slices).toHaveLength(TOP_N);
    expect(slices.some((s) => s.isOthers)).toBe(false);
  });

  it("ordena descendente aunque la entrada llegue desordenada", () => {
    const slices = buildDistribution(
      [holder(0, 1n), holder(1, 999n), holder(2, 50n)],
      1_050n
    );

    expect(slices.map((s) => s.amount)).toEqual([999n, 50n, 1n]);
  });

  it("no pasa por number con supplies mayores que 2^53", () => {
    const supply = 1_000_000_000_000_000_000n; // 1e18
    const slices = buildDistribution([holder(0, supply / 2n)], supply);

    expect(slices[0].percent).toBe(50);
    expect(slices[1].amount).toBe(supply / 2n);
    expect(slices[1].percent).toBe(50);
  });

  it("tolera una lista de holders vacía", () => {
    const slices = buildDistribution([], 100n);

    // The whole supply is unaccounted for, which is exactly "Others".
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ isOthers: true, percent: 100 });
  });

  it("etiqueta por owner y cae a la cuenta si no lo hay", () => {
    const anonymous: Holder = {
      account: seeded(77),
      amount: 5n,
      owner: null,
      percent: 0,
    };
    const slices = buildDistribution([anonymous], 5n);

    expect(slices[0].key).toBe(anonymous.account);
    expect(slices[0].label).toContain("…");
  });

  it("da a cada slice una clave estable y única", () => {
    const slices = buildDistribution(holders(12, 10n), 200n);
    const keys = slices.map((s) => s.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("concentration", () => {
  it("resume lo que acumula el top 10", () => {
    // 10 holders of 98 = 980 of a 1000 supply.
    expect(concentration(holders(10, 98n), 1_000n)).toBe(98);
  });

  it("nunca pasa de 100 aunque los datos estén desfasados", () => {
    expect(concentration([holder(0, 5_000n)], 100n)).toBe(100);
  });

  it("es 0 con supply cero en lugar de NaN", () => {
    expect(concentration([holder(0, 10n)], 0n)).toBe(0);
  });
});
