# 011 — Give the checkbox tick a real entrance (and drop a dead transition)

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: LOW
- **Category**: 3 — Physicality / 7 — Cohesion
- **Estimated scope**: 1 file (`src/components/ui/Field.tsx`), 2 class strings

## Problem

Two small things on the custom checkbox used by the Bake form's advanced options:

1. The box declares `transform` in its transition list, but nothing on the box
   ever transforms. A transition property that never fires is a false signal to
   the next reader.
2. The tick only fades in, over 120ms — a different duration from the box's 160ms
   next to it, so the box's colour lands after the tick has already appeared.

```tsx
// src/components/ui/Field.tsx:104-123 — current
      <span
        aria-hidden
        className={
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border " +
          "transition-[background-color,border-color,transform] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent " +
          (checked
            ? "border-accent bg-accent"
            : "border-border-strong bg-bg1 group-hover:border-ink-4")
        }
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={
            "transition-opacity duration-[120ms] " +
            (checked ? "opacity-100" : "opacity-0")
          }
        >
```

## Target

The tick scales up as it fades, on the same 160ms and the same curve as the box
it sits in, so checking the box is one movement instead of two.

```tsx
/* target — the box: transform removed from the transition list */
          "transition-[background-color,border-color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
```

```tsx
/* target — the tick */
          className={
            "transition-[opacity,transform] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
            (checked ? "opacity-100 scale-100" : "opacity-0 scale-75")
          }
```

`scale-75 → scale-100` is a growth, never `scale(0)`: the tick comes from
something, not from nothing.

## Repo conventions to follow

- `160ms` + `[transition-timing-function:var(--ease-strong-out)]` is the app's
  interaction timing — `src/components/ui/Button.tsx:26` is the reference, and
  the box in this same file already uses it.
- Class strings in this file are concatenated with `+` and the conditional part
  comes last; keep that shape.
- Under `prefers-reduced-motion` the global block does not touch transitions
  (`src/index.css:147-166`, deliberate — see the comment there). A 25% scale on
  an 18px box is a scale, not a distance, and stays. Do not add a media query.

## Steps

1. `src/components/ui/Field.tsx:108` — remove `,transform` from the box's
   transition list so it reads
   `transition-[background-color,border-color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] `.

2. `src/components/ui/Field.tsx:120-123` — replace the tick's className block with
   the **Target** version.

## Boundaries

- Do NOT add a stroke-draw animation to this tick. `.check-draw`
  (`src/index.css:215-219`) exists for the one-per-session success card; a
  checkbox is toggled repeatedly and a drawing animation would restart from zero
  every time (keyframes are not interruptible).
- Do NOT change the hidden native `<input>`, the `peer-*` classes, the focus
  ring, or the label markup — the real control underneath is what makes this
  accessible.
- Do NOT change the box's size, radius or colours.
- If the excerpts no longer match, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev`, Bake screen, open "Advanced", toggle a checkbox:
  - the tick grows into place as the box fills with amber, both finishing at the
    same moment;
  - toggle it rapidly six times: the tick shrinks and grows from wherever it is,
    never restarting from the smallest size (this is what makes transitions the
    right tool here);
  - the tick never disappears to nothing before it starts growing;
  - `grep -n "transform" src/components/ui/Field.tsx` shows the property only
    where something actually transforms.
- **Done when**: the tick and the box share one duration and one curve, no dead
  transition property remains, and the suite is green.
