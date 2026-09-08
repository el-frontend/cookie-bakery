import { describe, expect, it } from "vitest";
import { collectCodes, mapError, unwrapCause } from "./mapError";

/** Shapes copied from real failures observed against Cookie Chain. */
function solanaError(
  message: string,
  code: number,
  context: Record<string, unknown> = {},
  cause?: unknown
) {
  const e = new Error(message) as Error & {
    context: Record<string, unknown>;
    cause?: unknown;
  };
  e.name = "SolanaError";
  e.context = { __code: code, ...context };
  if (cause !== undefined) e.cause = cause;
  return e;
}

describe("unwrapCause", () => {
  it("desciende hasta la causa raíz", () => {
    const root = solanaError("root cause", 7050003);
    const mid = solanaError("middle", 11, {}, root);
    const top = solanaError("top", 11, {}, mid);
    expect(unwrapCause(top).message).toBe("root cause");
  });

  it("tolera un error sin cause", () => {
    expect(unwrapCause(new Error("flat")).message).toBe("flat");
  });

  it("no entra en bucle con causas circulares", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(() => unwrapCause(a)).not.toThrow();
  });
});

describe("collectCodes", () => {
  it("recoge los códigos de toda la cadena", () => {
    const root = solanaError("root", 7050003);
    const top = solanaError("top", 11, {}, root);
    expect(collectCodes(top)).toEqual([11, 7050003]);
  });
});

describe("mapError", () => {
  it("clasifica el rechazo de firma del usuario", () => {
    const e = new Error("User rejected the request.");
    const m = mapError(e);
    expect(m.kind).toBe("user-rejected");
    expect(m.retryable).toBe(false);
    expect(m.detail).toMatch(/Nothing was sent/);
  });

  it("el rechazo gana aunque venga envuelto en un SolanaError", () => {
    const inner = new Error("User denied transaction signature");
    const outer = solanaError("Failed to send transaction", 11, {}, inner);
    expect(mapError(outer).kind).toBe("user-rejected");
  });

  it("clasifica fondos insuficientes y adjunta el link al bridge", () => {
    // Exact shape seen on Cookie Chain with an unfunded wallet: the real cause
    // is nested two levels under the simulation wrapper.
    const root = solanaError(
      "Attempt to debit an account but found no record of a prior credit.",
      7050003
    );
    const mid = solanaError(
      "Transaction failed when it was simulated",
      11,
      {},
      root
    );
    const top = solanaError("Failed to send transaction", 11, {}, mid);

    const m = mapError(top);
    expect(m.kind).toBe("insufficient-funds");
    expect(m.action?.href).toBe("https://hyperlane.cookiescan.io");
    expect(m.action?.label).toMatch(/Bridge/);
  });

  it("clasifica blockhash caducado como reintentable", () => {
    // The failure that actually happened: missed by one block.
    const root = solanaError(
      "The network has progressed past the last block for which this transaction could have been committed.",
      1,
      { currentBlockHeight: 23578836n, lastValidBlockHeight: 23578835n }
    );
    const top = solanaError("Failed to send transaction", 11, {}, root);

    const m = mapError(top);
    expect(m.kind).toBe("blockhash-expired");
    expect(m.retryable).toBe(true);
  });

  it("distingue rpc caído de tx fallida", () => {
    const m = mapError(new TypeError("Failed to fetch"));
    expect(m.kind).toBe("rpc-unavailable");
    expect(m.retryable).toBe(true);
  });

  it("conserva los logs en program-error", () => {
    const root = solanaError("custom program error", 4615000, {
      logs: [
        "Program 1111 invoke [1]",
        "Program 1111 failed: An account required by the instruction is missing",
      ],
    });
    const m = mapError(solanaError("Failed to send transaction", 11, {}, root));
    expect(m.kind).toBe("program-error");
    expect(m.logs).toHaveLength(2);
    expect(m.logs?.[1]).toMatch(/missing/);
  });

  it("cae a unknown sin lanzar ante un error desconocido", () => {
    expect(mapError(undefined).kind).toBe("unknown");
    expect(mapError(null).kind).toBe("unknown");
    expect(mapError("just a string").kind).toBe("unknown");
    expect(mapError({}).kind).toBe("unknown");
  });

  it("nunca lanza, ni con un objeto hostil", () => {
    const hostile = {
      get cause() {
        throw new Error("boom");
      },
      get message() {
        throw new Error("boom");
      },
    };
    expect(() => mapError(hostile)).not.toThrow();
    expect(mapError(hostile).kind).toBe("unknown");
  });

  it("todo mapeo devuelve título y detalle no vacíos", () => {
    const samples = [
      new Error("User rejected"),
      solanaError("x", 1),
      solanaError("x", 7050003),
      new TypeError("Failed to fetch"),
      undefined,
    ];
    for (const s of samples) {
      const m = mapError(s);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.detail.length).toBeGreaterThan(0);
    }
  });
});
