import { describe, expect, it } from "vitest";
import {
  formatTokenAmount,
  formatTokenAmountWithSymbol,
  groupDigits,
} from "./tokenAmount";
import { fromBaseUnits } from "../token/bakeForm";
import { exportRunToCsv } from "../airdrop/exportCsv";
import type { AirdropRun } from "../../store/airdropHistory";

describe("formatTokenAmount", () => {
  it("agrupa la parte entera", () => {
    expect(formatTokenAmount(1_000_000_000n, 6)).toBe("1,000");
    expect(formatTokenAmount(1_234_567_890n, 6)).toBe("1,234.56789");
  });

  it("no agrupa la parte decimal", () => {
    // Grouping the fraction would invent separators inside it.
    expect(formatTokenAmount(1_000_000_123_456_789n, 9)).toBe(
      "1,000,000.123456789"
    );
  });

  it("no pierde dígitos por encima de 2^53", () => {
    // Intl.NumberFormat on the whole value would round this.
    const huge = 123_456_789_012_345_678_901n;
    const formatted = formatTokenAmount(huge, 0);

    expect(formatted).toBe("123,456,789,012,345,678,901");
    expect(formatted.replace(/,/g, "")).toBe(huge.toString());
  });

  it("mantiene cero como cero", () => {
    expect(formatTokenAmount(0n, 6)).toBe("0");
  });

  it("añade el símbolo solo cuando existe", () => {
    expect(formatTokenAmountWithSymbol(1_000_000n, 6, "BAKE")).toBe("1 BAKE");
    expect(formatTokenAmountWithSymbol(1_000_000n, 6, "")).toBe("1");
  });
});

describe("groupDigits", () => {
  it("devuelve la entrada intacta si no son solo dígitos", () => {
    expect(groupDigits("abc")).toBe("abc");
    expect(groupDigits("")).toBe("");
  });

  it("conserva el signo", () => {
    expect(groupDigits("-1234567")).toBe("-1,234,567");
  });
});

describe("la separación entre exacto y presentable", () => {
  it("fromBaseUnits sigue sin agrupar", () => {
    // The CSV export depends on this: a comma here would shift every column.
    expect(fromBaseUnits(1_000_000_000n, 6)).toBe("1000");
  });

  it("el CSV exportado no contiene separadores de miles", () => {
    const run: AirdropRun = {
      batches: [
        {
          index: 0,
          recipients: [{ address: "Addr1", amount: "1000000000" }],
          signature: "SIG",
          status: "confirmed",
        },
      ],
      decimals: 6,
      id: "r",
      mint: "M",
      startedAt: "2026-09-10T00:00:00.000Z",
      symbol: "BAKE",
    };

    const csv = exportRunToCsv(run);
    const [, row] = csv.split("\n");

    // Five fields, because the amount did not smuggle a comma in.
    expect(row.split(",")).toHaveLength(5);
    expect(row).toContain("1000");
    expect(row).not.toContain("1,000");
  });
});
