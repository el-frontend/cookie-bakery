# 001 — Give toasts an entrance and an exit

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: HIGH
- **Category**: 4 — Interruptibility / 8 — Missed opportunities
- **Estimated scope**: 3 files (`src/index.css`, `src/components/Toast.tsx`, `src/components/ToastProvider.tsx`), ~40 lines

## Problem

Every transaction, every airdrop run and every mapped error in this app is
reported through one toast. Toasts appear instantly and, six seconds later
(`AUTO_DISMISS_MS = 6000` in `src/lib/toast/types.ts:31`), the node is removed
from the DOM with nothing in between. There is no entrance and no exit on the
most-seen surface in the product.

```tsx
// src/components/ToastProvider.tsx:71-77 — current
<ul
  aria-label="Notifications"
  className="pointer-events-none fixed bottom-4 right-4 z-50 flex list-none flex-col gap-3 p-0"
>
  {toasts.map((toast) => (
    <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
  ))}
</ul>
```

```tsx
// src/components/ToastProvider.tsx:16-23 — current: removal is immediate
const dismiss = useCallback((id: number) => {
  const timer = timers.current.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.current.delete(id);
  }
  setToasts((current) => current.filter((t) => t.id !== id));
}, []);
```

```tsx
// src/components/Toast.tsx:25-31 — current: the <li> IS the card, no motion classes
    <li
      role={toast.variant === "error" ? "alert" : "status"}
      data-testid="toast"
      data-variant={toast.variant}
      className={`pointer-events-auto w-full max-w-sm space-y-1 rounded-xl border ${VARIANT_STYLE[toast.variant]} bg-card p-4 text-sm shadow-[0_20px_60px_-40px_rgba(0,0,0,0.5)]`}
    >
```

## Target

Entry and exit are CSS **transitions**, never keyframes, so a second toast
arriving mid-animation retargets from the current state instead of restarting
from zero.

```css
/* target — src/index.css, inside @layer components */
.toast-item {
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

.toast-item[data-leaving="true"] {
  opacity: 0;
  transform: translateY(4px);
  transition-duration: 180ms;
}
```

Exit is shorter than entry (180ms vs 240ms) on purpose: the entrance has to be
noticed, the exit only has to not be abrupt.

## Repo conventions to follow

- Motion tokens live on `:root` in `src/index.css:16-55`; reusable motion
  classes live in `@layer components` (`src/index.css:169-226`). Add
  `.toast-item` there, after `.pop-in` (which ends at line 212).
- `--ease-strong-out: cubic-bezier(0.23, 1, 0.32, 1)` is the app's entrance
  curve. Never hand-type the cubic-bezier; always use the token.
- `--enter-shift` (`8px`, `src/index.css:53`) is the app's entrance distance and
  already collapses to `0px` under `prefers-reduced-motion`
  (`src/index.css:153-157`) — using it means this plan needs **no** extra
  reduced-motion handling.
- Exemplar to imitate: `.enter` at `src/index.css:176-187` — same structure,
  same curve, `@starting-style` instead of a mount flag in React.

## Steps

1. In `src/index.css`, inside `@layer components` and directly after the
   `.pop-in` rule, add the `.toast-item` and `.toast-item[data-leaving="true"]`
   rules exactly as written in **Target**, with a one-line comment above them in
   the file's voice, e.g.
   `/* Toasts. Transitions, not keyframes: a second toast must not restart the first. */`

2. In `src/components/Toast.tsx`, add an `isLeaving` prop and put the motion on
   the `<li>`:

   ```tsx
   export function Toast({
     isLeaving = false,
     onDismiss,
     toast,
   }: {
     isLeaving?: boolean;
     onDismiss: (id: number) => void;
     toast: ToastModel;
   }) {
   ```

   On the `<li>` (line 25) add `data-leaving={isLeaving ? "true" : undefined}`
   and prepend `toast-item ` to the className string. Keep every other class,
   the `role`, `data-testid` and `data-variant` exactly as they are.

3. In `src/components/ToastProvider.tsx`, add at module scope (above
   `export function ToastProvider`):

   ```tsx
   /** How long a dismissed toast stays mounted so it can fade out. */
   const LEAVE_MS = 180;
   ```

   and inside the component, next to the other state:

   ```tsx
   const [leaving, setLeaving] = useState<readonly number[]>([]);
   ```

4. Rewrite `dismiss` (currently lines 16-23) so it marks the toast as leaving,
   then removes it after `LEAVE_MS`:

   ```tsx
   const dismiss = useCallback((id: number) => {
     const timer = timers.current.get(id);
     if (timer) {
       clearTimeout(timer);
       timers.current.delete(id);
     }
     setLeaving((current) =>
       current.includes(id) ? current : [...current, id]
     );
     timers.current.set(
       id,
       setTimeout(() => {
         timers.current.delete(id);
         setToasts((current) => current.filter((t) => t.id !== id));
         setLeaving((current) => current.filter((entry) => entry !== id));
       }, LEAVE_MS)
     );
   }, []);
   ```

   The exit timer reuses the same `timers` map, so a second `dismiss` for the
   same id still clears it — do not add a second map.

5. Pass the flag through at line 75:

   ```tsx
   {
     toasts.map((toast) => (
       <Toast
         isLeaving={leaving.includes(toast.id)}
         key={toast.id}
         toast={toast}
         onDismiss={dismiss}
       />
     ));
   }
   ```

6. Run the tests. Any test asserting a toast is gone immediately after dismiss
   now needs to advance timers by `LEAVE_MS` — the suite already uses
   `vi.useFakeTimers()` for auto-dismiss, follow that pattern. Do NOT shorten
   `LEAVE_MS` to make a test pass and do NOT delete an assertion.

## Boundaries

- Do NOT restructure the stack into absolutely-positioned items (Sonner-style).
  The stack rarely holds more than one toast, because `update()` mutates a
  pending toast into a success toast in place (`ToastProvider.tsx:51-59`).
- Do NOT animate `height`, `margin` or `gap` to collapse the removed row. With
  two or more stacked toasts the survivors will still snap into place after the
  fade — that is accepted here.
- Do NOT touch the auto-dismiss duration, the variants, the `role`, or any colour.
- Do NOT add dependencies.
- If `dismiss` or the `<ul>` no longer look like the excerpts above, STOP and
  report drift instead of improvising.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
- **Feel check**: `npm run dev`, trigger a toast (any failed action produces one):
  - it rises ~8px while fading in, and never starts from `scale(0)`;
  - the × removes it with a shorter downward fade, not an instant cut;
  - fire two toasts within ~100ms: the first must NOT restart its entrance when
    the second arrives;
  - DevTools → Animations at 10% playback: the entrance decelerates (fast start,
    soft landing). If it accelerates into place, the curve token was not applied;
  - DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": the toast
    still fades but must not move vertically.
- **Done when**: `.toast-item` exists in `@layer components`, the `<li>` carries
  `toast-item` plus `data-leaving`, no toast leaves the DOM in under 180ms, and
  the suite is green.
