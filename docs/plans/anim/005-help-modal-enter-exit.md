# 005 — Animate the "How to start" modal

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: MEDIUM
- **Category**: 8 — Missed opportunities
- **Estimated scope**: 3 files (`src/index.css`, `src/components/GettingStartedModal.tsx`, `src/App.tsx`), ~25 lines

## Problem

The onboarding modal (RF-06.1) and its full-screen scrim appear and disappear
with nothing in between. A 70%-black scrim snapping over the whole app is the
most abrupt thing that happens in this UI, and it happens on the surface meant to
welcome a first-time user.

```tsx
// src/components/GettingStartedModal.tsx:107-121 — current
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-5"
      data-testid="getting-started-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby="getting-started-title"
        aria-modal="true"
        className="w-full max-w-[520px] rounded-xl border border-border-strong bg-card p-6 shadow-2xl"
        data-testid="getting-started-modal"
        ref={dialogRef}
        role="dialog"
      >
```

```tsx
// src/App.tsx:102-104 — current: mounted and unmounted with no transition
{
  helpOpen ? <GettingStartedModal onClose={() => setHelpOpen(false)} /> : null;
}
```

Modals are the textbook "occasional → standard animation" case: rare enough to
deserve motion, frequent enough that abruptness is felt.

## Target

The scrim fades; the dialog fades and scales up from `0.96`, both on
`--ease-strong-out`. The dialog is centred, so `transform-origin: center` is
correct here and must NOT be changed to a trigger-anchored origin — that rule is
for popovers and dropdowns.

```css
/* target — src/index.css, inside @layer components */
.scrim {
  opacity: 1;
  transition: opacity 200ms var(--ease-strong-out);

  @starting-style {
    opacity: 0;
  }
}
```

The dialog needs no new CSS: `.pop-in` (`src/index.css:201-212`) already is
`opacity 0 → 1` plus `scale(var(--enter-scale)) → scale(1)` over 260ms on the
right curve, and `--enter-scale` already collapses to `1` under reduced motion.

## Repo conventions to follow

- `.pop-in` exists for exactly this and is currently used once, at
  `src/components/TokenResultCard.tsx:24` — imitate that usage: the class is
  prepended to the existing className string, nothing else changes.
- New motion classes go in `@layer components` (`src/index.css:169-226`).
- Reduced motion is handled by the shared `--enter-*` tokens
  (`src/index.css:153-157`); do not add a media query for the dialog.

## Steps

1. Add the `.scrim` rule from **Target** to `src/index.css`, inside
   `@layer components`, directly after `.pop-in`.

2. `src/components/GettingStartedModal.tsx:108` — prepend `scrim ` to the
   backdrop's className:

   ```tsx
   className =
     "scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-5";
   ```

3. `src/components/GettingStartedModal.tsx:117` — prepend `pop-in ` to the
   dialog's className:

   ```tsx
   className =
     "pop-in w-full max-w-[520px] rounded-xl border border-border-strong bg-card p-6 shadow-2xl";
   ```

4. **Optional, only if steps 1-3 land cleanly and the suite stays green** — give
   the close an exit. In `src/App.tsx`, add a closing flag next to `helpOpen`
   (line 28):

   ```tsx
   const [helpClosing, setHelpClosing] = useState(false);

   const closeHelp = useCallback(() => {
     setHelpClosing(true);
     setTimeout(() => {
       setHelpOpen(false);
       setHelpClosing(false);
     }, 140);
   }, []);
   ```

   pass `isClosing={helpClosing}` and `onClose={closeHelp}` at line 103, accept
   `isClosing?: boolean` in `GettingStartedModal`, and put
   `data-closing={isClosing ? "true" : undefined}` on the backdrop. Then add:

   ```css
   .scrim[data-closing="true"] {
     opacity: 0;
     transition-duration: 140ms;
   }
   ```

   The exit is shorter than the entrance because the user has already decided.
   `src/components/GettingStartedModal.test.tsx` renders the component directly
   and is unaffected, but run the suite anyway.

## Boundaries

- Do NOT change the focus trap, the focus restore, the Escape handler or the
  backdrop click-to-close in `src/components/GettingStartedModal.tsx:70-104`.
  They are tested behaviour (RF-06.1) and this plan is motion only.
- Do NOT give the dialog a `transform-origin` other than the default centre.
- Do NOT animate `backdrop-filter` or add a blur — Safari pays for it and the
  scrim is already opaque enough.
- Do NOT convert the modal to `<dialog>` or add a library.
- If the markup no longer matches the excerpts, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev`, click "How to start" in the header:
  - the scrim fades in over ~200ms rather than snapping;
  - the dialog grows from slightly small (96%) to full size — it must never start
    from `scale(0)` or from a corner;
  - open and close it three times quickly: no flicker, no stuck scrim;
  - DevTools → Animations at 10%: the dialog decelerates into place;
  - DevTools → Rendering → reduced motion: the scrim still fades, the dialog does
    not scale.
- **Done when**: opening the modal is a fade plus a small scale, closing does not
  leave anything behind, the focus tests still pass, and the suite is green.
