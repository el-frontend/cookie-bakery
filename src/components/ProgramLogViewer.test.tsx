import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProgramLogViewer } from "./ProgramLogViewer";

// The real logs from the malformed System transfer we sent during the RT-03 probe.
const LOGS = [
  "Program 11111111111111111111111111111111 invoke [1]",
  "Program 11111111111111111111111111111111 failed: An account required by the instruction is missing",
];

describe("ProgramLogViewer", () => {
  it("oculta los logs hasta pulsar ver logs", async () => {
    const user = userEvent.setup();
    render(<ProgramLogViewer logs={LOGS} />);

    expect(screen.queryByTestId("program-logs")).toBeNull();
    await user.click(screen.getByRole("button", { name: "View logs" }));
    expect(screen.getByTestId("program-logs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide logs" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("renderiza markup de los logs como texto plano", async () => {
    const user = userEvent.setup();
    const hostile = [
      "Program log: <img src=x onerror=alert(1)>",
      "Program log: <script>alert('xss')</script>",
    ];
    render(<ProgramLogViewer logs={hostile} />);
    await user.click(screen.getByRole("button", { name: "View logs" }));

    const pre = screen.getByTestId("program-logs");
    // Rendered as text, not parsed into elements.
    expect(pre.querySelector("img")).toBeNull();
    expect(pre.querySelector("script")).toBeNull();
    expect(pre).toHaveTextContent("<script>alert('xss')</script>");
  });

  it("copia el log completo", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<ProgramLogViewer logs={LOGS} />);
    await user.click(screen.getByRole("button", { name: "View logs" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(LOGS.join("\n"));
  });

  it("muestra el resumen cuando lo hay", () => {
    render(<ProgramLogViewer logs={LOGS} summary="The program rejected it" />);
    expect(screen.getByTestId("log-summary")).toHaveTextContent(
      "The program rejected it"
    );
  });

  it("no renderiza nada sin logs", () => {
    const { container } = render(<ProgramLogViewer logs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
