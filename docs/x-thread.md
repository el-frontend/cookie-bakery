# X thread — Cookie Bakery

Draft for the bounty submission. Six tweets. Publishing it, and sharing it in
the Cookie Chain Telegram, is a human action — the app only ships the draft
(PRD §RF-07, out of scope: publishing).

**Before posting**, replace the two placeholders:

- `{{APP_URL}}` — the public Vercel URL
- `{{BAKE_MINT}}` — the BAKE demo mint address

Both are pending for the reason in the README's "What is still missing".

---

## 1 / 6

Launching a token usually means trusting someone else's backend with your keys,
or wiring up a script.

On Cookie Chain it should take two minutes in a browser tab.

So I built Cookie Bakery: bake a token, airdrop it from a CSV, watch who holds
it. 100% client-side. 🍪

## 2 / 6

Bake creates a Token-2022 mint with metadata, your token account and the entire
initial supply in ONE transaction.

Optional transfer fee, mint-close authority, and one-click revoke of the mint
and freeze authorities.

You see the exact cost in COOK before you sign anything.

## 3 / 6

Airdrop takes `address,amount` — paste it or drop a CSV, up to 1,000 rows.

It validates every row, flags bad base58 and impossible decimals by line
number, offers to merge duplicates, then prices the whole run: number of
transactions, new token accounts, total rent + fees.

## 4 / 6

Then it sends batch by batch: progress bar, Pause between batches, Retry on one
failed batch that never re-sends a confirmed one.

Each batch gets a fresh blockhash — on this chain it expires while a human
reads the wallet prompt. Measured, not guessed.

## 5 / 6

You need COOK for fees and rent before any of this works.

Bridge assets in here 👉 https://hyperlane.cookiescan.io

COOK has 9 decimals, same lamport arithmetic as SOL.

## 6 / 6

Built with @solana's Kit plugin client — the wallet only ever SIGNS, the app
sends through Cookie Chain's own RPC. On a separate SVM that distinction is the
whole ballgame.

Open source, MIT: https://github.com/el-frontend/cookie-bakery
Try it: {{APP_URL}}

---

## Notes for whoever posts this

- Tweet 4 is the one with the real engineering story in it. If the thread needs
  trimming, cut 2 before 4.
- Attach the flow GIF to tweet 1 and the airdrop batch table to tweet 4.
- Tag the Cookie Chain account on tweet 1 and the bridge on tweet 5.
- Once `{{BAKE_MINT}}` exists, consider adding its CookieScan link to tweet 2 as
  a reply rather than lengthening the tweet.
