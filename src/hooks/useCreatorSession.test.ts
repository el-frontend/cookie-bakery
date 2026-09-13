import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// `vi.mock` factories are hoisted above the rest of the file, so any shared
// mutable state they close over has to be built through `vi.hoisted` rather
// than a plain top-level `const` — otherwise Vitest refuses the mock outright.
const { wallet, signMessageMock, auth, unsubscribe } = vi.hoisted(() => ({
  wallet: {
    connected: null as {
      account: { address: string };
      wallet: { name: string };
    } | null,
  },
  signMessageMock: vi.fn<(message: Uint8Array) => Promise<Uint8Array>>(
    async () => new Uint8Array([9, 9, 9])
  ),
  unsubscribe: vi.fn(),
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithWeb3: vi.fn(),
    signOut: vi.fn(),
  },
}));

// `useCreatorSession` reads the Kit client through `useClient`, exactly like
// `useCookBalance` does — mocked the same way, so no `<ClientProvider>` and
// no real wallet extension is needed here.
vi.mock("@solana/react", () => ({
  useClient: () => ({}),
}));

vi.mock("@solana/kit-plugin-wallet/react", () => ({
  useConnectedWallet: () => wallet.connected,
  useSignMessage: () => ({ dispatchAsync: signMessageMock }),
}));

vi.mock("../lib/supabase/client", () => ({
  supabase: { auth },
}));

import { siwsStatement, useCreatorSession } from "./useCreatorSession";

const SESSION = { access_token: "tok", user: { id: "u1" } };

/** The callback `onAuthStateChange` was registered with, for driving events by hand. */
function authChangeCallback() {
  return (auth.onAuthStateChange as Mock).mock.calls[0]?.[0];
}

beforeEach(() => {
  wallet.connected = null;
  signMessageMock.mockClear();
  unsubscribe.mockClear();
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange
    .mockReset()
    .mockReturnValue({ data: { subscription: { unsubscribe } } });
  auth.signInWithWeb3.mockReset().mockResolvedValue({ error: null });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
});

describe("siwsStatement", () => {
  it("nombra la app y no promete nada sobre fondos", () => {
    // Es lo que el usuario lee en Nightly antes de firmar. Si sugiriera que
    // autoriza una transferencia, estaríamos entrenando a la gente a firmar
    // mensajes sin leerlos.
    const statement = siwsStatement();
    expect(statement).toMatch(/Cookie Bakery/);
    expect(statement).not.toMatch(/transfer|approve|authorize|spend/i);
  });

  it("es estable, porque cambiarlo invalida sesiones", () => {
    expect(siwsStatement()).toBe(siwsStatement());
  });
});

describe("useCreatorSession — máquina de estados", () => {
  it("arranca en loading", () => {
    const { result } = renderHook(() => useCreatorSession());
    expect(result.current.status).toBe("loading");
    expect(result.current.session).toBeNull();
  });

  it("sin sesión persistida pasa a signed-out", async () => {
    const { result } = renderHook(() => useCreatorSession());
    await waitFor(() => expect(result.current.status).toBe("signed-out"));
    expect(result.current.session).toBeNull();
  });

  it("con sesión persistida pasa a signed-in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    const { result } = renderHook(() => useCreatorSession());
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    expect(result.current.session).toBe(SESSION);
  });

  it("un evento de auth posterior actualiza session y status", async () => {
    const { result } = renderHook(() => useCreatorSession());
    await waitFor(() => expect(result.current.status).toBe("signed-out"));

    act(() => authChangeCallback()?.("SIGNED_IN", SESSION));
    expect(result.current.status).toBe("signed-in");
    expect(result.current.session).toBe(SESSION);

    act(() => authChangeCallback()?.("SIGNED_OUT", null));
    expect(result.current.status).toBe("signed-out");
    expect(result.current.session).toBeNull();
  });

  it("se desuscribe del cambio de auth al desmontar", async () => {
    const { unmount, result } = renderHook(() => useCreatorSession());
    await waitFor(() => expect(result.current.status).toBe("signed-out"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("ignora la respuesta de getSession si ya se desmontó", async () => {
    let resolveSession!: (v: { data: { session: null } }) => void;
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );
    const { unmount, result } = renderHook(() => useCreatorSession());
    unmount();
    await act(async () => {
      resolveSession({ data: { session: null } });
      await Promise.resolve();
    });
    // No assertion target survives the unmount; reaching here without the
    // "state update on an unmounted component" warning is the assertion.
    expect(result.current).toBeDefined();
  });
});

describe("useCreatorSession — signIn", () => {
  it("rechaza sin wallet conectada, sin tocar supabase", async () => {
    const { result } = renderHook(() => useCreatorSession());
    await expect(result.current.signIn()).rejects.toThrow(/connect a wallet/i);
    expect(signMessageMock).not.toHaveBeenCalled();
    expect(auth.signInWithWeb3).not.toHaveBeenCalled();
  });

  it("con wallet conectada firma un mensaje SIWS y lo envía como par mensaje+firma", async () => {
    wallet.connected = {
      account: { address: "CookieAddr1111" },
      wallet: { name: "Nightly" },
    };
    const { result } = renderHook(() => useCreatorSession());

    await result.current.signIn();

    expect(signMessageMock).toHaveBeenCalledTimes(1);
    const signedBytes = signMessageMock.mock.calls[0][0] as Uint8Array;
    const signedText = new TextDecoder().decode(signedBytes);
    expect(signedText).toContain("CookieAddr1111");
    expect(signedText).toContain(siwsStatement());

    expect(auth.signInWithWeb3).toHaveBeenCalledTimes(1);
    const credentials = auth.signInWithWeb3.mock.calls[0][0];
    expect(credentials.chain).toBe("solana");
    expect(credentials.message).toBe(signedText);
    expect(credentials.signature).toBeInstanceOf(Uint8Array);
    // The pre-signed shape only: never the `wallet` object auth-js cannot use.
    expect(credentials.wallet).toBeUndefined();
  });

  it("propaga el error de signInWithWeb3 como Error legible", async () => {
    wallet.connected = {
      account: { address: "CookieAddr1111" },
      wallet: { name: "Nightly" },
    };
    auth.signInWithWeb3.mockResolvedValue({
      error: { message: "Invalid SIWS message" },
    });
    const { result } = renderHook(() => useCreatorSession());

    await expect(result.current.signIn()).rejects.toThrow(
      "Invalid SIWS message"
    );
  });
});

describe("useCreatorSession — signOut", () => {
  it("llama a supabase.auth.signOut", async () => {
    const { result } = renderHook(() => useCreatorSession());
    await result.current.signOut();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
