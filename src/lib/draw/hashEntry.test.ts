import { describe, expect, it } from "vitest";
import { canonicalOrder, entriesRoot, hashEntry } from "./hashEntry";

const EVENT = "11111111-2222-3333-4444-555555555555";
const A = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const B = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("hashEntry", () => {
  it("devuelve 64 caracteres de hex minúscula", () => {
    expect(hashEntry(EVENT, A)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinista", () => {
    expect(hashEntry(EVENT, A)).toBe(hashEntry(EVENT, A));
  });

  it("sala con el event_id, así que la misma wallet cambia entre eventos", () => {
    // Sin esto se podrían cruzar dos listas publicadas para detectar que la
    // misma persona participó en ambos eventos.
    expect(hashEntry(EVENT, A)).not.toBe(hashEntry("otro-evento", A));
  });

  it("el byte separador evita la colisión por concatenación", () => {
    // Sin el 0x00, ("ab","c") y ("a","bc") producirían el mismo digest y dos
    // participantes distintos colisionarían en una sola entrada.
    expect(hashEntry("ab", "c")).not.toBe(hashEntry("a", "bc"));
  });
});

describe("canonicalOrder", () => {
  it("ordena ascendente y no muta la entrada", () => {
    const input = ["ff", "00", "a1"];
    expect(canonicalOrder(input)).toEqual(["00", "a1", "ff"]);
    expect(input).toEqual(["ff", "00", "a1"]);
  });

  it("el orden de inserción no cambia el resultado", () => {
    const one = canonicalOrder([hashEntry(EVENT, A), hashEntry(EVENT, B)]);
    const two = canonicalOrder([hashEntry(EVENT, B), hashEntry(EVENT, A)]);
    expect(one).toEqual(two);
  });
});

describe("entriesRoot", () => {
  it("cambia si la lista se reordena", () => {
    // Es lo que impide publicar una raíz y sortear sobre otra ordenación.
    const a = entriesRoot(["aa", "bb"]);
    const b = entriesRoot(["bb", "aa"]);
    expect(a).not.toBe(b);
  });

  it('no confunde ["ab","c"] con ["a","bc"]', () => {
    expect(entriesRoot(["ab", "c"])).not.toBe(entriesRoot(["a", "bc"]));
  });

  it("es el SHA-256 de los hashes unidos por \\n, sin salto final", () => {
    // Vector fijo: el verificador independiente tiene que dar esto mismo.
    expect(entriesRoot(["aa", "bb"])).toBe(
      "80c0d5c7137871baa75af2038f350bf60a4d45a131a653d0eb93f3cda3d28609"
    );
  });
});
