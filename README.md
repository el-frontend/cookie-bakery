# 🍪 Cookie Bakery

**Launch a token on [Cookie Chain](https://docs.cookiechain.wtf/getting-started), airdrop it from a CSV, and watch who holds it.**

Cookie Bakery is a 100% client-side token launcher and airdrop tool. There is no
backend, no database, and no server that ever sees a key: the wallet signs, the
browser sends, and everything that needs to survive a reload lives in
`localStorage`.

Built for the Superteam Earn **"Create an App on Cookie Chain"** bounty.

- **Live app:** _not deployed yet_ — see [Deploying](#deploying)
- **Repo:** https://github.com/el-frontend/cookie-bakery
- **License:** [MIT](./LICENSE)

---

## The three screens

| Screen      | What it does                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bake**    | Creates a Token-2022 mint with metadata, your token account and the whole initial supply **in one transaction**. Optional transfer fee, mint-close authority, authority revoke. |
| **Airdrop** | Paste `address,amount` or drop a CSV (up to 1,000 rows). Validates every row, merges duplicates, prices the run, then sends batch by batch with pause and per-batch retry.      |
| **Oven**    | Supply, decimals, authorities, active Token-2022 extensions, top-20 holders with a distribution chart, and the airdrops you ran from this browser.                              |

### Screenshots

> **Not captured yet.** The screenshots and the flow GIF are taken from the real
> app against Cookie Chain mainnet, which needs a funded wallet — see
> [What is still missing](#what-is-still-missing). Placing mockups here instead
> would misrepresent the build, so the section stays empty until the real run
> happens.

---

## Why this stack

Cookie Chain is its own SVM, **not** Solana mainnet. That single fact drives
every technical decision in the app:

- **The wallet only ever signs. The app sends.** `walletSigner()` fills the
  `payer` role and `solanaRpc({ rpcUrl })` supplies the transaction planner and
  executor, so `client.sendTransaction` submits through _our_ RPC. A wallet-side
  `signAndSendTransaction` would land the transaction on the wrong chain. This
  was verified by reading Kit's signing path and then confirmed with a real
  Nightly signature — see [`docs/decisions.md`](./docs/decisions.md).
- **Kit's plugin client, not framework-kit.** `@solana/kit` +
  `@solana/kit-plugin-rpc` + `@solana/kit-plugin-wallet` with `@solana/react`
  bindings. `@solana/web3.js` 1.x, `@solana/spl-token` and
  `@solana/wallet-adapter-*` are not used anywhere.
- **The blockhash is fetched per batch, not per run.** Measured on this chain, a
  human-approved transaction missed its validity window by a single block: the
  time someone spends reading the wallet prompt outlives the blockhash. So each
  airdrop batch is planned at the moment it is sent, and gets one automatic
  retry.

| Layer                     | Package                                     |
| ------------------------- | ------------------------------------------- |
| SDK                       | `@solana/kit` v8                            |
| RPC + tx planner/executor | `@solana/kit-plugin-rpc`                    |
| Wallet Standard           | `@solana/kit-plugin-wallet` (+ `/react`)    |
| React bindings            | `@solana/react`                             |
| Data cache                | `swr` (via `@solana/react/swr`)             |
| Programs                  | `@solana-program/{token-2022,token,system}` |
| UI                        | React 19 · Vite 7 · Tailwind 4 · Recharts   |

---

## Running it locally

```bash
git clone https://github.com/el-frontend/cookie-bakery.git
cd cookie-bakery
npm install
cp .env.example .env     # already filled in with Cookie Chain mainnet
npm run dev
```

```bash
npm run dev           # Vite dev server
npm test              # Vitest — 400+ tests
npm run build         # tsc -b && vite build
npm run lint          # eslint
npm run ci            # build + lint + format:check
```

`npm run ci` does **not** run the tests. Run both before shipping.

### Environment variables

All five are **required**. The app validates them at startup and fails with a
readable message rather than surfacing later as an empty wallet list or a
silent RPC timeout.

| Variable            | Value for Cookie Chain mainnet    | What it does                                                                      |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `VITE_RPC_URL`      | `https://rpc.cookiescan.io`       | Reads and transaction submission. The WebSocket URL is derived by swapping `wss`. |
| `VITE_DAS_URL`      | `https://api.cookiescan.io`       | Holder lists. Falls back to `getTokenLargestAccounts` when unavailable.           |
| `VITE_EXPLORER_URL` | `https://cookiescan.io`           | Base for every explorer link in the UI.                                           |
| `VITE_BRIDGE_URL`   | `https://hyperlane.cookiescan.io` | Linked from "not enough COOK" errors and the help modal.                          |
| `VITE_WALLET_CHAIN` | `solana:mainnet`                  | Wallet Standard chain id. ⚠️ See the warning below.                               |

> ⚠️ **`VITE_WALLET_CHAIN` fails silently when wrong.** Wallet discovery filters
> on `uiWallet.chains.includes(chain)`, so a value no installed wallet
> advertises produces an **empty wallet list with no error** — indistinguishable
> from "no wallet installed". The value above was resolved empirically; the
> app names the configured chain in its empty state so the two cases can be
> told apart.

---

## How to connect Nightly

<a id="how-to-connect-nightly"></a>

The app links here from its "no wallet found" state, and the same four steps are
in the **How to start** modal in the header.

1. **Install [Nightly](https://nightly.app).** It is the wallet verified against
   this chain. Other Wallet Standard wallets are discovered automatically but
   are best-effort.
2. **Add Cookie Chain as a custom network** with the RPC endpoint
   `https://rpc.cookiescan.io`. Cookie Chain is a separate SVM — the app never
   sends through the wallet's own endpoint, only through this one.
3. **Get some COOK.** Every transaction costs COOK for fees and rent. Bridge
   assets in at https://hyperlane.cookiescan.io. COOK has 9 decimals, like SOL.
4. **Come back and connect.** The header shows the chain, the RPC latency, your
   address and your balance once you are in.

---

## Demo tokens on mainnet

> **Not created yet.** `Bakery Cookie (BAKE)` and its test airdrop require real
> COOK in a funded wallet, which the project does not have at the time of
> writing. When they exist, this table carries the mint address and the airdrop
> signatures, each verifiable on CookieScan.

| Item               | Value     |
| ------------------ | --------- |
| BAKE mint address  | _pending_ |
| Bake transaction   | _pending_ |
| Airdrop signatures | _pending_ |

---

## Deploying

The repo ships a [`vercel.json`](./vercel.json) with an SPA rewrite and a
Content-Security-Policy. Import the repo in Vercel, set the five environment
variables above, and deploy — the build command and output directory are
already declared.

**Two CSP decisions worth knowing about**, both forced by the feature set
rather than chosen:

- `img-src 'self' https:` — token metadata images point at domains the token's
  creator chose (IPFS gateways, Arweave, arbitrary CDNs). Narrowing this would
  break the feature. Images render with `referrerpolicy="no-referrer"` so the
  page URL never leaks, but the viewer's IP does reach that host. `data:` is
  refused, in code and in the CSP.
- `connect-src 'self' https: wss:` — the app fetches each token's metadata JSON
  from a creator-chosen origin. The protection is in the code, not the CSP: only
  `https:`, no credentials, no referrer, an 8s timeout, a 64 KiB cap enforced by
  streaming, and every string flattened to plain text before it reaches the DOM.

`script-src 'self'` stays strict — no third-party script executes, ever.

---

## Security posture

- **No keys, ever.** The app never requests, stores or logs a seed phrase or a
  private key. It has no backend to send one to.
- **Simulate before signing.** `solanaRpc` simulates to estimate resource limits
  before the wallet is asked, and the UI shows the cost and the result first.
- **On-chain and remote data are untrusted input.** Token names, symbols, memos
  and metadata JSON are treated as hostile: tags stripped, Unicode bidi
  overrides removed (they are not markup, so escaping alone does nothing about
  a name that renders backwards), length capped, and never followed as
  instructions. Accounts are checked for existence and expected owner **before**
  being decoded.
- **The idempotent ATA instruction** is used for airdrops, so a race with
  someone else funding the same recipient mid-run is a no-op rather than a
  failed batch.

---

## What is still missing

Honest status, rather than a checklist of green ticks:

| Item                                                  | Blocked on                   |
| ----------------------------------------------------- | ---------------------------- |
| Public Vercel URL                                     | A deploy                     |
| `Bakery Cookie (BAKE)` demo mint + airdrop signatures | Real COOK in a funded wallet |
| Screenshots and the flow GIF                          | The above                    |
| End-to-end run in a clean browser with Nightly        | The above                    |
| The "under a minute to understand" review             | A person outside the project |

Everything else — the three screens, the batching executor, the DAS client with
its RPC fallback, the sanitisers, the help modal and the accessibility sweep —
is built and covered by tests.

---

## Documentation

- [`docs/prds/PRD-cookie-bakery.md`](./docs/prds/PRD-cookie-bakery.md) — the
  source of truth: requirements RF-01…RF-07 with acceptance criteria.
- [`docs/decisions.md`](./docs/decisions.md) — what was probed on this chain and
  what came back, including the things the PRD got wrong.
- [`docs/plans/`](./docs/plans/) — one execution plan per requirement.
- [`docs/x-thread.md`](./docs/x-thread.md) — the launch thread draft.

## License

[MIT](./LICENSE) © Carlos Chao
