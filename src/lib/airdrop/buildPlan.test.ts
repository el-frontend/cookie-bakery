import { describe, expect, it, vi } from "vitest";
import {
  address,
  createNoopSigner,
  type Address,
  type ClientWithGetMinimumBalance,
} from "@solana/kit";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  batchCount,
  buildAirdropInstructions,
  DEFAULT_BATCH,
  DEFAULT_BATCH_WITH_NEW_ATAS,
  estimateAirdropCost,
  LAMPORTS_PER_SIGNATURE,
  MAX_BATCH,
  MIN_BATCH,
  suggestedBatchSize,
} from "./buildPlan";
import type { AtaProbe } from "./probeAtas";

const MINT = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const SOURCE = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const AUTHORITY = createNoopSigner(
  address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
);
const OWNER_A = address("ComputeBudget111111111111111111111111111111");
const OWNER_B = address("SysvarRent111111111111111111111111111111111");
const ATA_A = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const ATA_B = address("11111111111111111111111111111111");

function probe(owner: Address, ata: Address, exists: boolean): AtaProbe {
  return { ata, exists, owner };
}

function build(existsA: boolean, existsB: boolean) {
  return buildAirdropInstructions({
    authority: AUTHORITY,
    decimals: 6,
    mint: MINT,
    probes: [probe(OWNER_A, ATA_A, existsA), probe(OWNER_B, ATA_B, existsB)],
    recipients: [
      { address: OWNER_A, amount: 100_000_000n },
      { address: OWNER_B, amount: 50_000_000n },
    ],
    source: SOURCE,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
}

const rentClient = {
  getMinimumBalance: vi.fn(async () => 2_039_280n),
} as unknown as ClientWithGetMinimumBalance;

describe("buildAirdropInstructions", () => {
  it("omite la creación de ATA cuando ya existe", () => {
    const bothExist = build(true, true);
    expect(
      bothExist.every(
        (i) => i.programAddress !== ASSOCIATED_TOKEN_PROGRAM_ADDRESS
      )
    ).toBe(true);
    expect(bothExist).toHaveLength(2);

    const oneMissing = build(false, true);
    expect(
      oneMissing.filter(
        (i) => i.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS
      )
    ).toHaveLength(1);
    expect(oneMissing).toHaveLength(3);
  });

  it("crea la ATA antes de transferir a ella", () => {
    const instructions = build(false, true);
    const createIndex = instructions.findIndex(
      (i) => i.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS
    );
    const firstTransfer = instructions.findIndex(
      (i) => i.programAddress === TOKEN_2022_PROGRAM_ADDRESS
    );
    expect(createIndex).toBeLessThan(firstTransfer);
  });

  it("usa transferChecked con los decimales del mint", () => {
    const instructions = build(true, true);
    const transfers = instructions.filter(
      (i) => i.programAddress === TOKEN_2022_PROGRAM_ADDRESS
    );

    expect(transfers).toHaveLength(2);
    // transferChecked carries the decimals in its data; a plain transfer does
    // not, which is exactly why the PRD asks for the checked variant.
    for (const transfer of transfers) {
      const data = transfer.data as Uint8Array;
      expect(data[data.length - 1]).toBe(6);
    }
  });

  it("transfiere a la ATA sondeada, no a la dirección del destinatario", () => {
    const instructions = build(true, true);
    const touched = instructions.flatMap((i) =>
      (i.accounts ?? []).map((a) => a.address)
    );
    expect(touched).toContain(ATA_A);
    expect(touched).toContain(ATA_B);
  });

  it("rechaza listas descuadradas o sondeos mal emparejados", () => {
    expect(() =>
      buildAirdropInstructions({
        authority: AUTHORITY,
        decimals: 6,
        mint: MINT,
        probes: [probe(OWNER_A, ATA_A, true)],
        recipients: [
          { address: OWNER_A, amount: 1n },
          { address: OWNER_B, amount: 1n },
        ],
        source: SOURCE,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      })
    ).toThrow(/disagree/);

    expect(() =>
      buildAirdropInstructions({
        authority: AUTHORITY,
        decimals: 6,
        mint: MINT,
        // Probe order swapped relative to the recipients.
        probes: [probe(OWNER_B, ATA_B, true), probe(OWNER_A, ATA_A, true)],
        recipients: [
          { address: OWNER_A, amount: 1n },
          { address: OWNER_B, amount: 1n },
        ],
        source: SOURCE,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      })
    ).toThrow(/is for/);
  });
});

describe("estimateAirdropCost", () => {
  it("el coste refleja solo las ATAs nuevas", async () => {
    const probes = [probe(OWNER_A, ATA_A, false), probe(OWNER_B, ATA_B, true)];
    const cost = await estimateAirdropCost(rentClient, probes, 1);

    expect(cost.newAtaCount).toBe(1n);
    expect(cost.ataRent).toBe(2_039_280n);
    expect(cost.fees).toBe(LAMPORTS_PER_SIGNATURE);
    expect(cost.total).toBe(2_039_280n + LAMPORTS_PER_SIGNATURE);
  });

  it("no pide rent cuando todas las ATAs existen", async () => {
    vi.mocked(rentClient.getMinimumBalance).mockClear();
    const probes = [probe(OWNER_A, ATA_A, true), probe(OWNER_B, ATA_B, true)];
    const cost = await estimateAirdropCost(rentClient, probes, 2);

    expect(rentClient.getMinimumBalance).not.toHaveBeenCalled();
    expect(cost.ataRent).toBe(0n);
    expect(cost.total).toBe(LAMPORTS_PER_SIGNATURE * 2n);
  });

  it("cobra una firma por transacción", async () => {
    const probes = [probe(OWNER_A, ATA_A, true)];
    const cost = await estimateAirdropCost(rentClient, probes, 7);
    expect(cost.fees).toBe(LAMPORTS_PER_SIGNATURE * 7n);
  });
});

describe("batchCount", () => {
  it("redondea hacia arriba y respeta el rango 4-12", () => {
    expect(batchCount(16, 8)).toBe(2);
    expect(batchCount(17, 8)).toBe(3);
    // Out-of-range sizes clamp rather than producing an absurd split.
    expect(batchCount(100, 1)).toBe(batchCount(100, MIN_BATCH));
    expect(batchCount(100, 999)).toBe(batchCount(100, MAX_BATCH));
  });
});

describe("suggestedBatchSize", () => {
  it("baja el tamaño cuando hay ATAs por crear", () => {
    expect(suggestedBatchSize([probe(OWNER_A, ATA_A, true)])).toBe(
      DEFAULT_BATCH
    );
    expect(suggestedBatchSize([probe(OWNER_A, ATA_A, false)])).toBe(
      DEFAULT_BATCH_WITH_NEW_ATAS
    );
  });
});
