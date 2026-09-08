import { describe, expect, it } from "vitest";
import { makeExplorerLinks } from "./explorer";

const links = makeExplorerLinks({ explorerUrl: "https://cookiescan.io" });

describe("makeExplorerLinks", () => {
  it("construye la url de tx", () => {
    expect(links.txUrl("5eykt4Us")).toBe("https://cookiescan.io/tx/5eykt4Us");
  });

  it("construye la url de token y de address", () => {
    expect(links.tokenUrl("Mint111")).toBe(
      "https://cookiescan.io/token/Mint111"
    );
    expect(links.addressUrl("Owner111")).toBe(
      "https://cookiescan.io/address/Owner111"
    );
  });

  it("no duplica la barra si la base la trae", () => {
    const withSlash = makeExplorerLinks({
      explorerUrl: "https://cookiescan.io/",
    });
    expect(withSlash.txUrl("abc")).toBe("https://cookiescan.io/tx/abc");
  });
});
