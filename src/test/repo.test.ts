import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Repo hygiene the bounty actually grades (RF-07.1, RF-07.2 · AC-07.6,
 * AC-07.7).
 *
 * These read the real files rather than a fixture, because the thing being
 * checked IS the file: a LICENSE that drifts out of the repo, or a CSP that
 * quietly stops allowing the RPC, are exactly the regressions a unit test
 * over a copy would miss.
 */

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  description?: string;
  license?: string;
  repository?: { type?: string; url?: string };
};

describe("existe LICENSE MIT", () => {
  const license = readFileSync("LICENSE", "utf8");

  it("es la MIT completa, no un marcador", () => {
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    expect(license).toMatch(/Copyright \(c\) \d{4}/);
  });
});

describe("package.json declara license MIT y repository", () => {
  it("license es MIT", () => {
    expect(packageJson.license).toBe("MIT");
  });

  it("repository apunta al repo público", () => {
    expect(packageJson.repository?.url).toContain(
      "github.com/el-frontend/cookie-bakery"
    );
  });

  it("tiene una descripción que dice lo que hace", () => {
    // The scaffold's "React + Vite, Tailwind, @solana/react-hooks" described
    // the template, not this app, and framework-kit is no longer even used.
    expect(packageJson.description).toBeTruthy();
    expect(packageJson.description).not.toContain("react-hooks");
    expect(packageJson.description?.length).toBeGreaterThan(40);
  });
});

describe("vercel.json trae una CSP razonable", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    headers?: { headers: { key: string; value: string }[]; source: string }[];
    rewrites?: { destination: string; source: string }[];
  };

  const csp = vercel.headers
    ?.flatMap((entry) => entry.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;

  it("declara una Content-Security-Policy", () => {
    expect(csp).toBeTruthy();
  });

  it("no permite scripts de terceros", () => {
    // The one directive that must stay tight: nothing else may execute.
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("permite el RPC por https y por websocket", () => {
    expect(csp).toMatch(/connect-src[^;]*https:/);
    expect(csp).toMatch(/connect-src[^;]*wss:/);
  });

  it("permite las imágenes remotas de la metadata solo por https", () => {
    expect(csp).toMatch(/img-src[^;]*https:/);
    // `data:` is refused in code by safeImageUrl; the CSP agrees with it.
    expect(csp).not.toMatch(/img-src[^;]*data:/);
  });

  it("permite la hoja de estilos y las fuentes de Google que usa index.html", () => {
    const html = readFileSync("index.html", "utf8");
    if (html.includes("fonts.googleapis.com")) {
      expect(csp).toContain("https://fonts.googleapis.com");
    }
    if (html.includes("fonts.gstatic.com")) {
      expect(csp).toContain("https://fonts.gstatic.com");
    }
  });

  it("bloquea el embebido en un iframe", () => {
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("trae las cabeceras de endurecimiento y el rewrite de SPA", () => {
    const keys = vercel.headers?.flatMap((e) => e.headers.map((h) => h.key));
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(vercel.rewrites?.[0].destination).toBe("/index.html");
  });
});
