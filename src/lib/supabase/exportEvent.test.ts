import { describe, expect, it } from "vitest";
import { toExportCsv, toExportJson } from "./exportEvent";

const BUNDLE = {
  draws: [
    {
      blockhash: "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG",
      commit: "aa".repeat(32),
      id: "draw-1",
      revealedSeed: "cc".repeat(32),
      targetSlot: 1_150,
      winners: ["00".repeat(32)],
    },
  ],
  entries: [
    {
      createdAt: "2026-09-10T00:00:00Z",
      id: "e1",
      walletAddress: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
  ],
  event: {
    mint: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    mintDecimals: 6,
    slug: "summer-jam",
    title: "Summer Jam",
  },
  payouts: [{ amount: "1000000", entryId: "e1", signature: "sig-1" }],
};

describe("toExportCsv", () => {
  it("no mete comas en un campo", () => {
    // Mismo razonamiento que exportCsv.ts del airdrop: agrupar millares
    // dentro de un CSV desplaza todas las columnas siguientes.
    const csv = toExportCsv(BUNDLE);
    expect(csv.split("\n")[1].split(",")).toHaveLength(
      csv.split("\n")[0].split(",").length
    );
  });

  it("lleva dirección, monto y firma por fila", () => {
    const csv = toExportCsv(BUNDLE);
    expect(csv).toContain("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    expect(csv).toContain("sig-1");
  });
});

describe("toExportJson", () => {
  it("incluye todo lo necesario para reconstruir y re-verificar el sorteo", () => {
    // La regla 4 del spec: exportable siempre, sin lock-in. Sin la semilla y
    // el blockhash, el export no permitiría re-verificar nada.
    const parsed = JSON.parse(toExportJson(BUNDLE));
    expect(parsed.draws[0].revealedSeed).toBe("cc".repeat(32));
    expect(parsed.draws[0].blockhash).toBeTruthy();
    expect(parsed.draws[0].commit).toBeTruthy();
    expect(parsed.draws[0].targetSlot).toBe(1_150);
  });
});
