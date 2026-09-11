import { describe, expect, it } from "vitest";
import { parseCsv } from "../airdrop/parseCsv";
import { validateRows } from "../airdrop/validateRows";
import { hashEntry } from "./hashEntry";
import {
  selectionToRecipients,
  splitPool,
  toRecipients,
  type DrawnEntry,
} from "./toRecipients";

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

describe("toRecipients", () => {
  it("mapea hashes ganadores a direcciones con el mismo monto", () => {
    const all = entries();
    const winners = [all[0].hash, all[2].hash];
    expect(toRecipients(winners, all, 1_500_000n)).toEqual([
      { address: A, amount: 1_500_000n },
      { address: C, amount: 1_500_000n },
    ]);
  });

  it("conserva el orden en que salieron los ganadores", () => {
    const all = entries();
    const winners = [all[2].hash, all[0].hash];
    expect(toRecipients(winners, all, 1n).map((r) => r.address)).toEqual([
      C,
      A,
    ]);
  });

  it("falla si un hash ganador no está en la lista de entradas", () => {
    // Señal de que la lista congelada y los ganadores publicados no son del
    // mismo sorteo. Pagar aquí sería pagar a quien no tocaba.
    expect(() => toRecipients(["ff".repeat(32)], entries(), 1n)).toThrow(
      /unknown winner/i
    );
  });

  it("rechaza un monto de cero o negativo", () => {
    const all = entries();
    expect(() => toRecipients([all[0].hash], all, 0n)).toThrow(RangeError);
    expect(() => toRecipients([all[0].hash], all, -1n)).toThrow(RangeError);
  });

  it("rechaza una dirección que no es base58 válida", () => {
    const poisoned: DrawnEntry[] = [
      { entryId: "x", hash: "aa".repeat(32), walletAddress: "not-an-address" },
    ];
    expect(() => toRecipients(["aa".repeat(32)], poisoned, 1n)).toThrow(
      /not a valid/i
    );
  });

  it("produce filas que el validador del CSV acepta sin cambios", () => {
    // El evento y el CSV tienen que converger en el MISMO camino de
    // validación. Si divergen, una regla añadida al CSV no protegería al
    // evento.
    const all = entries();
    const recipients = toRecipients(
      [all[0].hash, all[1].hash],
      all,
      2_000_000n
    );

    const csv = recipients
      .map((r) => `${r.address},${r.amount.toString()}`)
      .join("\n");
    const result = validateRows(parseCsv(csv).rows, 0);

    expect(result.errors).toEqual([]);
    expect(result.valid.map((v) => v.address)).toEqual(
      recipients.map((r) => r.address)
    );
    expect(result.valid.map((v) => v.amount)).toEqual(
      recipients.map((r) => r.amount)
    );
  });
});

describe("selectionToRecipients", () => {
  it("pasa por monto por fila", () => {
    expect(
      selectionToRecipients([
        { amount: 10n, entryId: "a", walletAddress: A },
        { amount: 20n, entryId: "b", walletAddress: B },
      ])
    ).toEqual([
      { address: A, amount: 10n },
      { address: B, amount: 20n },
    ]);
  });

  it("rechaza una selección vacía", () => {
    expect(() => selectionToRecipients([])).toThrow(RangeError);
  });

  it("rechaza un duplicado en la selección", () => {
    // Dos filas para la misma wallet se enviarían como dos transferencias
    // separadas y el total dejaría de cuadrar con lo que se mostró.
    expect(() =>
      selectionToRecipients([
        { amount: 10n, entryId: "a", walletAddress: A },
        { amount: 20n, entryId: "b", walletAddress: A },
      ])
    ).toThrow(/duplicate/i);
  });
});

describe("splitPool", () => {
  it("reparte exacto cuando divide", () => {
    expect(splitPool(900n, 3)).toEqual([300n, 300n, 300n]);
  });

  it("no pierde ni inventa unidades base cuando no divide", () => {
    // La suma tiene que ser el bote exacto. Redondear por fila dejaría polvo
    // sin repartir o intentaría enviar más de lo que hay.
    const parts = splitPool(1_000n, 3);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(1_000n);
    expect(parts).toEqual([334n, 333n, 333n]);
  });

  it("rechaza un bote menor que el número de participantes", () => {
    expect(() => splitPool(2n, 3)).toThrow(RangeError);
  });

  it("rechaza cero participantes", () => {
    expect(() => splitPool(100n, 0)).toThrow(RangeError);
  });
});
