import { describe, expect, it } from "vitest";
import { truncateAddress } from "./address";

const ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

describe("truncateAddress", () => {
  it("trunca a 4…4", () => {
    expect(truncateAddress(ADDRESS)).toBe("7xKX…gAsU");
  });

  it("no trunca direcciones ya cortas", () => {
    expect(truncateAddress("abc")).toBe("abc");
    // Exactly at the boundary: truncating would not shorten it.
    expect(truncateAddress("123456789")).toBe("123456789");
  });

  it("respeta lead y tail personalizados", () => {
    expect(truncateAddress(ADDRESS, 6, 2)).toBe("7xKXtg…sU");
  });

  it("rechaza longitudes negativas", () => {
    expect(() => truncateAddress(ADDRESS, -1)).toThrow(RangeError);
  });

  it("conserva el final exacto de la dirección", () => {
    // The tail is what people actually compare against their wallet.
    expect(truncateAddress(ADDRESS).endsWith(ADDRESS.slice(-4))).toBe(true);
  });
});
