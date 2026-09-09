import { address, isAddress } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./parseCsv";
import { canExecute, validateRows } from "./validateRows";

const A = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const C = "ComputeBudget111111111111111111111111111111";

function check(csv: string, decimals = 6) {
  return validateRows(parseCsv(csv).rows, decimals);
}

describe("validateRows", () => {
  it("marca dirección base58 inválida con su línea", () => {
    const result = check(`${A},100\n0OIl1notbase58,50\n${B},25`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      issue: "invalid-address",
      line: 2,
    });
    expect(result.valid).toHaveLength(2);
  });

  it("rechaza cantidad 0 y negativa", () => {
    const zero = check(`${A},0`);
    expect(zero.errors[0].issue).toBe("amount-zero-or-negative");

    // A leading minus never parses as a positive decimal.
    const negative = check(`${A},-5`);
    expect(negative.errors[0].issue).toBe("amount-not-a-number");
  });

  it("rechaza más decimales de los del mint", () => {
    const result = check(`${A},1.1234567`, 6);
    expect(result.errors[0]).toMatchObject({
      issue: "amount-too-precise",
      line: 1,
    });
    expect(result.errors[0].message).toMatch(/6 decimals/);

    // The same amount is fine on a mint that carries the precision.
    expect(check(`${A},1.1234567`, 9).errors).toHaveLength(0);
  });

  it("señala duplicados apuntando a la primera aparición", () => {
    const result = check(`${A},100\n${B},50\n${A},25`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ issue: "duplicate", line: 3 });
    expect(result.errors[0].message).toMatch(/line 1/);
    expect(result.duplicates.get(address(A))).toEqual([1, 3]);
  });

  it("escala a unidades base sin coma flotante", () => {
    const result = check(`${A},1000000\n${B},0.5`, 6);
    expect(result.valid[0].amount).toBe(1_000_000_000_000n);
    expect(result.valid[1].amount).toBe(500_000n);
    expect(result.total).toBe(1_000_000_500_000n);
  });

  it("no pierde precisión en totales enormes", () => {
    // 1e9 tokens at 9 decimals, twice: past Number.MAX_SAFE_INTEGER.
    const result = check(`${A},1000000000\n${B},1000000000`, 9);
    expect(result.total).toBe(2_000_000_000_000_000_000n);
  });

  it("marca la línea a la que le falta un campo", () => {
    const result = check(`${A},100\n${C},`);
    expect(result.errors[0]).toMatchObject({ issue: "missing-field", line: 2 });
  });

  it("canExecute bloquea con errores y con lista vacía", () => {
    expect(canExecute(check(`${A},100`))).toBe(true);
    expect(canExecute(check(`${A},100\n${A},100`))).toBe(false);
    expect(canExecute(check(`${A},0`))).toBe(false);
  });

  it("valida 1000 filas en menos de 1s", () => {
    // AC-03.6. Real base58 addresses, varied in the tail so they stay
    // distinct and decode to 32 bytes.
    const alphabet =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const seen = new Set<string>();
    const rows: string[] = [];
    for (let i = 0; seen.size < 1000 && i < 200000; i++) {
      const tail =
        alphabet[i % 58] +
        alphabet[((i / 58) % 58) | 0] +
        alphabet[((i / 3364) % 58) | 0];
      const candidate = A.slice(0, -3) + tail;
      if (!isAddress(candidate) || seen.has(candidate)) continue;
      seen.add(candidate);
      rows.push(`${candidate},1.5`);
    }
    expect(rows).toHaveLength(1000);
    const csv = rows.join("\n");

    const parsed = parseCsv(csv);
    const started = performance.now();
    const result = validateRows(parsed.rows, 6);
    const elapsed = performance.now() - started;

    expect(result.valid.length + result.errors.length).toBe(1000);
    expect(elapsed).toBeLessThan(1000);
  });
});
