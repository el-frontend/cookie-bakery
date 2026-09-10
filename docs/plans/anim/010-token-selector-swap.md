# 010 — Soften the token selector's panel swap

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: LOW
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 1 file (`src/components/TokenSelector.tsx`), 2 class strings

## Problem

`TokenSelector` renders two completely different shapes from the same slot: a
tall picker panel (list of saved tokens + a paste field) and, once a token is
chosen, a short one-line summary row. Choosing a token replaces one with the
other in a single frame, and everything below jumps up by the height difference.
Clicking "Change" jumps it back down. It happens on both the Airdrop and the Oven
screens, which both mount this component at the top of the page.

```tsx
// src/components/TokenSelector.tsx:122-127 — current: the selected row
  if (value) {
    return (
      <div
        data-testid="token-selected"
        className="flex items-center gap-3.5 rounded-xl border border-border-low bg-card px-5 py-4"
      >
```

```tsx
// src/components/TokenSelector.tsx:151-152 — current: the picker panel
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5">
```

## Target

Each branch announces itself with the entrance the codebase already uses for a
block that appears in place. The layout still resizes instantly — what changes is
that the arriving content is clearly _new_ rather than a page that shifted under
the cursor.

```tsx
/* target — selected row */
      <div
        data-testid="token-selected"
        className="pop-in flex items-center gap-3.5 rounded-xl border border-border-low bg-card px-5 py-4"
      >
```

```tsx
/* target — picker panel */
    <div className="enter flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5">
```

`.pop-in` (scale from 0.96) for the selected row because it is a result — the
same treatment the bake result card gets. `.enter` (an 8px rise) for the picker
because it is a return to a form, and a form should not celebrate.

## Repo conventions to follow

- `.pop-in` is defined at `src/index.css:201-212` and used at
  `src/components/TokenResultCard.tsx:24` — prepend it to the className, nothing
  else changes.
- `.enter` is defined at `src/index.css:176-187`; exemplar usage at
  `src/app/Airdrop.tsx:425`.
- Both are `@starting-style` transitions that fire on mount, and both already
  collapse to a pure fade under `prefers-reduced-motion` via `--enter-shift` /
  `--enter-scale`.

## Steps

1. `src/components/TokenSelector.tsx:126` — prepend `pop-in ` to the selected
   row's className.

2. `src/components/TokenSelector.tsx:152` — prepend `enter ` to the picker
   panel's className.

## Boundaries

- Do NOT animate the height difference between the two panels. Smoothing it means
  measuring one branch while the other is mounted — a lot of machinery for a
  transition the user triggered deliberately.
- Do NOT keep both branches mounted, and do NOT add a wrapper element or change
  the `if (value)` early return.
- Do NOT touch `select()`, `inspectMint`, or any of the validation logic — the
  chain read is what makes this component correct and it is out of scope.
- Do NOT add motion to the individual "My tokens" rows; they already have the
  right hover treatment at `src/components/TokenSelector.tsx:161`.
- If the excerpts no longer match, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green
  (`src/app/Airdrop.test.tsx` and `src/app/Oven.test.tsx` both drive this
  component through `token-selected` / `token-change`).
- **Feel check**: `npm run dev`, Airdrop screen with at least one saved token:
  - pick a token: the summary row scales up slightly as it appears rather than
    materialising;
  - press "Change": the picker rises into place;
  - do it four times in a row — neither branch should flicker or double-animate;
  - DevTools → Rendering → reduced motion: both branches fade only.
- **Done when**: both branches carry an entrance class, no other behaviour
  changed, and the suite is green.
