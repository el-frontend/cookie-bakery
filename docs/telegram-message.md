# Cookie Chain Telegram message

Sharing the build in the community channel is a bounty requirement. Post this
after the X thread is live, and put the thread link where marked.

A channel is not a launch announcement — people there are builders and they
will open the repo. So this leads with what is different, admits what is not
verified, and asks for something specific. The X thread does the selling.

---

## The message

Hey 🍪 — built something for the "Create an App on Cookie Chain" bounty and
would appreciate eyes on it from people who actually use the chain.

**Cookie Bakery** — launch a Token-2022 mint, then run a giveaway where your
audience registers itself instead of you assembling a CSV.

https://cookie-bakery.elfrontendoficial.workers.dev

The part I'd most like feedback on: the draw is commit-reveal seeded by a
Cookie Chain block that doesn't exist yet when the commitment is written. Both
the commitment and the result land on chain as memo transactions, and what
proves the timing is that the commit landed in a slot below the target — not a
row in my database. Anyone can recompute the whole draw in their browser at
`/e/<event>/verify`.

Honest about the limits: it is not a VRF, and a verifiable draw doesn't make
the entry list honest — a creator could pad it. It makes the draw checkable,
not the creator trustworthy.

Demo mint (Token-2022, live on mainnet):
`54tqwHeoDwyY9hCRVGZtrHqvav1Zj27g4gNbRNQTN451`

Code is MIT, built on @solana Kit v8 — no web3.js 1.x, no wallet-adapter.
576 tests, including a row-level-security suite that runs against real
Postgres rather than mocks:
https://github.com/el-frontend/cookie-bakery

Thread with a demo GIF: {{THREAD_LINK}}

Two things I'd genuinely like:

1. Break the verify page. If you can make a draw look valid when it isn't, I
   want to know before anyone runs a real giveaway with it.
2. Tell me whether the registration page works on your phone. It's the only
   screen meant to be opened one-handed with a stream playing, and I've only
   tested it on mine.

---

## Notes

- Replace `{{THREAD_LINK}}` with the URL of the first tweet.
- If the channel discourages links in a first message, post the app URL and
  add the rest in a reply.
- Do not paste the whole X thread as text. People who want it will click.
