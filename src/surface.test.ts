import { describe, expect, it } from "vitest";
import { APP_BASENAME, parseSurface } from "./surface";

/**
 * The three-way split at the root.
 *
 * Worth its own suite because nothing else catches a mistake here: both
 * deploys rewrite every path to `index.html`, so a wrong answer does not 404
 * — it silently renders the wrong half of the app. The case that matters most
 * is the last one: an unrecognised path has to land on the landing, not on a
 * creator shell with no idea what it is showing.
 */

describe("parseSurface", () => {
  it("sends the root to the landing", () => {
    expect(parseSurface("/")).toEqual({ kind: "landing" });
    expect(parseSurface("")).toEqual({ kind: "landing" });
  });

  it("sends the app prefix to the creator app", () => {
    expect(parseSurface("/app")).toEqual({ kind: "app" });
    expect(parseSurface("/app/")).toEqual({ kind: "app" });
  });

  it("leaves the sections below /app to the router", () => {
    for (const section of ["bake", "airdrop", "oven", "events"]) {
      expect(parseSurface(`/app/${section}`)).toEqual({ kind: "app" });
    }
    expect(parseSurface("/app/anything/deeper")).toEqual({ kind: "app" });
  });

  it("matches the two public routes before anything else", () => {
    expect(parseSurface("/e/summer-drop")).toEqual({
      kind: "public",
      route: { kind: "register", slug: "summer-drop" },
    });
    expect(parseSurface("/e/summer-drop/verify")).toEqual({
      kind: "public",
      route: { kind: "verify", slug: "summer-drop" },
    });
  });

  it("falls back to the landing rather than 404ing", () => {
    expect(parseSurface("/pricing")).toEqual({ kind: "landing" });
    expect(parseSurface("/e")).toEqual({ kind: "landing" });
    // Rejected by the slug alphabet, so it is not a public route at all.
    expect(parseSurface("/e/NOT VALID")).toEqual({ kind: "landing" });
    expect(parseSurface("/e/slug/nonsense")).toEqual({ kind: "landing" });
  });

  it("does not mistake a path that merely starts with the letters", () => {
    expect(parseSurface("/applications")).toEqual({ kind: "landing" });
    expect(parseSurface("/events")).toEqual({ kind: "landing" });
  });

  it("agrees with the basename CreatorApp mounts under", () => {
    expect(parseSurface(APP_BASENAME)).toEqual({ kind: "app" });
  });
});
