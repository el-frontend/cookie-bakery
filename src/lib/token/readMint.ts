import type { Address, GetAccountInfoApi, Rpc } from "@solana/kit";
import type { Extension } from "@solana-program/token-2022";
import { inspectMint, type MintInfo } from "./inspectMint";
import { fromBaseUnits } from "./bakeForm";

/**
 * The mint as the Oven shows it (RF-04.3).
 *
 * The reads, the existence check and the owner check all live in
 * `inspectMint` (RF-03.4) — this module does not repeat them. What it adds is
 * the part the dashboard needs and the airdrop did not: turning the decoded
 * Token-2022 extensions into labels, and pulling the on-chain metadata out of
 * the `TokenMetadata` extension.
 *
 * The name, symbol and URI in that extension were typed by whoever created the
 * token. They are returned RAW and deliberately unsanitised: one sanitiser
 * lives in `metadata.ts` and both the on-chain strings and the remote JSON go
 * through it at the point of render. Sanitising here as well would mean two
 * implementations drifting apart.
 */

export type AuthorityState = {
  address: Address | null;
  /** True when the authority is `None` on chain — nobody can ever use it. */
  revoked: boolean;
};

export type ExtensionSummary = {
  /** Extra context worth a line in the UI, when the extension carries any. */
  detail: string | null;
  kind: string;
  label: string;
};

/** Raw strings from the on-chain `TokenMetadata` extension. Untrusted. */
export type OnChainMetadata = {
  additional: readonly (readonly [string, string])[];
  name: string;
  symbol: string;
  updateAuthority: Address | null;
  uri: string;
};

export type MintDetails = MintInfo & {
  extensionSummaries: readonly ExtensionSummary[];
  freeze: AuthorityState;
  minting: AuthorityState;
  onChainMetadata: OnChainMetadata | null;
  /** Supply scaled by decimals, ready to render. */
  supplyFormatted: string;
};

/**
 * Labels for the extensions this chain can actually carry.
 *
 * An extension missing from this table still gets listed — with its raw
 * `__kind` as the label. Silently hiding an extension nobody thought of would
 * under-report what a token can do to its holders, which is the opposite of
 * what this panel is for.
 */
const LABELS: Record<string, string> = {
  ConfidentialMintBurn: "Confidential mint & burn",
  ConfidentialTransferFee: "Confidential transfer fee",
  ConfidentialTransferMint: "Confidential transfers",
  DefaultAccountState: "Default account state",
  GroupMemberPointer: "Group member pointer",
  GroupPointer: "Group pointer",
  ImmutableOwner: "Immutable owner",
  InterestBearingConfig: "Interest bearing",
  MemoTransfer: "Memo required on transfer",
  MetadataPointer: "Metadata pointer",
  MintCloseAuthority: "Mint close authority",
  NonTransferable: "Non-transferable",
  PausableConfig: "Pausable",
  PermanentDelegate: "Permanent delegate",
  PermissionedBurn: "Permissioned burn",
  ScaledUiAmountConfig: "Scaled UI amount",
  TokenGroup: "Token group",
  TokenGroupMember: "Token group member",
  TokenMetadata: "On-chain metadata",
  TransferFeeConfig: "Transfer fee",
  TransferHook: "Transfer hook",
};

function optionValue<T>(option: unknown): T | null {
  if (option && typeof option === "object" && "__option" in option) {
    const opt = option as { __option: string; value?: T };
    return opt.__option === "Some" ? (opt.value ?? null) : null;
  }
  return (option as T | null) ?? null;
}

/**
 * A human line for the extensions whose configuration actually changes what
 * holders can do. A transfer fee is the clearest case: "Transfer fee" alone
 * does not tell anyone they lose 1% of every transfer.
 */
export function describeExtension(
  extension: Extension,
  decimals: number
): ExtensionSummary {
  const kind = extension.__kind;
  const label = LABELS[kind] ?? kind;

  switch (extension.__kind) {
    case "TransferFeeConfig": {
      const fee = extension.newerTransferFee;
      const basisPoints = Number(fee?.transferFeeBasisPoints ?? 0);
      const maximumFee = fee?.maximumFee ?? 0n;
      return {
        detail: `${(basisPoints / 100).toFixed(2)}% per transfer, capped at ${fromBaseUnits(maximumFee, decimals)}`,
        kind,
        label,
      };
    }
    case "MintCloseAuthority": {
      const authority = optionValue<Address>(extension.closeAuthority);
      return {
        detail: authority
          ? `The mint can be closed by ${authority}`
          : "No close authority set",
        kind,
        label,
      };
    }
    case "PermanentDelegate": {
      const delegate = optionValue<Address>(extension.delegate);
      return {
        detail: delegate
          ? `${delegate} can move any holder's tokens`
          : "No delegate set",
        kind,
        label,
      };
    }
    case "TransferHook": {
      const program = optionValue<Address>(extension.programId);
      return {
        detail: program
          ? `Every transfer calls ${program}`
          : "No hook program set",
        kind,
        label,
      };
    }
    case "NonTransferable":
      return { detail: "Holders cannot transfer this token", kind, label };
    case "InterestBearingConfig":
      return {
        detail: `Rate ${Number(extension.currentRate) / 100}% — display only, the supply does not change`,
        kind,
        label,
      };
    case "TokenMetadata":
      return { detail: null, kind, label };
    default:
      return { detail: null, kind, label };
  }
}

export function extensionSummaries(
  extensions: readonly Extension[],
  decimals: number
): ExtensionSummary[] {
  return extensions.map((extension) => describeExtension(extension, decimals));
}

/** The on-chain `TokenMetadata` extension, if the mint carries one. */
export function readOnChainMetadata(
  extensions: readonly Extension[]
): OnChainMetadata | null {
  const found = extensions.find(
    (extension) => extension.__kind === "TokenMetadata"
  );
  if (!found || found.__kind !== "TokenMetadata") return null;

  const additional = found.additionalMetadata;
  return {
    additional:
      additional instanceof Map
        ? [...additional.entries()]
        : Array.isArray(additional)
          ? (additional as (readonly [string, string])[])
          : [],
    name: found.name,
    symbol: found.symbol,
    updateAuthority: optionValue<Address>(found.updateAuthority),
    uri: found.uri,
  };
}

export async function readMint(
  rpc: Rpc<GetAccountInfoApi>,
  mint: Address
): Promise<MintDetails> {
  const info = await inspectMint(rpc, mint);

  return {
    ...info,
    extensionSummaries: extensionSummaries(info.extensions, info.decimals),
    // `null` on chain means revoked, not "unknown": nobody can mint or freeze
    // again, ever. The distinction is the whole point of AC-02.3 and AC-04.2.
    freeze: {
      address: info.freezeAuthority,
      revoked: info.freezeAuthority === null,
    },
    minting: {
      address: info.mintAuthority,
      revoked: info.mintAuthority === null,
    },
    onChainMetadata: readOnChainMetadata(info.extensions),
    supplyFormatted: fromBaseUnits(info.supply, info.decimals),
  };
}
