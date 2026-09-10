import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GettingStartedModal } from "./GettingStartedModal";
import { chainConfig } from "../lib/chain/config";

const writeText = vi.fn(async () => {});

/** `navigator.clipboard` is getter-only in jsdom, so it has to be redefined. */
function withClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Renders the modal behind a trigger, so focus restoration is observable. */
function renderWithTrigger(onClose = vi.fn()) {
  const result = render(
    <>
      <button data-testid="trigger">Open</button>
      <GettingStartedModal onClose={onClose} />
    </>
  );
  return { ...result, onClose };
}

describe("GettingStartedModal", () => {
  it("lista los cuatro pasos en orden", () => {
    render(<GettingStartedModal onClose={vi.fn()} />);

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);

    expect(headings).toEqual([
      "Install Nightly",
      "Add Cookie Chain",
      "Get some COOK",
      "Come back and bake",
    ]);
  });

  it("es un dialog modal con nombre accesible", () => {
    render(<GettingStartedModal onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("How to start");
  });

  it("Escape lo cierra y devuelve el foco", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = renderWithTrigger(onClose);

    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Re-render puts focus inside the dialog; Escape must ask to close.
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();

    // Unmounting is what a real close does, and the opener gets focus back.
    unmount();
  });

  it("devuelve el foco al disparador al desmontarse", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<GettingStartedModal onClose={vi.fn()} />);
    // Focus moved into the dialog.
    await waitFor(() => expect(trigger).not.toHaveFocus());

    unmount();
    await waitFor(() => expect(trigger).toHaveFocus());

    trigger.remove();
  });

  it("copia la url del RPC desde la config", async () => {
    // setup() installs its own clipboard stub, so override it afterwards.
    const user = userEvent.setup();
    withClipboard();
    render(<GettingStartedModal onClose={vi.fn()} />);

    // Shown, not just copied — a deploy on another endpoint must say so.
    expect(screen.getByRole("dialog")).toHaveTextContent(chainConfig.rpcUrl);

    await user.click(screen.getByTestId("copy-rpc"));

    expect(writeText).toHaveBeenCalledWith(chainConfig.rpcUrl);
    await waitFor(() =>
      expect(screen.getByTestId("copy-rpc")).toHaveTextContent("Copied")
    );
  });

  it("el foco no escapa del modal con Tab", async () => {
    const user = userEvent.setup();
    render(<GettingStartedModal onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>("a[href], button"),
    ];
    expect(focusable.length).toBeGreaterThan(3);

    // From the last control, Tab wraps to the first rather than leaving.
    focusable[focusable.length - 1].focus();
    await user.tab();
    expect(focusable[0]).toHaveFocus();

    // And Shift+Tab from the first wraps to the last.
    await user.tab({ shift: true });
    expect(focusable[focusable.length - 1]).toHaveFocus();
  });

  it("el botón de cerrar y 'Got it' piden cerrar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GettingStartedModal onClose={onClose} />);

    await user.click(screen.getByTestId("getting-started-close"));
    await user.click(screen.getByTestId("getting-started-done"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("un clic en el fondo lo cierra, uno dentro no", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GettingStartedModal onClose={onClose} />);

    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("getting-started-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("enlaza al bridge y a Nightly en pestaña nueva", () => {
    render(<GettingStartedModal onClose={vi.fn()} />);

    const bridge = screen.getByRole("link", { name: "Open the bridge" });
    expect(bridge).toHaveAttribute("href", chainConfig.bridgeUrl);
    expect(bridge).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByRole("link", { name: "Get Nightly" })).toHaveAttribute(
      "target",
      "_blank"
    );
  });
});
