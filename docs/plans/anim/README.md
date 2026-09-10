# Animation plans

Eleven self-contained plans from a motion audit of the app at commit `5f1294b`.
Each one is written for an executor with no context: exact files, exact lines,
exact curves and durations, and a feel check that a human (or an agent driving a
browser) can run.

These are **not** RF plans — they carry no acceptance criteria from
`docs/prds/PRD-cookie-bakery.md`. They live here rather than in `docs/plans/`
so the RF plans stay the record of the bounty scope.

## What the audit found already correct

Do not "improve" these; they were deliberate and they are right:

- `--ease-strong-out: cubic-bezier(0.23, 1, 0.32, 1)` and `--ease-strong-in-out`
  as the only two curves (`src/index.css:49-50`), with the naming rationale in
  the comment above them.
- `.enter` / `.pop-in` built on `@starting-style` instead of mount flags.
- `prefers-reduced-motion` treated as "gentler, not none" — distance collapses via
  `--enter-shift` / `--enter-scale`, opacity survives (`src/index.css:147-166`).
- Press feedback `active:scale-[0.97]` at 160ms on the one pressable primitive
  (`src/components/ui/Button.tsx:24-28`).
- Recharts gated on `usePrefersReducedMotion()` (`src/components/HoldersChart.tsx:155`),
  because a JS-interpolated chart ignores the CSS media query.
- Lazy-loading the chart (`src/app/Oven.tsx:63`) — do not import it eagerly to
  make an animation easier.

Also noted, outside animation scope: **`src/components/TxStatus.tsx` is dead
code** — nothing but its own test imports it. Plan 004 deliberately skips it.

## Plans

| #                                          | Title                                                         | Severity | Files                                                                                              | Status |
| ------------------------------------------ | ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | ------ |
| [001](001-toast-enter-exit.md)             | Give toasts an entrance and an exit                           | HIGH     | `index.css`, `Toast.tsx`, `ToastProvider.tsx`                                                      | DONE   |
| [002](002-entrance-only-on-first-mount.md) | Stop replaying the staggered entrance on every section switch | HIGH     | `App.tsx`, `index.css`                                                                             | DONE   |
| [003](003-retire-scaffold-hover-lift.md)   | Retire the scaffold's hover-lift motion                       | MEDIUM   | `WalletButton.tsx`, `NetworkIndicator.tsx`, `ProgramLogViewer.tsx`, `AddressChip.tsx`, `Toast.tsx` | DONE   |
| [004](004-indeterminate-waiting-signal.md) | Give the long waits an indeterminate signal                   | MEDIUM   | `index.css`, `BakeSummary.tsx`, `Airdrop.tsx`                                                      | DONE   |
| [005](005-help-modal-enter-exit.md)        | Animate the "How to start" modal                              | MEDIUM   | `index.css`, `GettingStartedModal.tsx`, `App.tsx`                                                  | DONE   |
| [006](006-batch-status-transitions.md)     | Transition the airdrop's live batch statuses                  | MEDIUM   | `BatchTable.tsx`                                                                                   | DONE   |
| [007](007-oven-dashboard-entrance.md)      | Let the Oven dashboard arrive instead of teleporting          | LOW      | `Oven.tsx`                                                                                         | DONE   |
| [008](008-progress-bar-transform.md)       | Drive the progress bar with `transform`, not `width`          | LOW      | `Airdrop.tsx`                                                                                      | DONE   |
| [009](009-advanced-disclosure.md)          | Make the "Advanced" disclosure open smoothly                  | LOW      | `index.css`, `Bake.tsx`                                                                            | DONE   |
| [010](010-token-selector-swap.md)          | Soften the token selector's panel swap                        | LOW      | `TokenSelector.tsx`                                                                                | DONE   |
| [011](011-checkbox-tick.md)                | Give the checkbox tick a real entrance                        | LOW      | `ui/Field.tsx`                                                                                     | DONE   |

## Recommended order

Numeric order is the recommended order — it runs highest leverage first and
keeps the shared-file edits sequential.

If you only run part of it: **001, 002, 003, 004** are the four that change how
the whole app feels. 005-008 are per-surface polish. 009-011 are details.

## Dependencies and conflicts

- **`src/index.css` is edited by 001, 002, 004, 005 and 009.** Every one of them
  appends to `@layer components` (or, for 009, also `:root`). Run them one at a
  time and let each land before starting the next; running two in parallel
  against the same layer will conflict.
- **`src/components/Toast.tsx` is edited by 001 and 003.** Different lines, but
  001 adds a prop that shifts 003's target down a few lines — 003 tells the
  executor to match on the class string rather than the line number.
- **`src/App.tsx` is edited by 002 and 005 (step 4 only).** Different state and
  different JSX; either order works.
- **002 changes how `.enter` behaves after a navigation, which affects 007.**
  That is intended: the Oven's new entrance should also be the fast variant when
  the user arrives by clicking the nav. Run 002 first if you plan to do both.
- Everything else is independent.

## Executing one

Each plan is written to be handed to any agent as-is: give it the file path and
tell it to follow the plan exactly, including the boundaries. The verification
section is the definition of done — the mechanical half (`npm run ci`,
`npm test`) is checkable by the agent, the feel check needs a browser.

When a plan is done, change its `**Status**` line to `DONE` and update the table
above.
