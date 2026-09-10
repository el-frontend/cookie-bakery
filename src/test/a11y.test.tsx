import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createNoopSigner, getAddressDecoder, type Address } from "@solana/kit";
import { ToastProvider } from "../components/ToastProvider";

/**
 * Accessibility sweep over the built screens (RF-06.4).
 *
 * These are structural checks rather than a full audit: they catch the three
 * regressions that are easy to introduce and invisible in a screenshot — an
 * input with no programmatic label, a disabled control that never says why,
 * and a focus ring that has been styled away.
 *
 * The contrast half of AC-06.1 is not automatable here (jsdom does not
 * compute Tailwind), and is recorded against the palette in `index.css`
 * instead — see the ramp note at the top of that file.
 */

const decoder = getAddressDecoder();
function seeded(seed: number): Address {
  const bytes = new Uint8Array(32);
  bytes[0] = 11;
  bytes[1] = seed & 0xff;
  return decoder.decode(bytes);
}

const payerSigner = createNoopSigner(seeded(1));
const wallet = {
  payer: payerSigner as ReturnType<typeof createNoopSigner> | null,
};

vi.mock("@solana/react", () => ({
  usePayer: () => wallet.payer,
  usePlanTransaction: () => ({ dispatchAsync: vi.fn(async () => ({})) }),
  useSendTransaction: () => ({ dispatchAsync: vi.fn(async () => ({})) }),
  useClient: () => ({}),
}));

vi.mock("../hooks/useCookBalance", () => ({
  useCookBalance: () => ({ error: null, isLoading: false, lamports: 1n }),
}));

const { Bake } = await import("../app/Bake");
const { Airdrop } = await import("../app/Airdrop");

const rpc = {
  getAccountInfo: () => ({
    send: async () => ({ context: { slot: 1n }, value: null }),
  }),
  getMultipleAccounts: () => ({
    send: async () => ({ context: { slot: 1n }, value: [] }),
  }),
};

const client = {
  getMinimumBalance: vi.fn(async () => 2_039_280n),
  rpc,
  sendTransaction: vi.fn(),
} as never;

function wrap(children: ReactNode) {
  return render(<ToastProvider>{children}</ToastProvider>);
}

/** Every control a keyboard user can reach. */
function interactive(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]"
    ),
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  wallet.payer = payerSigner;
});

describe("todo input tiene label asociado", () => {
  it("en Bake", () => {
    const { container } = wrap(<Bake client={client} />);

    const fields = [
      ...container.querySelectorAll<HTMLElement>("input, select, textarea"),
    ];
    expect(fields.length).toBeGreaterThan(3);

    for (const field of fields) {
      // A name from any of: <label for>, wrapping <label>, aria-label,
      // aria-labelledby. Missing all four leaves a screen reader with "edit
      // text" and nothing else.
      expect(
        field,
        `${field.tagName}[${field.getAttribute("type") ?? "text"}] has no accessible name`
      ).toHaveAccessibleName();
    }
  });

  it("en Airdrop", () => {
    const { container } = wrap(<Airdrop client={client} onBake={vi.fn()} />);

    const fields = [
      ...container.querySelectorAll<HTMLElement>("input, select, textarea"),
    ];
    expect(fields.length).toBeGreaterThan(1);

    for (const field of fields) {
      expect(
        field,
        `${field.tagName}[${field.getAttribute("type") ?? "text"}] has no accessible name`
      ).toHaveAccessibleName();
    }
  });
});

describe("los botones deshabilitados exponen el motivo", () => {
  it("Bake dice que hace falta una wallet", () => {
    wallet.payer = null;
    wrap(<Bake client={client} />);

    const review = screen.getByTestId("bake-review");
    expect(review).toBeDisabled();
    expect(review).toHaveAccessibleDescription(
      "Connect a wallet to create a token."
    );
  });

  it("Airdrop nombra la condición que falta", () => {
    wallet.payer = null;
    wrap(<Airdrop client={client} onBake={vi.fn()} />);

    // No wallet is the first blocker, so that is the reason given.
    const prepare = screen.queryByTestId("airdrop-prepare");
    if (prepare) {
      expect(prepare).toBeDisabled();
      expect(prepare).toHaveAccessibleDescription("Connect a wallet first.");
    }
  });

  it("ningún botón deshabilitado queda sin explicación", () => {
    wallet.payer = null;
    const bake = wrap(<Bake client={client} />);

    for (const element of interactive(bake.container)) {
      if (element.tagName !== "BUTTON") continue;
      if (!(element as HTMLButtonElement).disabled) continue;
      // Either an aria-describedby reason or a title; silence is the failure.
      const explained =
        element.getAttribute("aria-describedby") !== null ||
        element.getAttribute("title") !== null;
      expect(
        explained,
        `disabled button "${element.textContent}" gives no reason`
      ).toBe(true);
    }
  });
});

describe("ningún elemento interactivo pierde el indicador de foco", () => {
  const css = readFileSync("src/index.css", "utf8");

  it("index.css devuelve el anillo de foco que el reset transparenta", () => {
    // `* { outline-transparent }` erases the browser default, so the app has
    // to put a focus ring back explicitly or nothing shows one.
    expect(css).toContain("outline-transparent");
    expect(css).toMatch(/:focus-visible\s*\{/);
    expect(css).toMatch(/outline:\s*2px solid var\(--accent\)/);
  });

  it("la regla global es de especificidad cero para poder sobrescribirse", () => {
    // `:where()` means the inputs' accent-border treatment still wins.
    expect(css).toMatch(/:where\([^)]*button[^)]*\):focus-visible/);
  });

  it("cada control que anula el outline ofrece otro indicador", () => {
    const { container } = wrap(<Airdrop client={client} onBake={vi.fn()} />);

    for (const element of interactive(container)) {
      const classes = element.className || "";
      if (!/(^|\s)outline-none(\s|$)/.test(classes)) continue;

      // Killing the outline is allowed only with a replacement: the inputs
      // swap it for an accent border plus a ring shadow.
      const replacement =
        /focus:border-/.test(classes) ||
        /focus:shadow-/.test(classes) ||
        /focus-visible:/.test(classes);
      expect(
        replacement,
        `"${element.tagName}" clears its outline with no focus replacement`
      ).toBe(true);
    }
  });
});
