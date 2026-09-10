import { describe, expect, it, vi } from "vitest";
import {
  address,
  createNoopSigner,
  getAddressDecoder,
  type Address,
} from "@solana/kit";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { SOLANA_ERROR_CODES } from "../errors/types";
import type { BuildAirdropInput, Recipient } from "./buildPlan";
import type { AtaProbe } from "./probeAtas";
import {
  createAirdropRunner,
  runProgress,
  splitIntoBatches,
  toStoredBatch,
  type TransferBatch,
} from "./executor";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const SOURCE = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const AUTHORITY = createNoopSigner(
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
);

/**
 * Distinct addresses built from bytes rather than hand-written base58, so a
 * batch of N recipients has N different owners and N different accounts and
 * every one of them survives `address()`.
 */
const addressDecoder = getAddressDecoder();

function fakeAddress(seed: number, salt: number): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = salt;
  bytes[1] = seed & 0xff;
  bytes[2] = (seed >> 8) & 0xff;
  return addressDecoder.decode(bytes);
}

function makeInput(count: number, existsEvery = 1): BuildAirdropInput {
  const recipients: Recipient[] = [];
  const probes: AtaProbe[] = [];

  for (let i = 0; i < count; i++) {
    const owner = fakeAddress(i, 1);
    const ata = fakeAddress(i, 2);
    recipients.push({ address: owner, amount: BigInt(i + 1) * 1_000n });
    probes.push({ ata, exists: i % existsEvery === 0, owner });
  }

  return {
    authority: AUTHORITY,
    decimals: 6,
    mint: MINT,
    probes,
    recipients,
    source: SOURCE,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  };
}

/** Batches without instructions — the runner only ever passes them through. */
function fakeBatches(count: number): TransferBatch[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    instructions: [],
    newAtas: 0,
    recipients: [{ address: fakeAddress(index, 1), amount: 1_000n }],
  }));
}

/** The error the chain returns when the blockhash window has passed. */
function expiredBlockhash(): Error {
  return Object.assign(new Error("Blockhash expired"), {
    context: { __code: SOLANA_ERROR_CODES.BLOCKHASH_EXPIRED },
    name: "SolanaError",
  });
}

