import { describe, expect, it } from "vitest";
import { parseBaseUnits, registrationOutcome } from "./events";

describe("parseBaseUnits", () => {
  it("convierte el string de numeric a bigint sin pasar por Number", () => {
    // supabase-js devuelve numeric(39,0) como string. Con Number, cualquier
    // supply grande a 9 decimales pierde precisión pasados los 2^53.
    expect(parseBaseUnits("1000000000000000000")).toBe(
      1_000_000_000_000_000_000n
    );
  });

  it("sobrevive a un valor por encima de 2^53", () => {
    const huge = "9007199254740993"; // 2^53 + 1
    expect(parseBaseUnits(huge)).toBe(9_007_199_254_740_993n);
    expect(parseBaseUnits(huge).toString()).toBe(huge);
  });

  it("rechaza algo que no es un entero", () => {
    expect(() => parseBaseUnits("1.5")).toThrow(RangeError);
    expect(() => parseBaseUnits("abc")).toThrow(RangeError);
  });

  it("rechaza null", () => {
    expect(() => parseBaseUnits(null)).toThrow(RangeError);
  });
});

describe("registrationOutcome", () => {
  it("traduce la violación de unicidad a 'already-registered'", () => {
    // Sin política de SELECT para anon no podemos consultar antes de insertar,
    // así que el error de la restricción ES la comprobación.
    expect(
      registrationOutcome({ code: "23505", message: "duplicate key" })
    ).toBe("already-registered");
  });

  it("deja pasar el resto de errores", () => {
    expect(() =>
      registrationOutcome({ code: "42501", message: "permission denied" })
    ).toThrow(/permission denied/);
  });

  it("sin error es 'ok'", () => {
    expect(registrationOutcome(null)).toBe("ok");
  });
});
