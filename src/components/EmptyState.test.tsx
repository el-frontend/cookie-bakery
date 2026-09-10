import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renderiza la acción primaria", () => {
    render(
      <EmptyState
        action={{ href: "/bake", label: "Bake a token" }}
        detail="Create a mint first."
        title="Nothing in the oven"
      />
    );

    expect(
      screen.getByRole("heading", { name: "Nothing in the oven" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bake a token" })).toHaveAttribute(
      "href",
      "/bake"
    );
  });

  it("dispara onClick cuando la acción es un botón", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        action={{ label: "Connect a wallet", onClick }}
        detail="Connect to continue."
        title="No wallet"
      />
    );

    await user.click(screen.getByRole("button", { name: "Connect a wallet" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("una acción externa abre en pestaña nueva con rel noreferrer", () => {
    render(
      <EmptyState
        action={{ href: "https://nightly.app", label: "Get Nightly" }}
        detail="Install a wallet."
        title="No wallet"
      />
    );

    const link = screen.getByRole("link", { name: "Get Nightly" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("una acción interna no abre pestaña nueva", () => {
    // Otherwise the back button stops working for in-app navigation.
    render(
      <EmptyState
        action={{ href: "#bake", label: "Go to Bake" }}
        detail="Create a mint."
        title="No token"
      />
    );

    expect(
      screen.getByRole("link", { name: "Go to Bake" })
    ).not.toHaveAttribute("target");
  });

  it("muestra la acción secundaria cuando se le pasa", () => {
    render(
      <EmptyState
        action={{ href: "/x", label: "Primary" }}
        detail="d"
        secondary={{
          href: "https://example.test/help",
          label: "Read the docs",
        }}
        title="t"
      />
    );

    expect(screen.getByRole("link", { name: "Read the docs" })).toHaveAttribute(
      "rel",
      "noreferrer"
    );
  });
});
