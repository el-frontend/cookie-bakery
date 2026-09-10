# 008 — Drive the airdrop progress bar with `transform`, not `width`

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: LOW
- **Category**: 5 — Performance
- **Estimated scope**: 1 file (`src/app/Airdrop.tsx`), ~8 lines

## Problem

The progress bar animates `width`, which is a layout property: every frame of the
320ms transition re-lays out and repaints the bar instead of staying on the
compositor.

```tsx
// src/app/Airdrop.tsx:435-450 — current
<div
  aria-label="Progress"
  aria-valuemax={summary.total}
  aria-valuemin={0}
  aria-valuenow={summary.confirmed}
  className="h-2 w-full overflow-hidden rounded-full bg-raised"
  role="progressbar"
>
  <div
    className="h-full rounded-full bg-accent transition-[width] duration-[320ms] [transition-timing-function:var(--ease-strong-out)]"
    style={{
      width: `${summary.total === 0 ? 0 : (summary.confirmed / summary.total) * 100}%`,
    }}
  />
</div>
```

**Honest scoping**: this bar advances once per confirmed batch — a handful of
times per run — so the measurable cost here is near zero. The reason to fix it is
consistency: this is the only place in the codebase that animates a layout
property, and it is the one a future contributor will copy.

## Target

`scaleX` from the left edge, with the track keeping the rounded shape.

```tsx
/* target */
<div
  aria-label="Progress"
  aria-valuemax={summary.total}
  aria-valuemin={0}
  aria-valuenow={summary.confirmed}
  className="h-2 w-full overflow-hidden rounded-full bg-raised"
  role="progressbar"
>
  <div
    className="h-full w-full origin-left bg-accent transition-transform duration-[320ms] [transition-timing-function:var(--ease-strong-out)]"
    style={{
      transform: `scaleX(${summary.total === 0 ? 0 : summary.confirmed / summary.total})`,
    }}
  />
</div>
```

Two details that matter:

- `rounded-full` is **removed from the inner bar**. A scaled rounded rectangle
  squashes its own corner radius into an ellipse; the track already has
  `overflow-hidden rounded-full`, so it clips the fill into the right shape at
  any scale.
- `origin-left` is required. Without it the bar grows from its centre in both
  directions.

## Repo conventions to follow

- Arbitrary durations and the curve token are written as Tailwind arbitrary
  values in this codebase: `duration-[320ms]
[transition-timing-function:var(--ease-strong-out)]` — keep exactly that shape.
- Inline `style` is already how this component feeds a computed number into CSS;
  keep it, do not introduce a CSS custom property on the parent (setting a
  variable on a parent to drive a child's transform forces a style recalc for the
  whole subtree — the opposite of the point of this plan).

## Steps

1. `src/app/Airdrop.tsx:443-448` — replace the inner `<div>` with the **Target**
   version: className and `style` both change, the outer track div is untouched.

2. Confirm the ratio stays a plain number (`confirmed / total`), not a
   percentage string — `scaleX()` takes a unitless factor.

## Boundaries

- Do NOT change `aria-valuenow`, `aria-valuemax`, `aria-valuemin`, `role`, or
  `aria-label`. Screen-reader progress is reported by those attributes, not by
  the visual bar, and `src/app/Airdrop.test.tsx` reads them.
- Do NOT add a shimmer, a stripe pattern, or an indeterminate state to this bar —
  it is determinate by definition, and the indeterminate case is handled
  separately by plan 004.
- Do NOT change the 320ms duration; a progress bar is on-screen movement, and
  320ms on `--ease-strong-out` is the deliberate choice here.
- If the excerpt no longer matches, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev`, run an airdrop with three or more batches:
  - the bar grows from the left edge, never from the centre;
  - at low progress the left end is still round and the right end is a clean
    vertical edge — no squashed oval;
  - the bar reaches exactly the full width at 100%, with no sliver of track left;
  - DevTools → Performance, record while a batch confirms: the transition shows
    composite-only frames, no "Layout" entries for the bar.
- **Done when**: `grep -n "transition-\[width\]" src` returns nothing, the bar
  still tracks the batch count exactly, and the suite is green.
