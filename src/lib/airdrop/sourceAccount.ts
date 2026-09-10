import {
  fetchEncodedAccount,
  type Address,
  type GetAccountInfoApi,
  type Rpc,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getTokenDecoder,
} from "@solana-program/token-2022";

/**
 * The sender's own token account, and how much of the token is in it.
 *
 * The PRD requires checking the run's total against the sender's balance
 * before anything is signed. Without it the first batches land, the middle one
 * fails on insufficient tokens, and the user is left holding a half-finished
 * airdrop — the single worst outcome this screen can produce.
 *
 * The account is fetched and decoded rather than read through
 * `getTokenAccountBalance`, because two of the three things needed here — that
 * the account exists at all, and that its mint is the expected one — are not
 * in that response. `assertAccountExists` is not used: a sender who simply
 * does not hold the token is an ordinary case that deserves a sentence, not a
 * thrown assertion.
 */

export type SourceAccount = {
  /** Base units held by the sender. */
  amount: bigint;
  ata: Address;
  exists: boolean;
};

export async function readSourceAccount(
  rpc: Rpc<GetAccountInfoApi>,
  owner: Address,
  mint: Address,
  tokenProgram: Address
): Promise<SourceAccount> {
  const [ata] = await findAssociatedTokenPda({ mint, owner, tokenProgram });
  const account = await fetchEncodedAccount(rpc, ata);

  if (!account.exists) {
    return { amount: 0n, ata, exists: false };
  }

  // Owner check before decoding: an account at this address that belongs to
  // another program is not a token account, whatever its bytes look like.
  if (account.programAddress !== tokenProgram) {
    return { amount: 0n, ata, exists: false };
  }

  const token = getTokenDecoder().decode(account.data);

  // A different mint at the derived address should be impossible, but decoding
  // trusts bytes, and acting on the wrong balance is worse than refusing.
  if (token.mint !== mint) {
    return { amount: 0n, ata, exists: false };
  }

  return { amount: token.amount, ata, exists: true };
}
