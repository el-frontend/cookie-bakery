import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The launch thread draft (RF-07.5, AC-07.5).
 *
 * The 280-character check is the point of automating this: a tweet that is
 * four characters too long is invisible in a markdown file and only fails at
 * the moment someone tries to post it.
 */

const source = readFileSync("docs/x-thread.md", "utf8");

/**
 * Tweets are the `## n / total` sections, excluding the notes.
 *
 * Split line by line rather than with one regex: a lazy `[\s\S]*?` closed by
 * `$` under the `m` flag stops at the first line break, which silently yields
 * zero tweets.
 */
function tweets(): string[] {
  const found: string[] = [];
  let current: string[] | null = null;

  for (const line of source.split("\n")) {
    if (/^## \d+ \/ \d+\s*$/.test(line)) {
      if (current) found.push(current.join("\n").trim());
      current = [];
      continue;
    }
    // A `---` rule or any other heading ends the tweet body.
    if (current && (line.trim() === "---" || /^##? /.test(line))) {
      found.push(current.join("\n").trim());
      current = null;
      continue;
    }
    current?.push(line);
  }
  if (current) found.push(current.join("\n").trim());

  return found.filter(Boolean);
}

describe("tiene entre 5 y 7 tweets", () => {
  it("cuenta los tweets numerados", () => {
    const count = tweets().length;
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(7);
  });

  it("los numera consecutivamente desde 1", () => {
    const numbers = [...source.matchAll(/^## (\d+) \/ (\d+)$/gm)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);

    expect(numbers.map(([n]) => n)).toEqual(
      numbers.map((_, index) => index + 1)
    );
    // Every "n / total" agrees on the total, and it matches reality.
    for (const [, total] of numbers) {
      expect(total).toBe(numbers.length);
    }
  });
});

describe("incluye el enlace al bridge", () => {
  it("enlaza al bridge de Cookie Chain", () => {
    expect(source).toContain("https://hyperlane.cookiescan.io");
  });

  it("enlaza al repo", () => {
    expect(source).toContain("github.com/el-frontend/cookie-bakery");
  });
});

describe("ningún tweet supera 280 caracteres", () => {
  it.each(tweets().map((text, index) => [index + 1, text]))(
    "tweet %i cabe en 280",
    (_number, text) => {
      // Counted the way X counts: a URL costs 23 characters whatever its
      // length, so measuring the raw string would reject valid tweets.
      const measured = String(text).replace(/https?:\/\/\S+/g, "x".repeat(23));
      expect(measured.length).toBeLessThanOrEqual(280);
    }
  );
});

describe("los placeholders están marcados", () => {
  it("no finge tener una URL pública ni un mint", () => {
    // A real-looking but invented URL or mint address in the submission draft
    // would be worse than an obvious placeholder.
    expect(source).toContain("{{APP_URL}}");
    expect(source).toMatch(/\{\{BAKE_MINT\}\}/);
    expect(source).toMatch(/[Bb]efore posting/);
  });
});
