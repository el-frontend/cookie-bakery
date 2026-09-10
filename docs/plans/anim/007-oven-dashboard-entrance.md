# 007 — Let the Oven dashboard arrive instead of teleporting

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: LOW
- **Category**: 7 — Cohesion / 8 — Missed opportunities
- **Estimated scope**: 1 file (`src/app/Oven.tsx`), 4 class strings

## Problem

Reading a mint is a real round-trip to a community RPC plus a DAS call for
holders. While it runs the screen shows one line of text; when it lands, the
header, four stat tiles, the extension list, the chart and two tables all appear
at once, with no entrance — on the one screen in the app that does not use the
entrance system every other screen uses.

```tsx
// src/app/Oven.tsx:240-245 — current: the loading line
{
  isLoading ? (
    <p className="rounded-xl border border-border-low bg-card px-5 py-8 text-center text-sm text-ink-3">
      Reading the mint from Cookie Chain…
    </p>
  ) : null;
}
```

```tsx
// src/app/Oven.tsx:256-258 — current: everything below appears in one frame
      {loaded && label ? (
        <>
          <header className="flex flex-wrap items-center gap-4 rounded-xl border border-border-low bg-card p-5">
```

Compare with `src/app/Bake.tsx:288,318,328,497,510` and
`src/app/Airdrop.tsx:425,495,519,628,641`, where every block carries `.enter`.

## Target

Three entrance steps, matching the rest of the app. The comment at
`src/index.css:189` is explicit that three is the maximum — "a long cascade reads
as the interface being slow" — so the six blocks group into three:

| Block           | Line                   | Class to prepend |
| --------------- | ---------------------- | ---------------- |
| `<header>`      | `src/app/Oven.tsx:258` | `enter enter-1 ` |
| stats grid      | `src/app/Oven.tsx:312` | `enter enter-2 ` |
| extensions card | `src/app/Oven.tsx:351` | `enter enter-3 ` |
| history block   | `src/app/Oven.tsx:400` | `enter enter-3 ` |

## Repo conventions to follow

- `.enter` / `.enter-1` / `.enter-2` / `.enter-3` are defined at
  `src/index.css:176-198` and are applied by prepending them to an existing
  className string — exemplar: `src/app/Airdrop.tsx:425`:

  ```tsx
  <div className="enter enter-1 flex flex-col gap-[7px]">
  ```

- The entrance fires on mount via `@starting-style`; no React state is involved
  and none should be added.
- Reduced motion is already handled through `--enter-shift`.

## Steps

1. `src/app/Oven.tsx:258` — prepend `enter enter-1 ` to the `<header>` className.

2. `src/app/Oven.tsx:312` — prepend `enter enter-2 ` to the stats grid className:

   ```tsx
   <div className="enter enter-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
   ```

3. `src/app/Oven.tsx:351` — prepend `enter enter-3 ` to the extensions card
   className.

4. `src/app/Oven.tsx:400` — prepend `enter enter-3 ` to the "Airdrops from this
   device" wrapper className.

5. Leave `<HoldersTable>` (line 392) and the `<Suspense>` chart (line 380) alone
   — they sit between two `enter-3` blocks and inherit the same visual moment;
   adding a fourth step would push the cascade past the three the design allows.

## Boundaries

- Do NOT add `.enter` to `<Stat>` tiles individually — the grid animates as one
  block.
- Do NOT animate the Suspense fallback swap (`src/app/Oven.tsx:380-390`). The
  `animate-pulse` skeleton is correct as it stands, and cross-fading a lazy chunk
  boundary means holding the old node — not worth it for a one-time chunk load.
- Do NOT touch the data flow, SWR keys, or the `loaded && label` condition.
- Do NOT add a skeleton for the whole dashboard; that is a different design
  decision and is out of scope here.
- If plan 002 has run, `.enter` inside the Oven is automatically the fast
  no-stagger variant when the user arrives by navigation, which is intended —
  do not try to opt out of it.
- If the excerpts no longer match, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green (`src/app/Oven.test.tsx`
  queries by `data-testid` and role, none of which change).
- **Feel check**: `npm run dev`, go to Oven, paste a mint that exists on Cookie
  Chain:
  - when the data lands, the header arrives first and the rest follows within
    ~120ms — a single soft cascade, not six independent animations;
  - throttle the network (DevTools → Network → Slow 3G) and confirm the loading
    line is replaced by the cascade rather than by a snap;
  - navigate away to Bake and back: the entrance should be the fast variant if
    plan 002 is in (no visible stagger), and the screen must never feel like it
    is still assembling when you click something;
  - DevTools → Rendering → reduced motion: blocks fade, nothing rises.
- **Done when**: the four blocks carry `.enter` with the right step, the cascade
  is at most three steps deep, and the suite is green.
