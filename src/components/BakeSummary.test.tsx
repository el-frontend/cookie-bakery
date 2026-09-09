import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Lamports } from "@solana/kit";
import { BakeSummary, type BakeSummaryProps } from "./BakeSummary";
import type { MappedError } from "../lib/errors/types";
import type { BakeCost } from "../lib/token/sizing";

const MINT = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

const COST: BakeCost = {
  ataRent: 2_039_280n,
  ataSpace: 165,
  fee: 10_000n,
  mintRent: 3_222_000n,
  space: { allocated: 250, rentBearing: 335 },
  total: 5_271_280n,
};

function props(overrides: Partial<BakeSummaryProps> = {}): BakeSummaryProps {
  return {
    balance: 100_000_000n as Lamports,
    cost: COST,
    decimals: 6,
    isPlanning: false,
    isSending: false,
    mint: MINT,
    onSubmit: vi.fn(),
    simulationError: null,
    supply: "1000000",
    symbol: "BAKE",
    ...overrides,
  };
}

describe("BakeSummary", () => {
  it("muestra el desglose de coste", () => {
    render(<BakeSummary {...props()} />);

    expect(screen.getByTestId("cost-breakdown")).toBeInTheDocument();
    // 5,271,280 lamports = 0.00527128 COOK
    expect(screen.getByTestId("cost-total")).toHaveTextContent("0.00527128");
    expect(screen.getByTestId("cost-total")).toHaveTextContent("COOK");
    expect(screen.getByTestId("cost-balance")).toHaveTextContent("0.1");
    // The rent-bearing size is what the user pays for, so that is what shows.
    expect(screen.getByText(/335 bytes/)).toBeInTheDocument();
    expect(screen.getByText(/165 bytes/)).toBeInTheDocument();
  });

  it("muestra la mint address prevista, el supply y los decimales", () => {
    render(<BakeSummary {...props()} />);

    expect(screen.getByTestId("summary-mint")).toHaveTextContent("9xQe");
    expect(screen.getByTestId("summary-supply")).toHaveTextContent(
      "1000000 BAKE"
    );
  });

  it("bloquea el envío con saldo insuficiente", async () => {
    const onSubmit = vi.fn();
    render(
      <BakeSummary
        {...props({ balance: (COST.total - 1n) as Lamports, onSubmit })}
      />
    );

    const submit = screen.getByTestId("bake-submit");
    expect(submit).toBeDisabled();
    expect(screen.getByTestId("insufficient-balance")).toBeInTheDocument();

    await userEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("permite el envío con el saldo exacto", () => {
    render(<BakeSummary {...props({ balance: COST.total as Lamports })} />);

    expect(screen.getByTestId("bake-submit")).toBeEnabled();
    expect(
      screen.queryByTestId("insufficient-balance")
    ).not.toBeInTheDocument();
  });

  it("no marca saldo insuficiente mientras el balance carga", () => {
    render(<BakeSummary {...props({ balance: null })} />);

    expect(
      screen.queryByTestId("insufficient-balance")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("bake-submit")).toBeEnabled();
  });

  it("muestra el error de simulación sin firmar", async () => {
    const onSubmit = vi.fn();
    const simulationError: MappedError = {
      detail: "Program log: Error: insufficient funds for rent",
      kind: "program-error",
      logs: ["Program Token2022 invoke [1]", "Program Token2022 failed"],
      retryable: false,
      title: "The program rejected the transaction",
    };

    render(<BakeSummary {...props({ onSubmit, simulationError })} />);

    const error = screen.getByTestId("simulation-error");
    expect(error).toHaveTextContent("The program rejected the transaction");
    expect(error).toHaveTextContent("insufficient funds for rent");

    const submit = screen.getByTestId("bake-submit");
    expect(submit).toBeDisabled();
    await userEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bloquea mientras simula o firma", () => {
    const { rerender } = render(
      <BakeSummary {...props({ isPlanning: true })} />
    );
    expect(screen.getByTestId("bake-submit")).toBeDisabled();
    expect(screen.getByTestId("bake-submit")).toHaveTextContent("Simulating");

    rerender(<BakeSummary {...props({ isSending: true })} />);
    expect(screen.getByTestId("bake-submit")).toBeDisabled();
    expect(screen.getByTestId("bake-submit")).toHaveTextContent(
      "Waiting for signature"
    );
  });

  it("bloquea hasta que hay un coste estimado", () => {
    render(<BakeSummary {...props({ cost: null })} />);

    expect(screen.getByTestId("bake-submit")).toBeDisabled();
    expect(screen.queryByTestId("cost-breakdown")).not.toBeInTheDocument();
  });

  it("dispara onSubmit cuando todo está en orden", async () => {
    const onSubmit = vi.fn();
    render(<BakeSummary {...props({ onSubmit })} />);

    await userEvent.click(screen.getByTestId("bake-submit"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
