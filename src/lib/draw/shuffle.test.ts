import { describe, expect, it } from "vitest";
import { DrawRandom, finalSeed, pickWinners, shuffle } from "./shuffle";

const SEED = new Uint8Array(32).fill(7);
const BLOCKHASH = "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG";

function hashes(n: number): string[] {
  return Array.from({ length: n }, (_, i) => i.toString(16).padStart(64, "0"));
}

describe("finalSeed", () => {
  it("mezcla semilla y blockhash en 32 bytes", () => {
    expect(finalSeed(SEED, BLOCKHASH)).toHaveLength(32);
  });

  it("cambia si cambia el blockhash", () => {
    const a = finalSeed(SEED, BLOCKHASH);
    const b = finalSeed(SEED, BLOCKHASH.replace(/.$/, "H"));
    expect(a).not.toEqual(b);
  });

  it("cambia si cambia un solo bit de la semilla", () => {
    const other = new Uint8Array(SEED);
    other[31] ^= 0x01;
    expect(finalSeed(SEED, BLOCKHASH)).not.toEqual(finalSeed(other, BLOCKHASH));
  });
});

describe("DrawRandom.below", () => {
  it("siempre cae dentro del rango", () => {
    const rng = new DrawRandom(finalSeed(SEED, BLOCKHASH));
    for (let i = 0; i < 2000; i++) {
      const v = rng.below(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("rechaza n <= 0", () => {
    const rng = new DrawRandom(finalSeed(SEED, BLOCKHASH));
    expect(() => rng.below(0)).toThrow(RangeError);
  });

  it("no tiene sesgo detectable con n que no es potencia de dos", () => {
    // La prueba que atrapa un `% n` directo en lugar del rechazo por
    // muestreo. Con 2^32 no divisible por 7, el módulo crudo favorece los
    // primeros restos, y un sorteo sesgado no es un sorteo justo.
    const counts = new Array(7).fill(0);
    const rng = new DrawRandom(finalSeed(SEED, BLOCKHASH));
    const draws = 70_000;
    for (let i = 0; i < draws; i++) counts[rng.below(7)]++;

    const expected = draws / 7;
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });
});

describe("shuffle", () => {
  it("conserva exactamente los mismos elementos", () => {
    const input = hashes(20);
    const out = shuffle(input, new DrawRandom(finalSeed(SEED, BLOCKHASH)));
    expect([...out].sort()).toEqual([...input].sort());
  });

  it("no muta la entrada", () => {
    const input = hashes(5);
    const copy = [...input];
    shuffle(input, new DrawRandom(finalSeed(SEED, BLOCKHASH)));
    expect(input).toEqual(copy);
  });

  it("reordena de verdad", () => {
    const input = hashes(30);
    const out = shuffle(input, new DrawRandom(finalSeed(SEED, BLOCKHASH)));
    expect(out).not.toEqual(input);
  });
});

describe("pickWinners", () => {
  it("es golden: misma semilla y mismas entradas dan los mismos ganadores", () => {
    const list = hashes(50);
    const first = pickWinners(list, 5, SEED, BLOCKHASH);
    const second = pickWinners(list, 5, SEED, BLOCKHASH);
    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
  });

  it("un bit distinto en la semilla cambia el resultado", () => {
    const list = hashes(50);
    const other = new Uint8Array(SEED);
    other[0] ^= 0x01;
    expect(pickWinners(list, 5, SEED, BLOCKHASH)).not.toEqual(
      pickWinners(list, 5, other, BLOCKHASH)
    );
  });

  it("un blockhash distinto cambia el resultado", () => {
    const list = hashes(50);
    expect(pickWinners(list, 5, SEED, BLOCKHASH)).not.toEqual(
      pickWinners(list, 5, SEED, BLOCKHASH.replace(/.$/, "H"))
    );
  });

  it("devuelve ganadores únicos", () => {
    const winners = pickWinners(hashes(40), 10, SEED, BLOCKHASH);
    expect(new Set(winners).size).toBe(10);
  });

  it("nunca devuelve más ganadores que participantes", () => {
    const winners = pickWinners(hashes(3), 10, SEED, BLOCKHASH);
    expect(winners).toHaveLength(3);
  });

  it("rechaza una lista vacía", () => {
    expect(() => pickWinners([], 1, SEED, BLOCKHASH)).toThrow(RangeError);
  });

  it("no depende del orden en que llegue la lista", () => {
    // El sorteo ordena canónicamente antes de mezclar, así que dos servidores
    // con la misma lista en distinto orden obtienen los mismos ganadores.
    const list = hashes(25);
    const reversed = [...list].reverse();
    expect(pickWinners(list, 4, SEED, BLOCKHASH)).toEqual(
      pickWinners(reversed, 4, SEED, BLOCKHASH)
    );
  });
});
