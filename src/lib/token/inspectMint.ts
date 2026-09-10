import {
  fetchEncodedAccount,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  getMintDecoder,
  TOKEN_2022_PROGRAM_ADDRESS,
  type Extension,
} from "@solana-program/token-2022";

/**
 * Read a mint straight from the chain (RF-03.4).
 *
 * The token program is deduced from the account's OWNER, never guessed from
 * the address or remembered from how the app happened to create it. A mint
 * pasted by hand can belong to either program, and picking the wrong one
 * derives the wrong associated token account — the transfer would then either
 * fail or, worse, create an account nobody looks at.
 *
 * The base mint layout is identical across Token and Token-2022 (Token-2022
 * appends its extensions after it), so one decoder serves both.
 */

export type TokenProgramKind = "token" | "token-2022";

export type MintInfo = {
  address: Address;
  decimals: number;
  /**
   * Token-2022 extensions present on the mint, decoded (RF-04.3).
   *
   * Always an array — a classic SPL mint simply has none, which is different
   * from "we did not look". `src/lib/token/readMint.ts` turns these into the
   * labels the Oven renders.
   */
  extensions: readonly Extension[];
  freezeAuthority: Address | null;
  mintAuthority: Address | null;
  program: TokenProgramKind;
  programAddress: Address;
  supply: bigint;
};

export class MintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MintError";
  }
}

function programKindOf(owner: Address): TokenProgramKind {
  if (owner === TOKEN_2022_PROGRAM_ADDRESS) return "token-2022";
  if (owner === TOKEN_PROGRAM_ADDRESS) return "token";
  throw new MintError(
    "That account is not a token mint — it belongs to another program."
  );
}

export async function inspectMint(
  rpc: Rpc<GetAccountInfoApi>,
  mint: Address
): Promise<MintInfo> {
  const account = await fetchEncodedAccount(rpc, mint);

  if (!account.exists) {
    throw new MintError(
      "No account at that address on this network. Check the mint and the RPC."
    );
  }

  const program = programKindOf(account.programAddress);

  let decoded;
  try {
    decoded = getMintDecoder().decode(account.data);
  } catch {
    throw new MintError(
      "That account is owned by a token program but is not a mint."
    );
  }

  if (!decoded.isInitialized) {
    throw new MintError("That mint account exists but was never initialized.");
  }

  return {
    address: mint,
    decimals: decoded.decimals,
    extensions: unwrapExtensions(decoded.extensions),
    freezeAuthority: unwrapOption(decoded.freezeAuthority),
    mintAuthority: unwrapOption(decoded.mintAuthority),
    program,
    programAddress: account.programAddress,
    supply: decoded.supply,
  };
}

/**
 * `extensions` is an `Option<Array<Extension>>`: `None` on a classic mint, and
 * on a Token-2022 mint with no extensions either. Both collapse to `[]` — the
 * caller cares whether there ARE extensions, not how the absence was encoded.
 *
 * `Uninitialized` entries are dropped: they are padding in the account's TLV
 * region, not a feature anyone turned on, and listing them in the UI as an
 * active extension would be simply wrong.
 */
function unwrapExtensions(option: unknown): readonly Extension[] {
  let list: unknown = option;
  if (option && typeof option === "object" && "__option" in option) {
    const opt = option as { __option: string; value?: unknown };
    list = opt.__option === "Some" ? opt.value : null;
  }
  if (!Array.isArray(list)) return [];
  return (list as Extension[]).filter(
    (extension) => extension?.__kind !== "Uninitialized"
  );
}

/** Kit options are `{__option: "Some"|"None"}`; the UI only wants the value. */
function unwrapOption(option: unknown): Address | null {
  if (option && typeof option === "object" && "__option" in option) {
    const opt = option as { __option: string; value?: Address };
    return opt.__option === "Some" ? (opt.value ?? null) : null;
  }
  return (option as Address | null) ?? null;
}
