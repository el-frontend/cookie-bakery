import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AIRDROP_HISTORY_KEY,
  AIRDROP_HISTORY_VERSION,
  findRun,
  loadRuns,
  progressOf,
  recordBatch,
  retryableBatches,
  saveRuns,
  upsertRun,
  type AirdropBatch,
  type AirdropRun,
  type StorageLike,
} from "./airdropHistory";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  } satisfies StorageLike;
}

function batch(index: number, overrides: Partial<AirdropBatch> = {}) {
  return {
    index,
    recipients: [{ address: `Recipient${index}`, amount: "1000000" }],
    status: "pending",
    ...overrides,
  } as AirdropBatch;
}

function run(overrides: Partial<AirdropRun> = {}): AirdropRun {
  return {
    batches: [batch(0), batch(1), batch(2)],
    decimals: 6,
    id: "run-1",
    mint: "Mint1",
    startedAt: "2026-09-10T09:00:00.000Z",
    symbol: "BAKE",
    ...overrides,
  };
}

let storage: StorageLike;

beforeEach(() => {
  storage = memoryStorage();
});

describe("airdropHistory", () => {
  it("persiste el progreso lote a lote", () => {
    upsertRun(run(), storage);

    recordBatch(
      "run-1",
      batch(0, { signature: "Sig0", status: "confirmed" }),
      storage
    );
    // Reading between batches must already show the first one landed.
    expect(progressOf(findRun("run-1", storage)!)).toMatchObject({
      confirmed: 1,
      pending: 2,
    });

    recordBatch(
      "run-1",
      batch(1, { signature: "Sig1", status: "confirmed" }),
      storage
    );
    const after = findRun("run-1", storage)!;

    expect(progressOf(after)).toMatchObject({ confirmed: 2, pending: 1 });
    expect(after.batches[0].signature).toBe("Sig0");
    expect(after.batches[1].signature).toBe("Sig1");
    expect(after.batches[2].status).toBe("pending");
  });

  it("se recupera tras recarga a mitad", () => {
    upsertRun(run(), storage);
    recordBatch(
      "run-1",
      batch(0, { signature: "Sig0", status: "confirmed" }),
      storage
    );
    recordBatch(
      "run-1",
      batch(1, { error: "Blockhash expired", status: "failed" }),
      storage
    );

    // Simulate a reload: nothing in memory, everything read back from storage.
    const recovered = loadRuns(storage);
    expect(recovered).toHaveLength(1);

    const progress = progressOf(recovered[0]);
    expect(progress).toMatchObject({
      confirmed: 1,
      failed: 1,
      finished: false,
      pending: 1,
    });
    // Only the failed batch is offered for retry — never the confirmed one.
    expect(retryableBatches(recovered[0]).map((b) => b.index)).toEqual([1]);
  });

  it("un lote guardado no lo pisa una copia en memoria vieja", () => {
    upsertRun(run(), storage);
    recordBatch(
      "run-1",
      batch(0, { signature: "Sig0", status: "confirmed" }),
      storage
    );

    // A caller still holding the original run records a later batch.
    recordBatch(
      "run-1",
      batch(2, { signature: "Sig2", status: "confirmed" }),
      storage
    );

    const after = findRun("run-1", storage)!;
    expect(after.batches[0].status).toBe("confirmed");
    expect(after.batches[2].status).toBe("confirmed");
  });

  it("no hace nada al registrar un lote de un run desconocido", () => {
    upsertRun(run(), storage);
    expect(recordBatch("nope", batch(0), storage)).toBeUndefined();
    expect(findRun("run-1", storage)!.batches[0].status).toBe("pending");
  });

  it("escribe el sobre versionado y descarta versiones desconocidas", () => {
    saveRuns([run()], storage);
    expect(
      JSON.parse(storage.getItem(AIRDROP_HISTORY_KEY) as string)
    ).toMatchObject({
      v: AIRDROP_HISTORY_VERSION,
    });

    storage.setItem(
      AIRDROP_HISTORY_KEY,
      JSON.stringify({ runs: [run()], v: 99 })
    );
    expect(loadRuns(storage)).toEqual([]);
  });

  it("descarta entradas corruptas sin romper", () => {
    storage.setItem(AIRDROP_HISTORY_KEY, "{not json");
    expect(loadRuns(storage)).toEqual([]);

    storage.setItem(
      AIRDROP_HISTORY_KEY,
      JSON.stringify({
        runs: [run(), { id: 42 }, null, { ...run(), batches: [{ nope: 1 }] }],
        v: AIRDROP_HISTORY_VERSION,
      })
    );
    expect(loadRuns(storage)).toHaveLength(1);
  });

  it("sobrevive sin storage y a un storage que lanza", () => {
    expect(loadRuns(null)).toEqual([]);
    expect(() => saveRuns([run()], null)).not.toThrow();

    const throwing = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    } satisfies StorageLike;
    expect(() => saveRuns([run()], throwing)).not.toThrow();
  });

  it("upsert no duplica el mismo run", () => {
    upsertRun(run(), storage);
    const list = upsertRun(run({ symbol: "CRMB" }), storage);

    expect(list).toHaveLength(1);
    expect(list[0].symbol).toBe("CRMB");
  });
});
