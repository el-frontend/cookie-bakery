import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("pasa un título normal a kebab-case", () => {
    expect(slugify("Summer Jam Giveaway")).toBe("summer-jam-giveaway");
  });

  it("quita acentos en lugar de perder la letra", () => {
    expect(slugify("Sorteo de Navidad ñoño")).toBe("sorteo-de-navidad-nono");
  });

  it("colapsa separadores repetidos", () => {
    expect(slugify("a -- b __ c")).toBe("a-b-c");
  });

  it("recorta a 63 caracteres sin dejar guion final", () => {
    const slug = slugify("x".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(63);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("produce algo válido incluso sin caracteres utilizables", () => {
    // El slug es la URL pública: no puede quedar vacío porque alguien
    // titulara su evento con emojis.
    expect(slugify("🎉🎉🎉")).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("sale siempre aceptado por el parser de rutas", () => {
    // Los dos alfabetos tienen que coincidir, o un evento se crearía con una
    // URL que la app pública rechaza.
    for (const title of ["Hello World", "ÁÉÍÓÚ", "a".repeat(200), "🎉"]) {
      expect(slugify(title)).toMatch(/^[a-z0-9][a-z0-9-]{0,62}$/);
    }
  });
});
