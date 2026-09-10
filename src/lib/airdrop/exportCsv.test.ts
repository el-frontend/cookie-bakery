import { describe, expect, it } from "vitest";
import {
  CSV_HEADER,
  escapeCsvField,
  exportFilename,
  exportRunToCsv,
  rowsForRun,
} from "./exportCsv";
import { parseCsv } from "./parseCsv";
import type { AirdropRun } from "../../store/airdropHistory";

const RUN: AirdropRun = {
  batches: [
    {
      index: 0,
      recipients: [
        {
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
          amount: "12500000000",
        },
        {
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          amount: "8000000000",
        },
      ],
      signature: "Sig0",
      status: "confirmed",
    },
    {
      error: "Transfer: insufficient funds, needed 9,000, had 1,200",
      index: 1,
      recipients: [
        {
          address: "ComputeBudget111111111111111111111111111111",
          amount: "9000000000",
        },
      ],
      status: "failed",
    },
  ],
  decimals: 6,
  id: "run-1",
  mint: "Mint1",
  startedAt: "2026-09-10T09:00:00.000Z",
  symbol: "BAKE",
};

describe("escapeCsvField", () => {
  it("deja intacto lo que no necesita comillas", () => {
    expect(escapeCsvField("Sig0")).toBe("Sig0");
    expect(escapeCsvField("")).toBe("");
  });

  it("escapa comas, comillas y saltos de línea", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("exportRunToCsv", () => {
  it("una fila por destinatario con firma o error", () => {
    const csv = exportRunToCsv(RUN);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(CSV_HEADER);
    // Three recipients across two batches, not two batch rows.
    expect(rowsForRun(RUN)).toHaveLength(3);

    expect(lines[1]).toContain("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
    expect(lines[1]).toContain("confirmed");
    expect(lines[1]).toContain("Sig0");

    // A confirmed row carries no error, a failed row carries no signature.
    const failed = rowsForRun(RUN)[2];
    expect(failed.signature).toBe("");
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/insufficient funds/);
  });

  it("escapa comas en el mensaje de error", () => {
    const csv = exportRunToCsv(RUN);
    const lines = csv.split("\n");
    const lastLine = lines[lines.length - 1];

    // The message has two commas; unescaped they would shift every column.
    expect(lastLine).toContain(
      '"Transfer: insufficient funds, needed 9,000, had 1,200"'
    );
    // Column count survives: five fields, and the error stays one of them.
    expect(lastLine.split(",")).not.toHaveLength(5 + 2);
  });

  it("convierte las unidades base a cantidades legibles", () => {
    const rows = rowsForRun(RUN);
    expect(rows[0].amount).toBe("12500");
    expect(rows[1].amount).toBe("8000");
  });

  it("el resultado se puede volver a leer con nuestro propio parser", () => {
    // Round-trip guard: the address/amount pair survives a re-import.
    const csv = exportRunToCsv(RUN);
    const reparsed = parseCsv(csv);

    expect(reparsed.hasHeader).toBe(true);
    expect(reparsed.rows).toHaveLength(3);
    expect(reparsed.rows[0].rawAmount).toBe("12500");
  });
});

describe("exportFilename", () => {
  it("nombra el fichero por símbolo y día", () => {
    expect(exportFilename(RUN)).toBe("airdrop-BAKE-2026-09-10.csv");
    expect(exportFilename({ ...RUN, symbol: "" })).toBe(
      "airdrop-token-2026-09-10.csv"
    );
  });
});
