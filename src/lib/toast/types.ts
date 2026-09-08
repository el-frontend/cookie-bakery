import { createContext } from "react";

export type ToastVariant = "error" | "pending" | "success";

export type ToastInput = {
  /** Optional call to action, e.g. "Bridge COOK". */
  action?: { href: string; label: string };
  detail?: string;
  /** Transaction signature — renders a CookieScan link when present. */
  signature?: string;
  title: string;
  variant: ToastVariant;
};

export type Toast = ToastInput & { id: number };

export type ToastApi = {
  dismiss: (id: number) => void;
  show: (toast: ToastInput) => number;
  /** Replace an existing toast in place, e.g. pending → success. */
  update: (id: number, toast: Partial<ToastInput>) => void;
};

/**
 * Split from the provider component so the module exports no components,
 * keeping react-refresh happy and the context importable from hooks.
 */
export const ToastContext = createContext<ToastApi | null>(null);

/** Errors stay until dismissed; anything else clears itself. */
export const AUTO_DISMISS_MS = 6000;
