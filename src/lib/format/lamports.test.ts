import { lamports } from "@solana/kit";
import { describe, expect, it } from "vitest";
import { formatCook, formatCookWithSymbol } from "./lamports";

// Fixed locale so the assertions do not depend on the machine's default.
const EN = new Intl.NumberFormat("en-US", { maximumFractionDigits: 9 });

describe("formatCook", () => {
  it("formatea 9 decimales sin perder precisión en balances grandes", () => {
    // 9,007,199.254740993 COOK — one lamport past Number.MAX_SAFE_INTEGER,
    // which is exactly where float division starts lying.
    const amount = lamports(9007199254740993n);
    expect(formatCook(amount, EN)).toBe("9,007,199.254740993");
    expect(formatCook(amount, EN)).not.toBe("9,007,199.254740992");
  });

  it("no usa aritmética de punto flotante", () => {
    // Number(2n ** 63n - 1n) / 1e9 loses the tail entirely; the fixed-point
    // path must keep every digit.
    const huge = lamports(9223372036854775807n);
    expect(formatCook(huge, EN)).toBe("9,223,372,036.854775807");
  });

  it("formatea cero y cantidades pequeñas", () => {
    expect(formatCook(lamports(0n), EN)).toBe("0");
    expect(formatCook(lamports(1n), EN)).toBe("0.000000001");
  });

  it("añade el símbolo COOK", () => {
    expect(formatCookWithSymbol(lamports(1500000000n), EN)).toBe("1.5 COOK");
  });
});
