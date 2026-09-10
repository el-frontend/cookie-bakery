import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToast } from "../hooks/useToast";
import { AUTO_DISMISS_MS, type ToastInput } from "../lib/toast/types";
import { ToastProvider } from "./ToastProvider";

const SIGNATURE =
  "4BEoRsMQ9qdz4wXc4nEopQGv7dMFAceTBtRySZM8KTKWtbGMzuUxgRgmC4ieKDjfuAee4iNJqDvz12sqXXHXs9pD";

/** Fires toasts on demand so tests drive the provider through its real API. */
function Harness({ toasts }: { toasts: ToastInput[] }) {
  const { show } = useToast();
  return <button onClick={() => toasts.forEach((t) => show(t))}>fire</button>;
}

function renderWith(toasts: ToastInput[]) {
  return render(
    <ToastProvider>
      <Harness toasts={toasts} />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renderiza el link a CookieScan cuando hay firma", async () => {
    const user = userEvent.setup();
    renderWith([
      { signature: SIGNATURE, title: "Token created", variant: "success" },
    ]);
    await user.click(screen.getByRole("button", { name: "fire" }));

    const link = screen.getByRole("link", { name: /View/ });
    expect(link).toHaveAttribute(
      "href",
      `https://cookiescan.io/tx/${SIGNATURE}`
    );
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("no renderiza link si no hay firma", async () => {
    const user = userEvent.setup();
    renderWith([{ title: "Working", variant: "pending" }]);
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("apila varios toasts", async () => {
    const user = userEvent.setup();
    renderWith([
      { title: "First", variant: "pending" },
      { title: "Second", variant: "success" },
      { title: "Third", variant: "error" },
    ]);
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getAllByTestId("toast")).toHaveLength(3);
  });

  it("los toasts de error no se auto-cierran", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWith([
      { title: "Boom", variant: "error" },
      { title: "Fine", variant: "success" },
    ]);
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getAllByTestId("toast")).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS + 500);
    });

    // The success one cleared itself; the error is still there to be read.
    const remaining = screen.getAllByTestId("toast");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveAttribute("data-variant", "error");
  });

  it("se puede cerrar a mano", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWith([{ title: "Boom", variant: "error" }]);
    await user.click(screen.getByRole("button", { name: "fire" }));

    await user.click(screen.getByRole("button", { name: /Dismiss/ }));

    // Dismissed toasts stay mounted for the length of their exit transition —
    // a node removed on click cannot animate out.
    expect(screen.getByTestId("toast")).toHaveAttribute("data-leaving", "true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("los errores usan role=alert y el resto role=status", async () => {
    const user = userEvent.setup();
    renderWith([
      { title: "Boom", variant: "error" },
      { title: "Fine", variant: "pending" },
    ]);
    await user.click(screen.getByRole("button", { name: "fire" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    expect(screen.getByRole("status")).toHaveTextContent("Fine");
  });

  it("renderiza la acción cuando la hay", async () => {
    const user = userEvent.setup();
    renderWith([
      {
        action: {
          href: "https://hyperlane.cookiescan.io",
          label: "Bridge COOK",
        },
        title: "Not enough COOK",
        variant: "error",
      },
    ]);
    await user.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getByRole("link", { name: "Bridge COOK" })).toHaveAttribute(
      "href",
      "https://hyperlane.cookiescan.io"
    );
  });

  it("useToast fuera del provider falla con un mensaje claro", () => {
    const Bare = () => {
      useToast();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/inside <ToastProvider>/);
  });
});
