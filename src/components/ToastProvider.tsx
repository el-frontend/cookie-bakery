import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AUTO_DISMISS_MS,
  ToastContext,
  type Toast as ToastModel,
  type ToastApi,
  type ToastInput,
} from "../lib/toast/types";
import { Toast } from "./Toast";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastModel[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
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
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </ul>
    </ToastContext.Provider>
  );
}
