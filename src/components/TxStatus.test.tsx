import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TxStatus } from "./TxStatus";

const SIGNATURE = "4BEoRsMQ9qdz4wXc4nEopQGv7dMFAceTBtRySZM8KTKWtbGMzuUxg";

describe("TxStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("muestra el tiempo hasta confirmación", async () => {
    const { rerender } = render(<TxStatus phase="sent" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    const running = screen.getByTestId("tx-elapsed").textContent ?? "";
    expect(running).toMatch(/…$/); // still counting

    rerender(<TxStatus phase="confirmed" />);
    const frozen = screen.getByTestId("tx-elapsed").textContent ?? "";
    expect(frozen).not.toMatch(/…$/); // terminal: no ellipsis
    expect(frozen).toMatch(/^\d+(\.\d+)?s|^\d+m/);
  });

  it("refleja cada fase", () => {
    const { rerender } = render(<TxStatus phase="pending" />);
    expect(screen.getByTestId("tx-status")).toHaveTextContent(
      "Awaiting signature"
    );

    rerender(<TxStatus phase="sent" />);
    expect(screen.getByTestId("tx-status")).toHaveTextContent("confirming");

    rerender(<TxStatus phase="failed" />);
    expect(screen.getByTestId("tx-status")).toHaveTextContent("Failed");
    expect(screen.getByTestId("tx-status")).toHaveAttribute(
      "data-phase",
      "failed"
    );
  });

  it("enlaza la firma a CookieScan", () => {
    render(<TxStatus phase="confirmed" signature={SIGNATURE} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `https://cookiescan.io/tx/${SIGNATURE}`
    );
  });

  it("en idle no muestra cronómetro", () => {
    render(<TxStatus phase="idle" />);
    expect(screen.queryByTestId("tx-elapsed")).toBeNull();
  });
});
