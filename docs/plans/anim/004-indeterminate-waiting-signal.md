# 004 — Give the long waits an indeterminate signal

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: MEDIUM (highest-value addition in this set)
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 3 files (`src/index.css`, `src/components/BakeSummary.tsx`, `src/app/Airdrop.tsx`), ~35 lines

## Problem

The longest, tensest moments in this product have no motion at all. Simulating
against the RPC, waiting for a human to read the Nightly prompt, and confirming
on a community-run chain can take anywhere from two seconds to half a minute —
and during all of it the screen is completely still. The only feedback is a
disabled button whose label gained an ellipsis:

```tsx
// src/components/BakeSummary.tsx:273-311 — current
        <Button
          data-testid="bake-submit"
          disabled={blocked}
          onClick={onSubmit}
          size="lg"
          className="w-full"
        >
          {isPlanning ? null : (
            <svg ... />
          )}
          {isPlanning
            ? "Simulating…"
            : isSending
              ? "Waiting for signature…"
              : "Bake token"}
        </Button>
```

```tsx
// src/app/Airdrop.tsx:686-699 — current
<Button
  className="w-full"
  data-testid="airdrop-prepare"
  disabled={!canPrepare || isPreparing}
  disabledReason={prepareBlockedReason ?? undefined}
  onClick={() => void prepare()}
  size="lg"
>
  {payer
    ? isPreparing
      ? "Checking accounts…"
      : "Prepare airdrop"
    : "Connect a wallet to airdrop"}
</Button>
```

A still screen during an unbounded wait reads as "the app is stuck", which on a
wallet flow is the exact moment a user reaches for the reload button — and a
reload mid-signature is how people end up double-checking the chain to find out
what actually happened.

## Target

One shared indeterminate sweep, used by every "the chain is working" button. It
animates `transform` only, runs `linear` (constant motion, per the easing rules),
and is defined once:

```css
/* target — src/index.css, inside @layer components */
/*
   * The wait is unbounded — a simulation, a human reading a wallet prompt, a
   * confirmation on a community RPC. A determinate bar would be a lie, so this
   * is a sweep: it says "still working", not "this much left".
   */
.indeterminate {
  position: relative;
  overflow: hidden;
}

.indeterminate::after {
  content: "";
  position: absolute;
  inset-block-end: 0;
  inset-inline-start: 0;
  block-size: 2px;
  inline-size: 40%;
  background: currentColor;
  opacity: 0.45;
  animation: indeterminate 1200ms linear infinite;
}

@keyframes indeterminate {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(350%);
  }
}

/*
   * The global reduced-motion rule pins animation-duration, not the name, so
   * switching the name off here is what actually stops it.
   */
@media (prefers-reduced-motion: reduce) {
  .indeterminate::after {
    animation-name: none;
    inline-size: 100%;
    opacity: 0.25;
  }
}
```

Under reduced motion the sweep becomes a static 2px underline: still a visible
"busy" state, no movement — which is what "gentler, not none" means in this
codebase.

## Repo conventions to follow

- Reusable motion classes live in `@layer components` (`src/index.css:169-226`);
  add these after the `check-draw` keyframes (line 221-225), at the end of the
  layer.
- The file's reduced-motion philosophy is documented at `src/index.css:147-152`:
  opacity and colour survive, distance goes. The override above follows it.
- `.check-draw` (`src/index.css:215-219`) is the existing example of a keyframe
  animation in this project — a one-shot, never re-triggered. This one is
  deliberately the opposite (infinite) because the duration it represents is
  unknown; that is the only justification for a loop in this app.
- Button classes are composed as strings, `className` appended last — see
  `buttonClass()` at `src/components/ui/Button.tsx:89-99`.

## Steps

1. Add the `.indeterminate` rules, the `@keyframes indeterminate`, and the
   reduced-motion override to `src/index.css`, at the end of `@layer components`.

2. In `src/components/BakeSummary.tsx`, make the submit button carry the class
   while it is working. The component already computes both flags
   (`isPlanning`, `isSending` — props at lines 107-108):

   ```tsx
   <Button
     data-testid="bake-submit"
     disabled={blocked}
     onClick={onSubmit}
     size="lg"
     className={isPlanning || isSending ? "w-full indeterminate" : "w-full"}
   >
   ```

3. In `src/app/Airdrop.tsx:686-693`, do the same with `isPreparing`:

   ```tsx
   <Button
     className={isPreparing ? "w-full indeterminate" : "w-full"}
     data-testid="airdrop-prepare"
     ...
   ```

4. Check that `overflow: hidden` on the button does not clip the focus ring:
   `focus-visible:outline-2 focus-visible:outline-offset-2` is an `outline`, which
   is painted outside the padding box and is NOT clipped by `overflow`. Tab to the
   button and confirm visually anyway.

## Boundaries

- Do NOT add a spinner component, and do NOT add a dependency.
- Do NOT put this on anything whose duration is known or short. It is for waits
  on the chain only: the Bake submit and the Airdrop prepare buttons.
- Do NOT touch `src/components/TxStatus.tsx` — it is dead code (nothing but its
  own test imports it). Animating it would be work nobody sees.
- Do NOT change any button label, `disabled` logic, or `data-testid`.
- Do NOT make the sweep a determinate progress bar; the app cannot know how long
  a signature will take.
- If the button excerpts no longer match, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev` with a wallet connected on Cookie Chain:
  - press "Review transaction" on Bake: while it says "Simulating…" a thin accent
    sweep runs along the bottom edge of the button, left to right, and loops;
  - press "Bake token": the sweep continues through "Waiting for signature…"
    while the Nightly prompt is open, and stops the instant the flow moves on;
  - the sweep runs at a constant speed — no easing in or out (it is `linear` by
    design; if it looks like it slows at the edges, the curve was changed);
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": the sweep
    becomes a static full-width underline and nothing moves;
  - DevTools → Performance while the sweep runs: no layout or paint per frame,
    only composite — it is a `transform` on a pseudo-element.
- **Done when**: both buttons show a looping sweep only while a chain call is in
  flight, reduced motion leaves a static bar, and the suite is green.
