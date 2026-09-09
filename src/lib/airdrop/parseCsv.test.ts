import { describe, expect, it } from "vitest";
import { CsvError, MAX_ROWS, parseCsv } from "./parseCsv";

const A = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("parseCsv", () => {
  it("detecta cabecera opcional", () => {
    const withHeader = parseCsv(`address,amount\n${A},100\n${B},200`);
    expect(withHeader.hasHeader).toBe(true);
    expect(withHeader.rows).toHaveLength(2);

    const without = parseCsv(`${A},100\n${B},200`);
    expect(without.hasHeader).toBe(false);
    expect(without.rows).toHaveLength(2);
  });

  it("no confunde una primera fila real con una cabecera", () => {
    const parsed = parseCsv(`${A},100`);
    expect(parsed.hasHeader).toBe(false);
    expect(parsed.rows[0].rawAddress).toBe(A);
  });

  it("no se traga una primera fila con datos equivocados", () => {
    // Regression: an amount typo on line 1 used to be swallowed as a header,
    // making that recipient vanish instead of reaching the error table.
    const badAmount = parseCsv(`${A},-5\n${B},10`);
    expect(badAmount.hasHeader).toBe(false);
    expect(badAmount.rows).toHaveLength(2);
    expect(badAmount.rows[0].rawAmount).toBe("-5");

    // Same for a typo'd address, as long as the amount still reads as one.
    const badAddress = parseCsv(`notanaddress,100\n${B},10`);
    expect(badAddress.hasHeader).toBe(false);
    expect(badAddress.rows[0].rawAddress).toBe("notanaddress");
  });

  it("acepta ; como separador", () => {
    const parsed = parseCsv(`${A};100\n${B};200`);
    expect(parsed.separator).toBe(";");
    expect(parsed.rows[1]).toMatchObject({ rawAddress: B, rawAmount: "200" });
  });

  it("ignora líneas vacías y CRLF", () => {
    const parsed = parseCsv(`\r\n${A},100\r\n\r\n${B},200\r\n`);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].rawAmount).toBe("100");
    expect(parsed.rows[1].rawAmount).toBe("200");
  });

  it("conserva el número de línea original para señalar errores", () => {
    // Blank lines and the header still consume line numbers.
    const parsed = parseCsv(`address,amount\n\n${A},100\n\n${B},200`);
    expect(parsed.rows.map((r) => r.line)).toEqual([3, 5]);
  });

  it("recorta espacios sobrantes", () => {
    const parsed = parseCsv(`  ${A}  ,  100  `);
    expect(parsed.rows[0]).toMatchObject({ rawAddress: A, rawAmount: "100" });
  });

  it("falla por encima de 1000 filas", () => {
    const ok = Array.from({ length: MAX_ROWS }, () => `${A},1`).join("\n");
    expect(parseCsv(ok).rows).toHaveLength(MAX_ROWS);

    const tooMany = `${ok}\n${A},1`;
    expect(() => parseCsv(tooMany)).toThrow(CsvError);
    expect(() => parseCsv(tooMany)).toThrow(/more than 1000/);
  });

  it("falla legible sin separador, vacío, o con cabecera sola", () => {
    expect(() => parseCsv("just-one-field")).toThrow(/separated by/);
    expect(() => parseCsv("   \n  ")).toThrow(/at least one line/);
    expect(() => parseCsv("address,amount")).toThrow(/no recipients/);
  });
});
