import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  address,
  createNoopSigner,
  flattenInstructionPlan,
  generateKeyPairSigner,
  isSingleInstructionPlan,
  type ClientWithGetMinimumBalance,
  type Instruction,
  type InstructionPlan,
  type TransactionSigner,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  buildCreateTokenClassicPlan,
  type CreateTokenClassicInput,
} from "./buildCreateTokenClassic";

const AUTHORITY = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const client = {
  getMinimumBalance: vi.fn(async (space: number) => BigInt(space * 6960)),
} as unknown as ClientWithGetMinimumBalance;

let mintSigner: TransactionSigner;

beforeAll(async () => {
  mintSigner = await generateKeyPairSigner();
});

function input(
  overrides: Partial<CreateTokenClassicInput> = {}
): CreateTokenClassicInput {
  return {
    authority: createNoopSigner(AUTHORITY),
    decimals: 6,
    mint: mintSigner,
    revokeFreezeAuthority: false,
    revokeMintAuthority: false,
    supply: 1_000_000_000_000n,
    ...overrides,
  };
}

function instructionsOf(plan: InstructionPlan): Instruction[] {
  return [...flattenInstructionPlan(plan)]
    .filter(isSingleInstructionPlan)
    .map((single) => single.instruction);
}

async function build(overrides: Partial<CreateTokenClassicInput> = {}) {
  return instructionsOf(
    await buildCreateTokenClassicPlan(client, input(overrides))
  );
}

describe("buildCreateTokenClassicPlan", () => {
  it("emits no metadata or extension instructions", async () => {
    const instructions = await build();
    expect(
      instructions.every((i) => i.programAddress !== TOKEN_2022_PROGRAM_ADDRESS)
    ).toBe(true);

    // createAccount, initializeMint, create ATA, mintTo — nothing else.
    expect(instructions).toHaveLength(4);
  });

  it("sizes the mint at the bare 82-byte base", async () => {
    vi.mocked(client.getMinimumBalance).mockClear();
    await build();
    // Passing no extensions avoids the getMintSize([]) === 166 trap.
    expect(client.getMinimumBalance).toHaveBeenCalledWith(82);
  });

  it("derives the ATA with the Token program address", async () => {
    const instructions = await build();
    const [expected] = await findAssociatedTokenPda({
      mint: mintSigner.address,
      owner: AUTHORITY,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const ataInstruction = instructions.find(
      (i) => i.programAddress === ASSOCIATED_TOKEN_PROGRAM_ADDRESS
    );
    expect(ataInstruction?.accounts?.some((a) => a.address === expected)).toBe(
      true
    );
  });

  it("targets the classic Token program for every token instruction", async () => {
    const instructions = await build();
    const tokenInstructions = instructions.filter(
      (i) =>
        i.programAddress !== ASSOCIATED_TOKEN_PROGRAM_ADDRESS &&
        i.programAddress !== "11111111111111111111111111111111"
    );
    expect(tokenInstructions.length).toBeGreaterThan(0);
    expect(
      tokenInstructions.every((i) => i.programAddress === TOKEN_PROGRAM_ADDRESS)
    ).toBe(true);
  });

  it("appends one setAuthority per revocation", async () => {
    const plain = await build();
    const both = await build({
      revokeFreezeAuthority: true,
      revokeMintAuthority: true,
    });
    expect(both).toHaveLength(plain.length + 2);
    expect(
      both.slice(-2).every((i) => i.programAddress === TOKEN_PROGRAM_ADDRESS)
    ).toBe(true);
  });
});
