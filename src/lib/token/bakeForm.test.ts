import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAKE_FORM,
  isBakeFormValid,
  toBaseUnits,
  validateBakeForm,
  type BakeFormValues,
} from "./bakeForm";

const VALID: BakeFormValues = {
  ...DEFAULT_BAKE_FORM,
  name: "Bakery Cookie",
  symbol: "BAKE",
};

describe("toBaseUnits", () => {
  it("convierte sin punto flotante en supplies enormes", () => {
    // 1e9 tokens with 9 decimals = 1e18 base units, far past Number's limit.
    expect(toBaseUnits("1000000000", 9)).toBe(1_000_000_000_000_000_000n);
  });

  it("respeta los decimales fraccionarios", () => {
    expect(toBaseUnits("1.5", 6)).toBe(1_500_000n);
    expect(toBaseUnits("0.000001", 6)).toBe(1n);
  });

  it("rechaza más decimales de los permitidos", () => {
    expect(() => toBaseUnits("1.1234567", 6)).toThrow(/decimal places/);
  });

  it("rechaza entradas no numéricas", () => {
    expect(() => toBaseUnits("abc", 6)).toThrow(RangeError);
    expect(() => toBaseUnits("-5", 6)).toThrow(RangeError);
    expect(() => toBaseUnits("", 6)).toThrow(RangeError);
  });
});

describe("validateBakeForm", () => {
  it("acepta un formulario válido", () => {
    expect(validateBakeForm(VALID)).toEqual({});
    expect(isBakeFormValid(VALID)).toBe(true);
  });

  it("rechaza nombre de 33 caracteres", () => {
    const errors = validateBakeForm({ ...VALID, name: "x".repeat(33) });
    expect(errors.name).toMatch(/32 characters or fewer/);
    // Boundary: exactly 32 is fine.
    expect(
      validateBakeForm({ ...VALID, name: "x".repeat(32) }).name
    ).toBeUndefined();
  });

  it("rechaza símbolo de 11", () => {
    expect(
      validateBakeForm({ ...VALID, symbol: "x".repeat(11) }).symbol
    ).toMatch(/10 characters or fewer/);
    expect(
      validateBakeForm({ ...VALID, symbol: "x".repeat(10) }).symbol
    ).toBeUndefined();
  });

  it("exige nombre y símbolo no vacíos", () => {
    const errors = validateBakeForm({ ...VALID, name: "   ", symbol: "" });
    expect(errors.name).toMatch(/required/);
    expect(errors.symbol).toMatch(/required/);
  });

  it("rechaza decimales 10 y -1", () => {
    expect(validateBakeForm({ ...VALID, decimals: 10 }).decimals).toMatch(
      /between 0 and 9/
    );
    expect(validateBakeForm({ ...VALID, decimals: -1 }).decimals).toMatch(
      /between 0 and 9/
    );
    expect(validateBakeForm({ ...VALID, decimals: 1.5 }).decimals).toMatch(
      /whole number/
    );
  });

  it("rechaza supply 0", () => {
    expect(validateBakeForm({ ...VALID, supply: "0" }).supply).toMatch(
      /greater than 0/
    );
  });

  it("rechaza uri http:// no https", () => {
    expect(
      validateBakeForm({ ...VALID, metadataUri: "http://example.com/m.json" })
        .metadataUri
    ).toMatch(/https/);
    expect(
      validateBakeForm({ ...VALID, metadataUri: "data:application/json,{}" })
        .metadataUri
    ).toMatch(/https/);
  });

  it("acepta uri https y la trata como opcional", () => {
    expect(
      validateBakeForm({ ...VALID, metadataUri: "https://example.com/m.json" })
        .metadataUri
    ).toBeUndefined();
    expect(
      validateBakeForm({ ...VALID, metadataUri: "" }).metadataUri
    ).toBeUndefined();
  });

  it("no reporta supply cuando los decimales ya son inválidos", () => {
    // Avoids a confusing cascade: fix the decimals first.
    const errors = validateBakeForm({ ...VALID, decimals: 99, supply: "1.5" });
    expect(errors.decimals).toBeDefined();
    expect(errors.supply).toBeUndefined();
  });
});
