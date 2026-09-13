import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Verify } from "./Verify";

const listPublicDraws = vi.fn();
vi.mock("../lib/supabase/draws", () => ({
  listPublicDraws: (...a: unknown[]) => listPublicDraws(...a),
}));

const REVEALED = {
  amountPerWinner: "1000000",
  blockhash: "4vJ9JU1bJJE96FbKmJqkrqTqmVu9LqvXK8T1FNmMkAnG",
  commit: "aa".repeat(32),
  commitSignature: "sig-commit",
  commitSlot: 1_000,
  createdAt: "2026-09-10T00:00:00Z",
  entriesRoot: "bb".repeat(32),
  entryHashes: ["00".repeat(32)],
  id: "draw-1",
  revealedSeed: "cc".repeat(32),
  status: "revealed" as const,
  targetSlot: 1_150,
  winners: ["00".repeat(32)],
  winnersCount: 1,
};

describe("Verify", () => {
  it("marca un sorteo manipulado como no verificado", async () => {
    // commit no es SHA256(revealedSeed), así que tiene que salir en rojo.
    listPublicDraws.mockResolvedValue([REVEALED]);
    render(<Verify slug="summer-jam" />);
    expect(await screen.findByText(/does not check out/i)).toBeInTheDocument();
  });

  it("lista los sorteos abandonados en lugar de esconderlos", async () => {
    // Re-tirar es visible o no es nada. Si el verificador ocultara los
    // abandonados, el creador podría repetir hasta que le gustara el resultado.
    listPublicDraws.mockResolvedValue([
      { ...REVEALED, id: "draw-0", status: "abandoned" },
      REVEALED,
    ]);
    render(<Verify slug="summer-jam" />);
    expect(await screen.findByText(/abandoned/i)).toBeInTheDocument();
  });

  it("explica que un sorteo aún sin revelar no se puede verificar todavía", async () => {
    listPublicDraws.mockResolvedValue([
      {
        ...REVEALED,
        blockhash: null,
        revealedSeed: null,
        status: "committed",
        winners: null,
      },
    ]);
    render(<Verify slug="summer-jam" />);
    expect(await screen.findByText(/not revealed yet/i)).toBeInTheDocument();
  });

  it("nunca muestra una dirección: solo compromisos", async () => {
    // La razón de ser del hash salado. Si aquí apareciera una wallet, el mapa
    // handle→wallet quedaría público.
    listPublicDraws.mockResolvedValue([REVEALED]);
    render(<Verify slug="summer-jam" />);
    await screen.findByText(/does not check out/i);
    expect(document.body.textContent).not.toMatch(/Tokenz|Tokenkeg|ATokenGP/);
  });

  it("no hay sorteos todavía", async () => {
    listPublicDraws.mockResolvedValue([]);
    render(<Verify slug="summer-jam" />);
    expect(await screen.findByText(/no draws yet/i)).toBeInTheDocument();
  });
});
