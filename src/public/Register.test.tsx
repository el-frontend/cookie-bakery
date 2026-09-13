import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Register } from "./Register";

const getPublicEvent = vi.fn();
const registerEntry = vi.fn();

vi.mock("../lib/supabase/events", () => ({
  getPublicEvent: (...args: unknown[]) => getPublicEvent(...args),
  registerEntry: (...args: unknown[]) => registerEntry(...args),
}));

const OPEN_EVENT = {
  entryCount: 311,
  mint: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  mintDecimals: 6,
  mintSymbol: "BAKE",
  slug: "summer-jam",
  status: "open" as const,
  title: "Summer Jam giveaway",
};

const VALID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

beforeEach(() => {
  localStorage.clear();
  getPublicEvent.mockReset();
  registerEntry.mockReset();
});

describe("Register", () => {
  it("muestra el evento y el número de registrados", async () => {
    getPublicEvent.mockResolvedValue(OPEN_EVENT);
    render(<Register slug="summer-jam" />);
    expect(await screen.findByText(/Summer Jam giveaway/)).toBeInTheDocument();
    expect(screen.getByText(/311/)).toBeInTheDocument();
  });

  it("registra una dirección válida", async () => {
    getPublicEvent.mockResolvedValue(OPEN_EVENT);
    registerEntry.mockResolvedValue("ok");
    render(<Register slug="summer-jam" />);

    await userEvent.type(
      await screen.findByLabelText(/your cookie chain address/i),
      VALID
    );
    await userEvent.click(screen.getByRole("button", { name: /count me in/i }));

    await waitFor(() =>
      expect(screen.getByText(/you.re in/i)).toBeInTheDocument()
    );
  });

  it("rechaza una dirección inválida sin llamar al servidor", async () => {
    getPublicEvent.mockResolvedValue(OPEN_EVENT);
    render(<Register slug="summer-jam" />);

    await userEvent.type(
      await screen.findByLabelText(/your cookie chain address/i),
      "not-an-address"
    );
    await userEvent.click(screen.getByRole("button", { name: /count me in/i }));

    expect(await screen.findByText(/base58/i)).toBeInTheDocument();
    expect(registerEntry).not.toHaveBeenCalled();
  });

  it("explica la wallet repetida en lugar de mostrar un error crudo", async () => {
    // Sin política de SELECT para anon, el error de unicidad es la única señal
    // que tenemos — y resulta ser exactamente el mensaje que toca.
    getPublicEvent.mockResolvedValue(OPEN_EVENT);
    registerEntry.mockResolvedValue("already-registered");
    render(<Register slug="summer-jam" />);

    await userEvent.type(
      await screen.findByLabelText(/your cookie chain address/i),
      VALID
    );
    await userEvent.click(screen.getByRole("button", { name: /count me in/i }));

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });

  it("recuerda el registro tras recargar", async () => {
    getPublicEvent.mockResolvedValue(OPEN_EVENT);
    registerEntry.mockResolvedValue("ok");
    const { unmount } = render(<Register slug="summer-jam" />);
    await userEvent.type(
      await screen.findByLabelText(/your cookie chain address/i),
      VALID
    );
    await userEvent.click(screen.getByRole("button", { name: /count me in/i }));
    await waitFor(() => screen.getByText(/you.re in/i));
    unmount();

    render(<Register slug="summer-jam" />);
    expect(await screen.findByText(/you.re in/i)).toBeInTheDocument();
  });

  it("dice que el registro está cerrado en lugar de ofrecer el formulario", async () => {
    getPublicEvent.mockResolvedValue({ ...OPEN_EVENT, status: "closed" });
    render(<Register slug="summer-jam" />);
    expect(await screen.findByText(/closed/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /count me in/i })
    ).not.toBeInTheDocument();
  });

  it("maneja un evento que no existe", async () => {
    getPublicEvent.mockResolvedValue(null);
    render(<Register slug="nope" />);
    expect(await screen.findByText(/couldn.t find/i)).toBeInTheDocument();
  });

  it("escapa el título, que es texto de un tercero", async () => {
    // El título lo escribe un creador, así que es input no confiable como
    // cualquier metadata on-chain (PRD §0.9).
    getPublicEvent.mockResolvedValue({
      ...OPEN_EVENT,
      title: "<img src=x onerror=alert(1)>",
    });
    render(<Register slug="summer-jam" />);
    expect(
      await screen.findByText("<img src=x onerror=alert(1)>")
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
