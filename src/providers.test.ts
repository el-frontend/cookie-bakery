import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { client } from "./providers";

describe("providers", () => {
  it("el cliente expone rpc, wallet y sendTransaction", () => {
    expect(client).toHaveProperty("rpc");
    expect(client).toHaveProperty("rpcSubscriptions");
    expect(client).toHaveProperty("wallet");
    expect(typeof client.sendTransaction).toBe("function");
  });

  it("envía por nuestro RPC: el cliente trae planner y executor propios", () => {
    // RT-03: la wallet solo firma. Si estas funciones faltasen, el envío
    // recaería en la wallet y saldría por SU rpc, no por el de Cookie Chain.
    expect(typeof client.planTransactions).toBe("function");
    expect(typeof client.sendTransactions).toBe("function");
  });

  it("no quedan imports de @solana/client ni @solana/react-hooks", () => {
    const root = join(__dirname, "..");
    const sources = ["src/providers.tsx", "src/App.tsx", "src/main.tsx"];
    for (const rel of sources) {
      const text = readFileSync(join(root, rel), "utf8");
      expect(text, `${rel} importa framework-kit`).not.toMatch(
        /@solana\/(client|react-hooks)/
      );
    }
  });

  it("package.json no declara framework-kit como dependencia", () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).not.toContain("@solana/client");
    expect(deps).not.toContain("@solana/react-hooks");
  });
});
