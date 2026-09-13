import { describe, expect, it, vi } from "vitest";
import {
  commitMemo,
  MEMO_MAX_BYTES,
  revealMemo,
  sendAttestation,
  type AttestationClient,
} from "./attest";

const DRAW = "11111111-2222-3333-4444-555555555555";

describe("commitMemo", () => {
  it("lleva versión, para poder cambiar el formato sin romper verificadores viejos", () => {
    expect(
      commitMemo({
        commit: "aa".repeat(32),
        drawId: DRAW,
        entriesRoot: "bb".repeat(32),
        targetSlot: 1_150n,
      })
    ).toMatch(/^cookie-bakery:draw-commit:v1:/);
  });

  it("incluye el slot objetivo, que es la mitad de la prueba temporal", () => {
    const memo = commitMemo({
      commit: "aa".repeat(32),
      drawId: DRAW,
      entriesRoot: "bb".repeat(32),
      targetSlot: 1_150n,
    });
    expect(memo).toContain("1150");
  });

  it("cabe en un memo", () => {
    const memo = commitMemo({
      commit: "aa".repeat(32),
      drawId: DRAW,
      entriesRoot: "bb".repeat(32),
      targetSlot: 999_999_999n,
    });
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(
      MEMO_MAX_BYTES
    );
  });
});

describe("revealMemo", () => {
  it("cabe en un memo con todos los campos al máximo", () => {
    const memo = revealMemo({
      blockhash: "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG",
      drawId: DRAW,
      seed: "cc".repeat(32),
      winnersRoot: "dd".repeat(32),
    });
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(
      MEMO_MAX_BYTES
    );
  });

  it("es distinguible del memo de commit", () => {
    expect(
      revealMemo({
        blockhash: "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG",
        drawId: DRAW,
        seed: "cc".repeat(32),
        winnersRoot: "dd".repeat(32),
      })
    ).toMatch(/draw-reveal/);
  });
});

/**
 * `sendAttestation` takes its client as a parameter rather than importing a
 * module singleton (contrast `commitDraw`/`revealDraw`, which reach a real
 * `supabase` singleton and are therefore left to the RLS suite per this
 * codebase's convention — see `runDraw.test.ts`). Dependency injection is
 * exactly what makes this half testable with a plain object instead of a
 * live chain.
 */
function fakeClient(overrides?: {
  sentSignature?: string;
  statusSlot?: bigint | null;
}): AttestationClient {
  const sentSignature = overrides?.sentSignature ?? "commit-sig";
  const statusSlot =
    overrides?.statusSlot === undefined ? 1_200n : overrides.statusSlot;

  return {
    rpc: {
      getSignatureStatuses: vi.fn(() => ({
        send: vi.fn(async () => ({
          context: { slot: 1_300n },
          value: [
            statusSlot === null
              ? null
              : {
                  confirmationStatus: "confirmed",
                  confirmations: null,
                  err: null,
                  slot: statusSlot,
                },
          ],
        })),
      })),
    },
    sendTransaction: vi.fn(async () => ({
      context: { signature: sentSignature },
      kind: "single",
      planType: "transactionPlanResult",
      plannedMessage: {},
      status: "successful",
    })),
  } as unknown as AttestationClient;
}

describe("sendAttestation", () => {
  it("envía el memo como instrucción, nunca como mensaje pre-construido", async () => {
    const client = fakeClient();
    await sendAttestation(client, "cookie-bakery:draw-commit:v1:x");
    expect(client.sendTransaction).toHaveBeenCalledTimes(1);
    const [instructions] = (client.sendTransaction as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [unknown[]];
    expect(Array.isArray(instructions)).toBe(true);
    expect(instructions).toHaveLength(1);
  });

  it("devuelve la firma y el slot en el que aterrizó la transacción", async () => {
    const client = fakeClient({ sentSignature: "sig-123", statusSlot: 1_234n });
    const result = await sendAttestation(client, "memo");
    expect(result).toEqual({ signature: "sig-123", slot: 1_234n });
  });

  it("pide el slot con la firma que acaba de recibir de sendTransaction", async () => {
    const client = fakeClient({ sentSignature: "sig-xyz" });
    await sendAttestation(client, "memo");
    expect(client.rpc.getSignatureStatuses).toHaveBeenCalledWith(["sig-xyz"]);
  });

  it("falla en vez de inventar un slot cuando la cadena no lo reporta", async () => {
    const client = fakeClient({ statusSlot: null });
    await expect(sendAttestation(client, "memo")).rejects.toThrow(
      /did not report the slot/i
    );
  });
});
