# 006 — Transition the airdrop's live batch statuses

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: MEDIUM
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 1 file (`src/components/BatchTable.tsx`), ~6 lines

## Problem

During a run, every batch row cycles Waiting → Signing → Sent → Confirmed, and
each step swaps both the pill's background and its text colour instantly. This
is the screen the user actually stares at while their tokens are being sent, and
it flickers between states like a table of raw data rather than a process moving
forward.

```tsx
// src/components/BatchTable.tsx:19-25 — current
const PILL: Record<BatchStatus, string> = {
  confirmed: "bg-success/12 text-success",
  failed: "bg-danger/12 text-danger",
  pending: "bg-raised text-ink-3",
  sent: "bg-accent/12 text-accent",
  signing: "bg-accent/12 text-accent",
};
```

```tsx
// src/components/BatchTable.tsx:73-82 — current: no transition
            <span
              className={
                "ml-auto rounded-chip px-2.5 py-[3px] text-[11px] font-semibold " +
                PILL[batch.status]
              }
              data-testid={`batch-status-${batch.index}`}
            >
```

```tsx
// src/components/BatchTable.tsx:108-113 — current: the error appears with no entrance
{
  batch.error ? (
    <p className="text-[12.5px] leading-relaxed text-danger">
      <span className="font-semibold">{batch.error.title}</span> —{" "}
      {batch.error.detail}
    </p>
  ) : null;
}
```

## Target

The pill's colours cross-fade on the app's standard interaction timing; the
error text fades and rises in the same way as every other block in the app.

```tsx
/* target — the pill's className */
              className={
                "ml-auto rounded-chip px-2.5 py-[3px] text-[11px] font-semibold " +
                "transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
                PILL[batch.status]
              }
```

```tsx
/* target — the error paragraph */
            <p className="enter text-[12.5px] leading-relaxed text-danger">
```

## Repo conventions to follow

- `160ms` + `var(--ease-strong-out)` is the app's interaction timing — see
  `src/components/ui/Button.tsx:26` and `src/components/TokenSelector.tsx:161`,
  both of which already use `transition-colors duration-[160ms]
[transition-timing-function:var(--ease-strong-out)]`.
- `.enter` (`src/index.css:176-187`) is the standard entrance for a block that
  appears: opacity plus an 8px rise, reduced-motion-safe through
  `--enter-shift`. Used the same way at `src/app/Airdrop.tsx:425`.
- Class strings are concatenated with `+` in this file; keep that shape.

## Steps

1. `src/components/BatchTable.tsx:74-78` — add the transition triple to the pill's
   className exactly as in **Target**, before `PILL[batch.status]`. Do not touch
   the `PILL` map itself.

2. `src/components/BatchTable.tsx:109` — prepend `enter ` to the error
   paragraph's className.

## Boundaries

- Do NOT animate the row's height when the error appears. The row growing pushes
  the rows below it, and smoothing that means transitioning `height` or
  `grid-template-rows` on a list that can hold many rows — layout work on the
  exact frames where the app is also signing and sending. The text fades in; the
  row still snaps. That is the accepted trade-off.
- Do NOT add motion to the Retry button (`BatchTable.tsx:96-105`) — it appears on
  failure, next to an error that is already animating; two entrances competing in
  one row is noise.
- Do NOT change `PILL`, `LABEL`, the status logic, or any `data-testid`.
- Do NOT stagger the rows. A run's rows all exist from the start; only their
  statuses change.
- If the excerpts no longer match, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green (`src/app/Airdrop.test.tsx`
  asserts on `batch-status-*` text — the text does not change here).
- **Feel check**: `npm run dev`, run an airdrop with at least two batches (a CSV
  with ~12 rows produces two at the default of 8 transfers per transaction):
  - each pill's colour eases from grey to amber to green instead of snapping;
  - the colour change is quick enough that a batch confirming while you look
    elsewhere still reads as "done" when you look back — if it feels slow, the
    duration was raised above 160ms;
  - force a failure (disconnect the network mid-run): the error line fades and
    rises rather than appearing instantly;
  - DevTools → Rendering → reduced motion: colours still cross-fade, the error
    text no longer rises.
- **Done when**: no status pill changes colour instantly, the error text uses
  `.enter`, and the suite is green.