describe("splitIntoBatches", () => {
  it("reparte los destinatarios en lotes del tamaño pedido", () => {
    const batches = splitIntoBatches(makeInput(10), 4);

    expect(batches.map((b) => b.recipients.length)).toEqual([4, 4, 2]);
    expect(batches.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  it("respeta el rango 4-12 del PRD", () => {
    expect(splitIntoBatches(makeInput(12), 1)).toHaveLength(3);
    expect(splitIntoBatches(makeInput(24), 99)).toHaveLength(2);
  });

  it("mantiene cada sondeo con su destinatario al trocear", () => {
    // buildAirdropInstructions throws when a probe is not for the recipient at
    // its index, so a mismatched slice would surface here.
    const batches = splitIntoBatches(makeInput(9, 3), 4);

    expect(batches).toHaveLength(3);
    expect(batches.flatMap((b) => b.recipients.map((r) => r.address))).toEqual(
      makeInput(9, 3).recipients.map((r) => r.address)
    );
  });

  it("cuenta las ATAs por crear de cada lote", () => {
    // exists is true when i % 2 === 0, so half of each batch needs an account.
    const batches = splitIntoBatches(makeInput(8, 2), 4);

    expect(batches.map((b) => b.newAtas)).toEqual([2, 2]);
  });

  it("no produce lotes con una lista vacía", () => {
    expect(splitIntoBatches(makeInput(0), 8)).toEqual([]);
  });
});

describe("createAirdropRunner", () => {
  it("envía los lotes en orden y los confirma", async () => {
    const send = vi.fn(async (batch: TransferBatch) => `sig-${batch.index}`);
    const runner = createAirdropRunner({ batches: fakeBatches(3), send });

    await runner.start();

    expect(send).toHaveBeenCalledTimes(3);
    expect(runner.getState().batches.map((b) => b.status)).toEqual([
      "confirmed",
      "confirmed",
      "confirmed",
    ]);
    expect(runner.getState().batches.map((b) => b.signature)).toEqual([
      "sig-0",
      "sig-1",
      "sig-2",
    ]);
    expect(runner.getState().isRunning).toBe(false);
  });

  it("pausa deja de enviar lotes nuevos", async () => {
    const batches = fakeBatches(4);
    // Pausing from inside the first send is the real timing: the button is
    // pressed while a batch is in flight, and must not stop that one.
    const control = { pause: () => {} };
    const send = vi.fn(async (batch: TransferBatch) => {
      if (batch.index === 0) control.pause();
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches, send });
    control.pause = runner.pause;

    await runner.start();

    expect(send).toHaveBeenCalledTimes(1);
    const state = runner.getState();
    expect(state.isPaused).toBe(true);
    expect(state.isRunning).toBe(false);
    expect(state.batches.map((b) => b.status)).toEqual([
      "confirmed",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("reanudar no reenvía los lotes ya confirmados", async () => {
    const batches = fakeBatches(3);
    const control = { pause: () => {} };
    const send = vi.fn(async (batch: TransferBatch) => {
      if (batch.index === 0) control.pause();
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches, send });
    control.pause = runner.pause;

    await runner.start();
    await runner.start();

    expect(send.mock.calls.map(([batch]) => batch.index)).toEqual([0, 1, 2]);
    expect(
      runner.getState().batches.every((b) => b.status === "confirmed")
    ).toBe(true);
  });

  it("reintentar solo relanza el lote fallido", async () => {
    // Fails the first time batch 1 is asked for, succeeds on the retry.
    let failuresLeft = 1;
    const send = vi.fn(async (batch: TransferBatch) => {
      if (batch.index === 1 && failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error("Simulation failed");
      }
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches: fakeBatches(3), send });

    await runner.start();
    expect(runner.getState().batches.map((b) => b.status)).toEqual([
      "confirmed",
      "failed",
      "pending",
    ]);

    send.mockClear();
    await runner.retry(1);

    expect(send.mock.calls.map(([batch]) => batch.index)).toEqual([1]);
    expect(runner.getState().batches.map((b) => b.status)).toEqual([
      "confirmed",
      "confirmed",
      "pending",
    ]);
  });

  it("un fallo no marca como fallidos los lotes confirmados", async () => {
    const send = vi.fn(async (batch: TransferBatch) => {
      if (batch.index === 2) throw new Error("Simulation failed");
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches: fakeBatches(4), send });

    await runner.start();

    const batches = runner.getState().batches;
    expect(batches.map((b) => b.status)).toEqual([
      "confirmed",
      "confirmed",
      "failed",
      "pending",
    ]);
    expect(batches[0].signature).toBe("sig-0");
    expect(batches[1].signature).toBe("sig-1");
    expect(batches[0].error).toBeNull();
    expect(batches[2].error?.title).toBeTruthy();
  });

  it("un fallo detiene la tanda en lugar de encadenar prompts condenados", async () => {
    const send = vi.fn(async () => {
      throw new Error("Simulation failed");
    });
    const runner = createAirdropRunner({ batches: fakeBatches(5), send });

    await runner.start();

    expect(send).toHaveBeenCalledTimes(1);
    expect(runner.getState().isPaused).toBe(true);
  });

  it("reintenta una vez cuando el blockhash caduca", async () => {
    let attempts = 0;
    const send = vi.fn(async (batch: TransferBatch) => {
      attempts += 1;
      if (attempts === 1) throw expiredBlockhash();
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches: fakeBatches(1), send });

    await runner.start();

    expect(send).toHaveBeenCalledTimes(2);
    const [batch] = runner.getState().batches;
    expect(batch.status).toBe("confirmed");
    expect(batch.retried).toBe(true);
  });

  it("no reintenta una firma rechazada por el usuario", async () => {
    const send = vi.fn(async () => {
      throw new Error("User rejected the request");
    });
    const runner = createAirdropRunner({ batches: fakeBatches(1), send });

    await runner.start();

    expect(send).toHaveBeenCalledTimes(1);
    expect(runner.getState().batches[0].error?.kind).toBe("user-rejected");
  });

  it("ignora reintentar un lote que no ha fallado", async () => {
    const send = vi.fn(async (batch: TransferBatch) => `sig-${batch.index}`);
    const runner = createAirdropRunner({ batches: fakeBatches(2), send });

    await runner.start();
    send.mockClear();
    await runner.retry(0);

    expect(send).not.toHaveBeenCalled();
  });

  it("informa de cada transición para poder persistirla lote a lote", async () => {
    const seen: string[] = [];
    const send = vi.fn(async (batch: TransferBatch) => `sig-${batch.index}`);
    const runner = createAirdropRunner({
      batches: fakeBatches(2),
      onBatch: (batch) => seen.push(`${batch.index}:${batch.status}`),
      send,
    });

    await runner.start();

    // Every batch is persisted while in flight, not only once settled — a tab
    // that dies mid-send has to leave a trace of what was already out there.
    expect(seen).toEqual([
      "0:signing",
      "0:confirmed",
      "1:signing",
      "1:confirmed",
    ]);
  });
});

describe("runProgress", () => {
  it("cuenta confirmados, fallidos y pendientes", async () => {
    const send = vi.fn(async (batch: TransferBatch) => {
      if (batch.index === 1) throw new Error("Simulation failed");
      return `sig-${batch.index}`;
    });
    const runner = createAirdropRunner({ batches: fakeBatches(4), send });
    await runner.start();

    expect(runProgress(runner.getState().batches)).toEqual({
      confirmed: 1,
      failed: 1,
      finished: false,
      pending: 2,
      total: 4,
    });
  });

  it("no da por terminada una tanda vacía", () => {
    expect(runProgress([]).finished).toBe(false);
  });
});

describe("toStoredBatch", () => {
  it("guarda las cantidades como texto y aplana el error", async () => {
    const send = vi.fn(async () => {
      throw new Error("User rejected the request");
    });
    const runner = createAirdropRunner({ batches: fakeBatches(1), send });
    await runner.start();

    const stored = toStoredBatch(runner.getState().batches[0]);

    expect(stored.status).toBe("failed");
    expect(stored.recipients[0].amount).toBe("1000");
    expect(stored.error).toContain("Signature declined");
    expect(stored.signature).toBeUndefined();
  });

  it("guarda la firma de un lote confirmado", async () => {
    const send = vi.fn(async () => "sig-0");
    const runner = createAirdropRunner({ batches: fakeBatches(1), send });
    await runner.start();

    const stored = toStoredBatch(runner.getState().batches[0]);

    expect(stored.signature).toBe("sig-0");
    expect(stored.error).toBeUndefined();
  });
});
