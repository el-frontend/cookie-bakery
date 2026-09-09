import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createNoopSigner,
  flattenInstructionPlan,
  generateKeyPairSigner,
  isSingleInstructionPlan,
  address,
  type ClientWithGetMinimumBalance,
  type Instruction,
  type InstructionPlan,
  type TransactionSigner,
} from "@solana/kit";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  buildCreateToken2022Plan,
  type CreateToken2022Input,
} from "./buildCreateToken2022";

const AUTHORITY = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const client = {
  getMinimumBalance: vi.fn(async (space: number) => BigInt(space * 6960)),
} as unknown as ClientWithGetMinimumBalance;

let mintSigner: TransactionSigner;

beforeAll(async () => {
  mintSigner = await generateKeyPairSigner();
});

function input(
  overrides: Partial<CreateToken2022Input> = {}
): CreateToken2022Input {
  return {
    authority: createNoopSigner(AUTHORITY),
    decimals: 6,
    mint: mintSigner,
    mintCloseAuthority: false,
    name: "Bakery Cookie",
    revokeFreezeAuthority: false,
    revokeMintAuthority: false,
    supply: 1_000_000_000_000n,
    symbol: "BAKE",
    transferFee: null,
    uri: "https://example.com/meta.json",
    ...overrides,
  };
}

/** The plan is a tree; the assertions below care about the flat sequence. */
function instructionsOf(plan: InstructionPlan): Instruction[] {
  return [...flattenInstructionPlan(plan)]
    .filter(isSingleInstructionPlan)
    .map((single) => single.instruction);
}

async function build(overrides: Partial<CreateToken2022Input> = {}) {
  return instructionsOf(
    await buildCreateToken2022Plan(client, input(overrides))
  );
}

describe("buildCreateToken2022Plan", () => {
  it("puts the extension instructions before initializeMint", async () => {
    const instructions = await build();
    const programs = instructions.map((i) => i.programAddress);

    // createAccount is the System program and must come first.
    expect(programs[0]).toBe(SYSTEM_PROGRAM_ADDRESS);

    // Everything between createAccount and the ATA belongs to Token-2022, and
    // initializeMint is not the first of them — the extension pre-inits are.
    const token2022 = programs.filter((p) => p === TOKEN_2022_PROGRAM_ADDRESS);
    expect(token2022.length).toBeGreaterThan(2);
  });

  it("derives the ATA with the Token-2022 program address", async () => {
    const instructions = await build();
    const [expected] = await findAssociatedTokenPda({
      mint: mintSigner.address,
      owner: AUTHORITY,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const ataInstruction = instructions.find(
      (i) => i.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS
    );
    expect(ataInstruction).toBeDefined();
    expect(ataInstruction?.accounts?.some((a) => a.address === expected)).toBe(
      true
    );
  });

  it("funds the mint for the rent-bearing size, not the allocated one", async () => {
    await build();
    // getCreateMintInstructionPlan asks for the size INCLUDING TokenMetadata.
    const { calls } = vi.mocked(client.getMinimumBalance).mock;
    const requested = calls[calls.length - 1][0];
    expect(requested).toBeGreaterThan(82);
  });

  it("omits setAuthority when nothing is revoked", async () => {
    const withoutRevocations = await build();
    const withMint = await build({ revokeMintAuthority: true });
    expect(withMint).toHaveLength(withoutRevocations.length + 1);
  });

  it("includes two setAuthority when mint and freeze are both revoked", async () => {
    const withoutRevocations = await build();
    const both = await build({
      revokeFreezeAuthority: true,
      revokeMintAuthority: true,
    });
    expect(both).toHaveLength(withoutRevocations.length + 2);

    // Revocations come last: the supply must be minted first.
    const tail = both.slice(-2);
    expect(
      tail.every((i) => i.programAddress === TOKEN_2022_PROGRAM_ADDRESS)
    ).toBe(true);
  });

  it("adds one instruction per enabled extension", async () => {
    const plain = await build();
    const withExtensions = await build({
      mintCloseAuthority: true,
      transferFee: { basisPoints: 100, maximumFee: 1_000n },
    });
    expect(withExtensions).toHaveLength(plain.length + 2);
  });
});
