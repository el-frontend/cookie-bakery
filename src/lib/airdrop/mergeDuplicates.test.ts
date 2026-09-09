import { describe, expect, it } from "vitest";
import { parseCsv } from "./parseCsv";
import { validateRows } from "./validateRows";
import { mergeDuplicates, mergedRowsOnly, totalOf } from "./mergeDuplicates";

const A = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function rowsOf(csv: string, decimals = 6) {
  return validateRows(parseCsv(csv).rows, decimals).valid;
}

describe("mergeDuplicates", () => {
  it("suma cantidades de la misma address", () => {
    const merged = mergeDuplicates(rowsOf(`${A},100\n${B},50\n${A},25`));

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ address: A, amount: 125_000_000n });
    expect(merged[1]).toMatchObject({ address: B, amount: 50_000_000n });
  });

  it("conserva las líneas de origen", () => {
    const merged = mergeDuplicates(rowsOf(`${A},100\n${B},50\n${A},25`));

    expect(merged[0].sourceLines).toEqual([1, 3]);
    expect(merged[0].line).toBe(1);
    expect(merged[1].sourceLines).toEqual([2]);
  });

  it("no altera filas únicas", () => {
    const rows = rowsOf(`${A},100\n${B},50`);
    const merged = mergeDuplicates(rows);

    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.amount)).toEqual(rows.map((r) => r.amount));
    expect(mergedRowsOnly(merged)).toHaveLength(0);
  });

  it("mantiene el orden del fichero", () => {
    const merged = mergeDuplicates(rowsOf(`${B},1\n${A},1\n${B},1`));
    expect(merged.map((r) => r.address)).toEqual([B, A]);
  });

  it("el total no cambia al fusionar", () => {
    const rows = rowsOf(`${A},100\n${B},50\n${A},25`);
    const before = rows.reduce((sum, r) => sum + r.amount, 0n);
    expect(totalOf(mergeDuplicates(rows))).toBe(before);
  });
});
