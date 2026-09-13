import { describe, expect, it } from "vitest";
import { hashEntry } from "./hashEntry";
import {
  canReveal,
  resolveWinnerEntryIds,
  targetSlotFor,
  TARGET_SLOT_LEAD,
} from "./runDraw";
import type { DrawnEntry } from "./toRecipients";

const EVENT = "11111111-2222-3333-4444-555555555555";
const A = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const C = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

function entries(): DrawnEntry[] {
  return [A, B, C].map((walletAddress, i) => ({
    entryId: `entry-${i}`,
    hash: hashEntry(EVENT, walletAddress),
    walletAddress,
  }));
}

describe("targetSlotFor", () => {
  it("apunta 150 slots por delante", () => {
    expect(targetSlotFor(1_000n)).toBe(1_000n + TARGET_SLOT_LEAD);
  });

  it("el slot objetivo nunca es el actual", () => {
    // Todo el arreglo del grinding depende de esto: si el objetivo fuera el
    // slot actual, el creador podría mirar el resultado antes de fijarlo.
    expect(targetSlotFor(1_000n)).toBeGreaterThan(1_000n);
  });
});

describe("canReveal", () => {
  it("no se puede revelar antes de que exista el slot objetivo", () => {
    expect(canReveal({ currentSlot: 1_100n, targetSlot: 1_150n })).toBe(false);
  });

  it("se puede revelar en cuanto la cadena alcanza el objetivo", () => {
    expect(canReveal({ currentSlot: 1_150n, targetSlot: 1_150n })).toBe(true);
    expect(canReveal({ currentSlot: 1_200n, targetSlot: 1_150n })).toBe(true);
  });
});

describe("resolveWinnerEntryIds", () => {
  it("mapea cada hash ganador de vuelta a su entry id, en orden", () => {
    const all = entries();
    const winners = [all[2].hash, all[0].hash];
    expect(resolveWinnerEntryIds(winners, all)).toEqual([
      all[2].entryId,
      all[0].entryId,
    ]);
  });

  it("falla si un hash ganador no está en la lista de entradas congelada", () => {
    // Señal de que la lista congelada y los ganadores publicados no son del
    // mismo sorteo. Pagar aquí sería pagar a quien no tocaba.
    expect(() => resolveWinnerEntryIds(["ff".repeat(32)], entries())).toThrow(
      /unknown winner/i
    );
  });
});
