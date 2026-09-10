# 002 — Stop replaying the staggered entrance on every section switch

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: HIGH
- **Category**: 1 — Purpose & frequency
- **Estimated scope**: 2 files (`src/App.tsx`, `src/index.css`), ~15 lines

## Problem

Clicking Bake / Airdrop / Oven in the top bar is the most repeated interaction
in this app. Each click unmounts one screen and mounts another, and every
mounted screen replays the full staggered entrance:

```css
/* src/index.css:176-198 — current */
.enter {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 240ms var(--ease-strong-out),
    transform 240ms var(--ease-strong-out);

  @starting-style {
    opacity: 0;
    transform: translateY(var(--enter-shift));
  }
}

/* Three steps only. A long cascade reads as the interface being slow. */
.enter-1 {
  transition-delay: 0ms;
}
.enter-2 {
  transition-delay: 60ms;
}
.enter-3 {
  transition-delay: 120ms;
}
```

Used at `src/app/Bake.tsx:288,318,328,497,510` and
`src/app/Airdrop.tsx:425,495,519,628,641`, so the last group settles
`120ms + 240ms = 360ms` after every single nav click, with an 8px rise.

That is right for the first paint and wrong for navigation: the audit rule is
that anything hit tens of times a day gets its motion drastically reduced. The
first visit should feel composed; the twentieth click should feel instant.

```tsx
// src/App.tsx:33-41 — current: navigation carries no signal about being a repeat
const navigate = useCallback((next: Section) => {
  setSection(next);
  setHandoffToken(null);
}, []);

const airdropToken = useCallback((token: SelectedToken) => {
  setHandoffToken(token);
  setSection("airdrop");
}, []);
```

## Target

The first screen the app paints keeps the current 240ms staggered entrance.
Every screen mounted by a _navigation_ fades in once, fast, with no stagger and
a shorter rise:

```css
/* target — src/index.css, inside @layer components, after .enter-3 */
/*
   * After the first navigation the entrance is no longer an introduction, it is
   * latency. Same curve, a third of the distance, no cascade.
   */
[data-nav="repeat"] {
  --enter-shift: 4px;
}

[data-nav="repeat"] .enter {
  transition-duration: 140ms;
  transition-delay: 0ms;
}
```

`[data-nav="repeat"] .enter` has specificity 0,2,0 and beats `.enter-1/2/3`
(0,1,0), so the delays are overridden without `!important`.

## Repo conventions to follow

- Motion classes live in `@layer components` in `src/index.css:169-226`; put the
  new rules directly after `.enter-3` (line 198) so the entrance system stays in
  one block.
- `--enter-shift` is a `:root` custom property (`src/index.css:53`) that the
  reduced-motion block already zeroes (`src/index.css:153-157`). Overriding it on
  a container is the established way to change entrance distance — do not
  hard-code pixel values into `.enter`.
- State that must not survive a reload lives in `App.tsx`, not in a store — see
  the comment at `src/App.tsx:14-25` about `handoffToken`.

## Steps

1. In `src/App.tsx`, add the flag next to the existing state (line 27-29):

   ```tsx
   const [hasNavigated, setHasNavigated] = useState(false);
   ```

2. Set it in both navigation callbacks (lines 33-41):

   ```tsx
   const navigate = useCallback((next: Section) => {
     setSection(next);
     setHandoffToken(null);
     setHasNavigated(true);
   }, []);

   const airdropToken = useCallback((token: SelectedToken) => {
     setHandoffToken(token);
     setSection("airdrop");
     setHasNavigated(true);
   }, []);
   ```

3. Expose it to CSS on the `<main>` element (`src/App.tsx:65`):

   ```tsx
   <main
     className="flex flex-grow justify-center px-6 py-11 sm:px-8"
     data-nav={hasNavigated ? "repeat" : "first"}
   >
   ```

4. In `src/index.css`, add the two rules from **Target** to `@layer components`,
   directly after `.enter-3`.

## Boundaries

- Do NOT remove `.enter`, `.enter-1`, `.enter-2` or `.enter-3`, and do NOT change
  their values — the first paint must be untouched.
- Do NOT animate the container's width. `src/App.tsx:71-75` swaps
  `max-w-[560px]` ↔ `max-w-[760px]` on an element that stays mounted, so a
  `max-width` transition is technically possible — it is forbidden here because
  it re-lays out the entire screen (tables, and Recharts on the Oven) on every
  frame for 200ms. The width change lands with the content swap and reads as
  "different screen", not as a jump.
- Do NOT add an exit animation for the outgoing screen. An out-then-in sequence
  adds its own duration to every nav click, which is the problem this plan exists
  to remove.
- Do NOT touch `TopBar.tsx`.
- If `navigate` or `<main>` no longer look like the excerpts above, STOP and
  report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev`:
  - on first load, Bake still arrives in three visible steps;
  - click Airdrop, then Oven, then Bake: each screen settles in one soft fade with
    no cascade, and nothing is still moving by the time your eye reaches it;
  - DevTools → Elements: `<main>` carries `data-nav="first"` before any nav click
    and `data-nav="repeat"` after;
  - DevTools → Animations at 10% playback on a repeat navigation: the groups all
    start at the same moment (no 60/120ms offsets).
- **Done when**: navigating never takes longer than ~140ms to settle, the first
  paint is unchanged, and the suite is green.
