import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { canonicalOrder, entriesRoot } from "./hashEntry";
import { pickWinners } from "./shuffle";
import { verifyDraw, type PublishedDraw } from "./verifyDraw";

const SEED = new Uint8Array(32).fill(11);
const BLOCKHASH = "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG";

function goodDraw(): PublishedDraw {
  const raw = Array.from({ length: 12 }, (_, i) =>
    i.toString(16).padStart(64, "0")
  );
  const ordered = canonicalOrder(raw);
  return {
    blockhash: BLOCKHASH,
    commit: bytesToHex(sha256(SEED)),
    commitSlot: 1_000,
    entriesRoot: entriesRoot(ordered),
    entryHashes: ordered,
    revealedSeed: bytesToHex(SEED),
    targetSlot: 1_150,
    winners: pickWinners(ordered, 3, SEED, BLOCKHASH),
    winnersCount: 3,
  };
}

describe("verifyDraw", () => {
  it("acepta un sorteo bien formado", () => {
    expect(verifyDraw(goodDraw())).toEqual({ ok: true });
  });

  it("rechaza un commit que no es el hash de la semilla revelada", () => {
    const draw = { ...goodDraw(), commit: "00".repeat(32) };
    const result = verifyDraw(draw);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain("commit-mismatch");
  });

  it("rechaza un commit que no precede al slot objetivo", () => {
    // El único reloj de confianza del sistema: si el commit pudo escribirse
    // sabiendo ya la entropía, la semilla no estaba comprometida de antemano.
    const draw = { ...goodDraw(), commitSlot: 1_150 };
    const result = verifyDraw(draw);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain(
      "commit-not-before-target"
    );
  });

  it("rechaza una raíz que no cuadra con la lista", () => {
    const draw = { ...goodDraw(), entriesRoot: "00".repeat(32) };
    const result = verifyDraw(draw);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain("root-mismatch");
  });

  it("rechaza una lista que no viene en orden canónico", () => {
    const base = goodDraw();
    const reversed = [...base.entryHashes].reverse();
    const draw = {
      ...base,
      entriesRoot: entriesRoot(reversed),
      entryHashes: reversed,
    };
    const result = verifyDraw(draw);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain(
      "not-canonical-order"
    );
  });

  it("rechaza un ganador sustituido", () => {
    const base = goodDraw();
    const tampered = [...base.winners];
    tampered[0] = base.entryHashes.find((h) => !base.winners.includes(h))!;
    const result = verifyDraw({ ...base, winners: tampered });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain(
      "winners-mismatch"
    );
  });

  it("rechaza un blockhash cambiado", () => {
    const draw = { ...goodDraw(), blockhash: BLOCKHASH.replace(/.$/, "H") };
    const result = verifyDraw(draw);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain(
      "winners-mismatch"
    );
  });

  it("rechaza un número de ganadores que no coincide con el anunciado", () => {
    const base = goodDraw();
    const result = verifyDraw({ ...base, winnersCount: 5 });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failures).toContain(
      "winners-count-mismatch"
    );
  });

  it("acumula todos los fallos, no solo el primero", () => {
    const draw = {
      ...goodDraw(),
      commit: "00".repeat(32),
      entriesRoot: "11".repeat(32),
    };
    const result = verifyDraw(draw);
    expect(result.ok === false && result.failures.length).toBeGreaterThan(1);
  });
});
