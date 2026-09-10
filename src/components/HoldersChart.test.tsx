import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoldersChart } from "./HoldersChart";
import type { DistributionSlice } from "../lib/token/distribution";

function slice(
  key: string,
  percent: number,
  isOthers = false
): DistributionSlice {
  return {
    amount: BigInt(Math.round(percent * 1_000_000)),
    isOthers,
    key,
    label: isOthers ? "Others" : key.slice(0, 4),
    percent,
  };
}

describe("HoldersChart", () => {
  it("no renderiza nada sin slices", () => {
    const { container } = render(
      <HoldersChart decimals={6} slices={[]} symbol="BAKE" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("nombra cuántos holders resume y si hay agregado", () => {
    render(
      <HoldersChart
        decimals={6}
        slices={[slice("aaaa", 60), slice("bbbb", 30), slice("x", 10, true)]}
        symbol="BAKE"
      />
    );

    expect(screen.getByTestId("holders-chart")).toHaveTextContent(
      "Top 2 holders and everyone else"
    );
  });

  it("omite 'everyone else' cuando no hay segmento otros", () => {
    render(
      <HoldersChart
        decimals={6}
        slices={[slice("aaaa", 70), slice("bbbb", 30)]}
        symbol="BAKE"
      />
    );

    const chart = screen.getByTestId("holders-chart");
    expect(chart).toHaveTextContent("Top 2 holders");
    expect(chart).not.toHaveTextContent("everyone else");
  });

  it("oculta el gráfico del árbol de accesibilidad porque la tabla es el alternativo", () => {
    // Reading eleven percentages twice — once as an aria-label, once as table
    // rows — is worse for a screen reader than reading them once.
    const { container } = render(
      <HoldersChart decimals={6} slices={[slice("aaaa", 100)]} symbol="BAKE" />
    );

    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
  });
});
