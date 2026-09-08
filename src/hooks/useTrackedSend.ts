import { useCallback, useRef, useState } from "react";
import { mapError } from "../lib/errors/mapError";
import type { MappedError } from "../lib/errors/types";
import { useToast } from "./useToast";

export type SendFn<TArgs extends unknown[]> = (
  ...args: TArgs
) => Promise<{ signature?: string } | string | void>;

export type TrackedSendState = {
  error: MappedError | null;
  isRunning: boolean;
  retried: boolean;
  signature: string | null;
};

function readSignature(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as {
      context?: { signature?: unknown };
      signature?: unknown;
    };
    const sig = r.signature ?? r.context?.signature;
    if (typeof sig === "string") return sig;
  }
  return null;
}

/**
 * Wraps a send with toast reporting and exactly one blockhash retry.
 *
 * The retry is not a safety net — it is the normal path. Measured on Cookie
 * Chain, a transaction signed by a human missed its window by ONE block
 * (currentBlockHeight 23578836 vs lastValidBlockHeight 23578835): the time
 * someone spends reading the wallet prompt outlives the blockhash. Without
 * this, a real user's first attempt routinely fails.
 *
 * Exactly one retry, and only for `blockhash-expired`. Retrying a rejected
 * signature would re-prompt someone who just said no; retrying insufficient
 * funds would fail identically. Retrying more than once risks an unbounded
 * loop against a chain that is simply too slow to confirm in time.
 */
export function useTrackedSend<TArgs extends unknown[]>(
  send: SendFn<TArgs>,
  labels: { pending: string; success: string } = {
    pending: "Sending transaction…",
    success: "Transaction confirmed",
  }
) {
  const toast = useToast();
  const [state, setState] = useState<TrackedSendState>({
    error: null,
    isRunning: false,
    retried: false,
    signature: null,
  });
  // Held in a ref so the callback identity stays stable across renders.
  const sendRef = useRef(send);
  sendRef.current = send;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  const dispatch = useCallback(
    async (...args: TArgs): Promise<TrackedSendState> => {
      const { pending, success } = labelsRef.current;
      setState({
        error: null,
        isRunning: true,
        retried: false,
        signature: null,
      });
      const toastId = toast.show({ title: pending, variant: "pending" });

      let retried = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await sendRef.current(...args);
          const signature = readSignature(result);
          const next: TrackedSendState = {
            error: null,
            isRunning: false,
            retried,
            signature,
          };
          setState(next);
          toast.update(toastId, {
            detail: retried ? "Succeeded after one retry." : undefined,
            signature: signature ?? undefined,
            title: success,
            variant: "success",
          });
          return next;
        } catch (raw) {
          const mapped = mapError(raw);
          const canRetry = mapped.kind === "blockhash-expired" && attempt === 0;
          if (canRetry) {
            retried = true;
            toast.update(toastId, {
              detail: mapped.detail,
              title: "Expired — retrying",
              variant: "pending",
            });
            continue;
          }
          const next: TrackedSendState = {
            error: mapped,
            isRunning: false,
            retried,
            signature: null,
          };
          setState(next);
          toast.update(toastId, {
            action: mapped.action,
            detail: mapped.detail,
            title: mapped.title,
            variant: "error",
          });
          return next;
        }
      }
      // Unreachable: the loop always returns. Present so the state can never
      // be left stuck on isRunning if that ever stops being true.
      const fallback: TrackedSendState = {
        error: mapError(new Error("Send did not complete")),
        isRunning: false,
        retried,
        signature: null,
      };
      setState(fallback);
      return fallback;
    },
    [toast]
  );

  return { ...state, dispatch };
}
