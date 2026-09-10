# 009 — Make the "Advanced" disclosure open as smoothly as its chevron turns

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: LOW
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 2 files (`src/index.css`, `src/app/Bake.tsx`), ~15 lines

## Problem

The Token-2022 options on the Bake screen live behind a `<details>`. The chevron
rotates over 200ms — and the content it points at appears in a single frame. The
rotation actively draws the eye to the exact moment the snap happens.

```tsx
// src/app/Bake.tsx:385-394 — current
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold marker:content-none">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="text-ink-2 transition-transform duration-[200ms] [transition-timing-function:var(--ease-strong-out)] group-open:rotate-90"
            >
```

## Target

The disclosure's content animates its own height with `::details-content`, on the
same 200ms and the same curve as the chevron, so the two read as one gesture.

```css
/* target — src/index.css */

/* on :root, with the other global settings */
interpolate-size: allow-keywords;

/* in @layer components */
/*
   * The chevron already turns in 200ms; the panel it points at has to move in
   * the same 200ms or the rotation just announces a snap. `interpolate-size`
   * is what makes `block-size: auto` animatable; where it is unsupported the
   * disclosure opens instantly, exactly as it does today.
   */
.disclosure::details-content {
  block-size: 0;
  overflow: hidden;
  transition:
    block-size 200ms var(--ease-strong-out),
    content-visibility 200ms allow-discrete;
}

.disclosure[open]::details-content {
  block-size: auto;
}
```

This animates a layout property, which the rest of these plans avoid. It is
allowed here for one reason: it is a single, user-initiated, once-in-a-session
expansion of a form section — not something that runs while the app is doing
work. If it is ever applied to a list or a table, it is wrong.

## Repo conventions to follow

- Global properties belong on `:root` in `src/index.css:16-55`, next to
  `color-scheme: dark`; motion classes belong in `@layer components`
  (`src/index.css:169-226`).
- Durations and curves come from the same pair used by the chevron itself:
  `200ms` + `var(--ease-strong-out)` (`src/app/Bake.tsx:393`).
- The class is scoped (`.disclosure`) rather than styling every `<details>`,
  because a future `<details>` inside a table should not inherit this.

## Steps

1. In `src/index.css`, add `interpolate-size: allow-keywords;` to the `:root`
   block (after `color-scheme: dark;`).

2. In `src/index.css`, add the two `.disclosure` rules from **Target** at the end
   of `@layer components`.

3. `src/app/Bake.tsx:385` — add the class to the element:

   ```tsx
   <details className="disclosure group">
   ```

4. Verify the fallback: in a browser without `::details-content` support the
   selector simply does not match and the panel opens instantly — the behaviour
   shipping today. Do not add a JS fallback.

## Boundaries

- Do NOT apply `.disclosure` to any other element, and do NOT write a bare
  `details::details-content` rule.
- Do NOT replace `<details>`/`<summary>` with a custom disclosure. The native
  element carries the accessibility semantics for free and the form inside it is
  tested.
- Do NOT animate `height` with a measured pixel value from JS.
- Do NOT change the chevron's rotation, duration, or curve.
- If the excerpt no longer matches, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green. jsdom does not implement
  `::details-content`; no test should need changing, and if one breaks, report it
  rather than deleting it.
- **Feel check**: `npm run dev`, Bake screen, click "Advanced":
  - the panel expands over the same 200ms the chevron takes to turn, and the two
    finish together;
  - closing collapses just as smoothly, with no flash of full-height content;
  - open and close it rapidly three times: the panel retargets from its current
    height instead of jumping to full height first;
  - DevTools → Rendering → reduced motion: because this is a `transition` and the
    global reduced-motion block only pins `animation-*`, the height still eases.
    That is acceptable — it aids comprehension and carries no distance-based
    movement. Leave it.
- **Done when**: opening "Advanced" is a single 200ms gesture in a supporting
  browser, an instant open elsewhere, and the suite is green.
