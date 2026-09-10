import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AUTO_DISMISS_MS,
  ToastContext,
  type Toast as ToastModel,
  type ToastApi,
  type ToastInput,
} from "../lib/toast/types";
import { Toast } from "./Toast";

/**
 * How long a dismissed toast stays mounted so it can play its exit. Must match
 * the `[data-leaving]` transition duration in `index.css`.
 */
const LEAVE_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastModel[]>([]);
  const [leaving, setLeaving] = useState<readonly number[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    // Marked first, removed later: a toast that vanished from the DOM cannot
    // animate. The exit timer reuses the same map, so a second dismiss for the
    // same id still cancels it.
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

  const scheduleDismiss = useCallback(
    (id: number, variant: ToastModel["variant"]) => {
      const existing = timers.current.get(id);
      if (existing) {
        clearTimeout(existing);
        timers.current.delete(id);
      }
      // Errors persist: the user needs time to read what went wrong, and
      // often to act on a link inside the toast.
      if (variant === "error") return;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      );
    },
    [dismiss]
  );

  const show = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...input, id }]);
      scheduleDismiss(id, input.variant);
      return id;
    },
    [scheduleDismiss]
  );

  const update = useCallback(
    (id: number, patch: Partial<ToastInput>) => {
      setToasts((current) =>
        current.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      if (patch.variant) scheduleDismiss(id, patch.variant);
    },
    [scheduleDismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({ dismiss, show, update }),
    [dismiss, show, update]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ul
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex list-none flex-col gap-3 p-0"
      >
        {toasts.map((toast) => (
          <Toast
            isLeaving={leaving.includes(toast.id)}
            key={toast.id}
            toast={toast}
            onDismiss={dismiss}
          />
        ))}
      </ul>
    </ToastContext.Provider>
  );
}
