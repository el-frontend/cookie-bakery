import { describe, expect, it } from "vitest";
import { parsePublicRoute } from "./route";

describe("parsePublicRoute", () => {
  it("reconoce la página de registro", () => {
    expect(parsePublicRoute("/e/summer-jam")).toEqual({
      kind: "register",
      slug: "summer-jam",
    });
  });

  it("reconoce el verificador", () => {
    expect(parsePublicRoute("/e/summer-jam/verify")).toEqual({
      kind: "verify",
      slug: "summer-jam",
    });
  });

  it("tolera la barra final", () => {
    expect(parsePublicRoute("/e/summer-jam/")).toEqual({
      kind: "register",
      slug: "summer-jam",
    });
  });

  it("devuelve null para las rutas de la app del creador", () => {
    expect(parsePublicRoute("/")).toBeNull();
    expect(parsePublicRoute("/events")).toBeNull();
  });

  it("rechaza un slug vacío", () => {
    expect(parsePublicRoute("/e/")).toBeNull();
    expect(parsePublicRoute("/e")).toBeNull();
  });

  it("rechaza un slug con caracteres fuera del alfabeto permitido", () => {
    // El slug va a una consulta y a la UI. Restringirlo aquí evita tener que
    // confiar en que todo lo de abajo lo escape.
    expect(parsePublicRoute("/e/../../etc/passwd")).toBeNull();
    expect(parsePublicRoute("/e/<script>")).toBeNull();
  });

  it("ignora un subpath desconocido en lugar de adivinar", () => {
    expect(parsePublicRoute("/e/summer-jam/admin")).toBeNull();
  });
});
