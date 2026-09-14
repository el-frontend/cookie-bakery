# X thread — Cookie Bakery

Ready to post. Attach `cookie-bakery-demo.gif` to tweet 1 — X loops GIFs
automatically, so it plays without anyone tapping anything.

Nothing left to fill in. The URL is live and the mint exists on chain —
verified against the RPC, not copied from a note.

- Live app: https://cookie-bakery.elfrontendoficial.workers.dev
- Demo mint: `54tqwHeoDwyY9hCRVGZtrHqvav1Zj27g4gNbRNQTN451` (ElFrontend · FNTD,
  Token-2022)

One thing to check before posting: `@cookiechain` in tweets 1 and 7 is a guess
at the handle. Confirm it, or drop the mention — tagging the wrong account in
a bounty the sponsor reads is worse than not tagging at all.

---

## 1 / 8

Most token airdrop tools start with "upload a CSV of wallet addresses."

Nobody has one.

So I built @cookiechain's missing piece: your audience builds the list for you,
and the giveaway draw is something anyone can verify.

🍪 Cookie Bakery

https://cookie-bakery.elfrontendoficial.workers.dev

---

## 2 / 8

If you have a community, you have names in a chat — not a column of base58
addresses.

Every airdrop tool I found solves distribution for _projects_. None of them
solve the part where a creator actually gets the list.

That gap is the whole product.

---

## 3 / 8

1. Open an event against your token
2. Share the link — followers register themselves from their phone
3. Close it, then draw winners or pick them by hand
4. Pay

Registering costs a follower nothing. No COOK, no gas, no signature.

---

## 4 / 8

A giveaway where the host announces a winner and nobody can check is worth
nothing.

So the draw commits to a secret seed, then takes its entropy from a Cookie
Chain block that doesn't exist yet.

Knowing the seed buys you nothing when the hash hasn't been produced.

---

## 5 / 8

The commitment and the result are both written on chain as memo transactions.

What proves the timing isn't a database row — it's that the commit landed in a
slot _below_ the target. Both numbers are public on CookieScan.

Anyone can recompute the draw in their own browser.

---

## 6 / 8

It's not a VRF. A validator producing the target block has marginal influence,
and I'd rather say that than pretend otherwise.

And a verifiable draw doesn't make the entry list honest — a creator could pad
it. This makes the draw checkable, not the creator trustworthy.

---

## 7 / 8

Built on @solana Kit v8. Token-2022 mints, batched transfers with pause and
retry, 576 tests including a row-level-security suite against real Postgres.

Open source, MIT:
https://github.com/el-frontend/cookie-bakery

Demo mint:
54tqwHeoDwyY9hCRVGZtrHqvav1Zj27g4gNbRNQTN451

---

## 8 / 8

New to Cookie Chain? Bridge in and try it:

https://hyperlane.cookiescan.io

Built for the Superteam Earn "Create an App on Cookie Chain" bounty 🍪

---

## Notes for posting

- **Tweet 1 carries the GIF.** It is the only one that needs media.
- Tweets 4–6 are the differentiator. If you have to cut the thread short, cut
  3 and 7 before you cut those — "verifiable draw" plus "here is what it does
  not claim" is what makes this look like engineering rather than marketing.
- Tag the Cookie Chain account if it has one; `@cookiechain` above is a
  placeholder until you confirm the handle.
- After posting, share the thread link in the Cookie Chain Telegram — the
  bounty requires it explicitly.
