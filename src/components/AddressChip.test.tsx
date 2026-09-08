import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddressChip } from "./AddressChip";

const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

function withClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("AddressChip", () => {
  it("muestra la dirección truncada", () => {
    render(<AddressChip address={ADDRESS} />);
    expect(screen.getByTestId("address-text")).toHaveTextContent("7xKX…gAsU");
  });

  it("copia la address completa, no la truncada", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // setup() installs its own clipboard stub, so override it afterwards.
    const user = userEvent.setup();
    withClipboard(writeText);

    render(<AddressChip address={ADDRESS} />);
    await user.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(writeText).not.toHaveBeenCalledWith("7xKX…gAsU");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("no dice Copied si el portapapeles falla", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    // setup() installs its own clipboard stub, so override it afterwards.
    const user = userEvent.setup();
    withClipboard(writeText);

    render(<AddressChip address={ADDRESS} />);
    await user.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveTextContent("Copy");
  });

  it("expone la dirección completa a lectores de pantalla", () => {
    render(<AddressChip address={ADDRESS} />);
    expect(
      screen.getByRole("button", { name: `Copy address ${ADDRESS}` })
    ).toBeInTheDocument();
  });
});
