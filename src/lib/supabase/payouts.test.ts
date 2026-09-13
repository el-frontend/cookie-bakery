import { describe, expect, it } from "vitest";
import { payoutState, summarise } from "./payouts";

const PAID = { amount: "1000000", entryId: "e1", signature: "sig-1" };
const PENDING = { amount: "1000000", entryId: "e2", signature: null };

describe("payoutState", () => {
  it("solo una firma cuenta como pagado", () => {
    // Una fila en Postgres no es una transferencia. Si la app tratara la fila
    // como prueba de pago, un fallo de envío se mostraría como cobrado.
    expect(payoutState(PAID)).toBe("confirmed");
    expect(payoutState(PENDING)).toBe("unconfirmed");
  });
});

describe("summarise", () => {
  it("cuenta como pagado solo lo que tiene firma", () => {
    const summary = summarise([PAID, PENDING]);
    expect(summary.confirmed).toBe(1);
    expect(summary.unconfirmed).toBe(1);
    expect(summary.paidBaseUnits).toBe(1_000_000n);
  });

  it("una tabla vacía no afirma que no se pagó nada", () => {
    // Si Supabase se vacía, el historial se reconstruye desde la cadena, así
    // que la UI no puede presentar cero como un hecho.
    expect(summarise([]).knownIncomplete).toBe(true);
  });
});
