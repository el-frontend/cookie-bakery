# 003 — Retire the scaffold's hover-lift motion

- **Status**: DONE
- **Commit**: 5f1294b
- **Severity**: MEDIUM
- **Category**: 7 — Cohesion & tokens
- **Estimated scope**: 5 files, 7 class strings, no logic

## Problem

Five components still carry the original scaffold's motion: a bare `transition`
utility plus a hover lift and a shadow. Tailwind v4's bare `transition` resolves
to `150ms cubic-bezier(0.4, 0, 0.2, 1)` — a different duration and a different
curve from everything the redesign uses (`160ms var(--ease-strong-out)`), and
nothing else in the app levitates on hover.

The most visible offender is the wallet panel, which is the **first thing every
disconnected visitor sees** (`src/App.tsx:78` renders it above every screen
until a wallet connects).

```tsx
// src/components/WalletButton.tsx:65-71 — current
          <button
            onClick={() => disconnect()}
            disabled={isDisconnecting}
            className="inline-flex items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
```

```tsx
// src/components/WalletButton.tsx:79-93 — current
              <button
                onClick={() => connect(wallet)}
                disabled={isConnecting}
                className="group flex w-full items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                ...
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full bg-border-low transition group-hover:bg-primary/80"
                />
```

Same pattern at:

- `src/components/NetworkIndicator.tsx:55` — `className="rounded-lg border border-border-low bg-card px-2 py-1 text-xs font-medium cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"`
- `src/components/ProgramLogViewer.tsx:44` — identical string
- `src/components/ProgramLogViewer.tsx:51` — identical string
- `src/components/AddressChip.tsx:42` — `className="rounded-lg border border-border-low bg-card px-2 py-2 text-xs font-medium transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer"`
- `src/components/Toast.tsx:36` — `className="-mt-1 rounded px-1 text-muted transition hover:text-foreground cursor-pointer"`

## Target

Every one of them adopts the system's pressable signature: colour and border
move on hover, the element scales down on press, one duration, one curve.

```
transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong active:scale-[0.97]
```

For the dot at `WalletButton.tsx:92`, which only ever changes colour:

```
transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)]
```

For the toast's × at `Toast.tsx:36`, also colour only:

```
transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)]
```

## Repo conventions to follow

- The canonical pressable is `src/components/ui/Button.tsx:24-28`:

  ```ts
  const BASE =
    "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-lg " +
    "transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] " +
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  ```

  Copy that transition triple and the `active:scale-[0.97]`; do not invent a
  different duration.

- The comment at `src/components/ui/Button.tsx:11-18` states why: press feedback
  is what makes the interface feel like it heard you, and `--ease-strong-out` is
  used because a press is the moment the user watches most closely.
- Tailwind v4 already gates `hover:` behind `@media (hover: hover)`, so nothing
  extra is needed for touch.

## Steps

1. `src/components/WalletButton.tsx:68` — replace
   `transition hover:-translate-y-0.5 hover:shadow-sm` with
   `transition-[transform,background-color,border-color,color] duration-[160ms] [transition-timing-function:var(--ease-strong-out)] hover:border-border-strong active:scale-[0.97]`.
   Keep every other class in the string, including `cursor-pointer` and the
   `disabled:` classes.

2. `src/components/WalletButton.tsx:82` — same replacement, same rules.

3. `src/components/WalletButton.tsx:92` — replace the bare `transition` with
   `transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)]`.
   Keep `group-hover:bg-primary/80`.

4. `src/components/NetworkIndicator.tsx:55` — apply the step-1 replacement.

5. `src/components/ProgramLogViewer.tsx:44` and `:51` — apply the step-1
   replacement to both.

6. `src/components/AddressChip.tsx:42` — apply the step-1 replacement.

7. `src/components/Toast.tsx:36` — replace the bare `transition` with
   `transition-colors duration-[160ms] [transition-timing-function:var(--ease-strong-out)]`.
   Keep `hover:text-foreground` and `cursor-pointer`.

## Boundaries

- Motion properties only. Do NOT change padding, radius, colour tokens, text, or
  any `disabled:` / `cursor-*` class.
- Do NOT replace these elements with the `Button` component — they are chips and
  small controls with their own sizing; only the motion signature is shared.
- Do NOT add `hover:shadow-*` back anywhere, and do NOT add a hover translate to
  anything else in the app.
- Do NOT touch `src/components/ui/Button.tsx` — it is already correct and is the
  reference.
- If plan 001 has already run, `Toast.tsx:36` may have shifted by a few lines
  because of the new `isLeaving` prop; match on the class string, not the line
  number. If any other string does not match verbatim, STOP and report drift.

## Verification

- **Mechanical**: `npm run ci` green, `npm test` green.
  `grep -rn "hover:-translate-y-0.5" src` must return nothing.
- **Feel check**: `npm run dev` with no wallet connected, so the wallet panel is
  on screen:
  - hovering a wallet row changes its border, and the row does not rise;
  - pressing a wallet row scales it down slightly and releases back — the same
    feel as the "Review transaction" button on Bake;
  - the connection dot changes colour smoothly, in the same time as everything
    else;
  - nothing in the app moves vertically on hover any more.
- **Done when**: all seven strings use `160ms` + `var(--ease-strong-out)`, no
  `hover:-translate-y-0.5` or `hover:shadow-sm` remains under `src/`, and the
  suite is green.
