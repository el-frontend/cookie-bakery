import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "./EventForm";

const TOKEN = {
  decimals: 6,
  mint: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  symbol: "BAKE",
};

describe("EventForm", () => {
  it("propone un slug a partir del título", async () => {
    render(<EventForm onSubmit={vi.fn()} token={TOKEN} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Summer Jam");
    expect(screen.getByLabelText(/link/i)).toHaveValue("summer-jam");
  });

  it("deja sobrescribir el slug y no lo pisa al seguir escribiendo", async () => {
    render(<EventForm onSubmit={vi.fn()} token={TOKEN} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Summer");
    await userEvent.clear(screen.getByLabelText(/link/i));
    await userEvent.type(screen.getByLabelText(/link/i), "my-link");
    await userEvent.type(screen.getByLabelText(/title/i), " Jam");
    expect(screen.getByLabelText(/link/i)).toHaveValue("my-link");
  });

  it("no envía sin título", async () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} token={TOKEN} />);
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("no envía sin token elegido", async () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} token={null} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Summer Jam");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("envía título, slug y token", async () => {
    const onSubmit = vi.fn();
    render(<EventForm onSubmit={onSubmit} token={TOKEN} />);
    await userEvent.type(screen.getByLabelText(/title/i), "Summer Jam");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      mint: TOKEN.mint,
      mintDecimals: 6,
      mintSymbol: "BAKE",
      slug: "summer-jam",
      title: "Summer Jam",
    });
  });
});
