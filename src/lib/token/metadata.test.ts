import { describe, expect, it, vi } from "vitest";
import {
  fetchRemoteMetadata,
  isSafeMetadataUrl,
  MAX_METADATA_BYTES,
  plainText,
  safeImageUrl,
} from "./metadata";

const URI = "https://example.test/meta.json";

/** A response whose body is a real stream, so the capped reader is exercised. */
function streamResponse(text: string, headers: Record<string, string> = {}) {
  const bytes = new TextEncoder().encode(text);
  return {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        // Deliberately chunked: the reader must accumulate, not assume one read.
        const half = Math.ceil(bytes.length / 2);
        controller.enqueue(bytes.slice(0, half));
        controller.enqueue(bytes.slice(half));
        controller.close();
      },
    }),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    ok: true,
    status: 200,
    text: async () => text,
  } as unknown as Response;
}

function fetchReturning(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

describe("fetchRemoteMetadata", () => {
  it("rechaza uri http:// y data:", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    for (const bad of [
      "http://example.test/meta.json",
      "data:application/json,{}",
      "javascript:alert(1)",
      "blob:https://example.test/abc",
      "ftp://example.test/meta.json",
      "",
      "not a url",
    ]) {
      expect(await fetchRemoteMetadata(bad, { fetchImpl })).toBeNull();
    }

    // Refused before any request is made — no SSRF probe, no scheme upgrade.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("no envía cookies ni referrer al servidor de un desconocido", async () => {
    const fetchImpl = fetchReturning(
      streamResponse(JSON.stringify({ name: "Cookie" }))
    );

    await fetchRemoteMetadata(URI, { fetchImpl });

    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  it("trunca respuestas por encima del límite", async () => {
    const huge = JSON.stringify({ name: "x".repeat(MAX_METADATA_BYTES + 10) });
    const fetchImpl = fetchReturning(streamResponse(huge));

    expect(await fetchRemoteMetadata(URI, { fetchImpl })).toBeNull();
  });

  it("descarta el cuerpo antes de leerlo si content-length lo delata", async () => {
    const fetchImpl = fetchReturning(
      streamResponse("{}", { "content-length": String(MAX_METADATA_BYTES + 1) })
    );

    expect(await fetchRemoteMetadata(URI, { fetchImpl })).toBeNull();
  });

  it("acepta un documento justo por debajo del límite", async () => {
    const padding = "y".repeat(1_000);
    const fetchImpl = fetchReturning(
      streamResponse(JSON.stringify({ description: padding, name: "Cookie" }))
    );

    const metadata = await fetchRemoteMetadata(URI, { fetchImpl });

    expect(metadata?.name).toBe("Cookie");
  });

  it("devuelve markup como texto plano", async () => {
    const fetchImpl = fetchReturning(
      streamResponse(
        JSON.stringify({
          description: "<script>fetch('https://evil.test')</script>Nice token",
          image: "https://cdn.test/a.png",
          name: "<b>Bakery</b> Cookie<img src=x onerror=alert(1)>",
          symbol: "<i>BAKE</i>",
        })
      )
    );

    const metadata = await fetchRemoteMetadata(URI, { fetchImpl });

    expect(metadata?.name).toBe("Bakery Cookie");
    expect(metadata?.symbol).toBe("BAKE");
    expect(metadata?.description).toBe("fetch('https://evil.test')Nice token");
    // Nothing that could be interpreted as an element survives.
    expect(metadata?.name).not.toMatch(/[<>]/);
    expect(metadata?.description).not.toMatch(/<script/i);
  });

  it("tolera JSON inválido sin lanzar", async () => {
    for (const bad of ["{ not json", "", "[1,2,3]", "null", '"a string"']) {
      const fetchImpl = fetchReturning(streamResponse(bad));
      await expect(fetchRemoteMetadata(URI, { fetchImpl })).resolves.toBeNull();
    }
  });

  it("devuelve null ante un 404 en lugar de lanzar", async () => {
    const fetchImpl = vi.fn(async () => ({
      headers: { get: () => null },
      ok: false,
      status: 404,
    })) as unknown as typeof fetch;

    expect(await fetchRemoteMetadata(URI, { fetchImpl })).toBeNull();
  });

  it("devuelve null cuando la red falla", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    expect(await fetchRemoteMetadata(URI, { fetchImpl })).toBeNull();
  });

  it("devuelve null cuando se agota el timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    ) as unknown as typeof fetch;

    expect(
      await fetchRemoteMetadata(URI, { fetchImpl, timeoutMs: 5 })
    ).toBeNull();
  });

  it("rechaza una imagen que no sea https", async () => {
    const fetchImpl = fetchReturning(
      streamResponse(
        JSON.stringify({
          image: "data:image/svg+xml,<svg onload=alert(1)/>",
          name: "Cookie",
        })
      )
    );

    const metadata = await fetchRemoteMetadata(URI, { fetchImpl });

    expect(metadata?.name).toBe("Cookie");
    expect(metadata?.image).toBeNull();
  });

  it("ignora campos que no son cadenas en lugar de renderizarlos", async () => {
    const fetchImpl = fetchReturning(
      streamResponse(
        JSON.stringify({ image: 42, name: { toString: "nope" }, symbol: [1] })
      )
    );

    const metadata = await fetchRemoteMetadata(URI, { fetchImpl });

    expect(metadata).toEqual({
      description: null,
      image: null,
      name: null,
      symbol: null,
    });
  });
});

describe("plainText", () => {
  it("elimina controles bidi que hacen que un nombre mienta", () => {
    // U+202E flips rendering direction: "BAKE\u202Eelbatupersnu" reads as
    // "BAKEunreputable" backwards. React escaping does nothing here because
    // this is not markup — it is text that lies.
    expect(plainText("BAKE\u202Eelbatuper")).toBe("BAKEelbatuper");
    expect(plainText("a\u200Bb\u2066c\uFEFFd")).toBe("abcd");
  });

  it("elimina caracteres de control", () => {
    expect(plainText("Bakery\u0000\u0007 Cookie")).toBe("Bakery Cookie");
  });

  it("colapsa saltos de línea en una sola línea", () => {
    expect(plainText("Bakery\n\n\tCookie  Token")).toBe("Bakery Cookie Token");
  });

  it("trunca con puntos suspensivos", () => {
    const long = "a".repeat(200);
    const result = plainText(long, 10);
    expect(result).toHaveLength(10);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("devuelve null cuando no sobrevive nada", () => {
    expect(plainText("<b></b>")).toBeNull();
    expect(plainText("   ")).toBeNull();
    expect(plainText("\u200B")).toBeNull();
    expect(plainText(undefined)).toBeNull();
    expect(plainText(123)).toBeNull();
  });
});

describe("isSafeMetadataUrl / safeImageUrl", () => {
  it("solo acepta https", () => {
    expect(isSafeMetadataUrl("https://a.test/x.json")).toBe(true);
    expect(isSafeMetadataUrl("http://a.test/x.json")).toBe(false);
    expect(isSafeMetadataUrl("HTTPS://a.test/x.json")).toBe(true);
    expect(safeImageUrl("https://a.test/i.png")).toBe("https://a.test/i.png");
    expect(safeImageUrl("//a.test/i.png")).toBeNull();
  });
});
