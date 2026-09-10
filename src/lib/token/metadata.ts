/**
 * Resolving token metadata that someone else controls (RF-04.4).
 *
 * The URI comes from whoever created the mint, and so does everything behind
 * it. This module is the only place the app touches that content, and it
 * treats all of it as hostile:
 *
 * - **`https:` only.** `http:` is refused rather than upgraded, and `data:`,
 *   `blob:` and `javascript:` are refused outright. Silently upgrading a
 *   scheme would hide from the user that the token's own metadata was served
 *   insecurely.
 * - **No credentials, no referrer.** The request must never leak the viewer's
 *   cookies or the app's URL to a server a stranger nominated.
 * - **Capped and timed out, by streaming.** The body is read chunk by chunk
 *   and abandoned the moment it passes the cap, so a deliberately enormous
 *   response costs bandwidth but never memory. Reading it all and then
 *   checking the length would be no defence at all.
 * - **Every string is flattened to plain text**, and the same flattener is
 *   used for the on-chain `TokenMetadata` strings. One implementation, so the
 *   two cannot drift.
 *
 * Nothing in the fetched document is ever treated as an instruction, a URL to
 * follow, or markup to render. It is data, and only ever data.
 */

/** 64 KiB. Real token metadata is a few hundred bytes. */
export const MAX_METADATA_BYTES = 64 * 1024;

export const METADATA_TIMEOUT_MS = 8_000;

/** Names and symbols are labels, not prose. */
export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 400;

export type RemoteMetadata = {
  description: string | null;
  /** A validated `https:` URL, or null. Never rendered as anything but a src. */
  image: string | null;
  name: string | null;
  symbol: string | null;
};

/**
 * Invisible characters that carry no separator meaning.
 *
 * The bidi controls are not paranoia: U+202E flips the rendering direction of
 * everything after it, which is the standard trick for making a name or an
 * address read as something it is not. React escaping does nothing about them
 * because they are not markup — they are text that lies. These are removed
 * outright, never turned into a space, because they occupy no width to begin
 * with: a BOM sitting inside a word is not a word boundary.
 */
const INVISIBLE = new RegExp(
  [
    "[\\u200B-\\u200F", // zero-width space, ZWNJ, ZWJ, LTR/RTL marks
    "\\u202A-\\u202E", // bidi embedding and override
    "\\u2066-\\u2069", // bidi isolates
    "\\uFEFF]", // byte-order mark
  ].join(""),
  "g"
);

/**
 * C0 and C1 control characters.
 *
 * Applied AFTER whitespace has been collapsed, because the whitespace
 * controls — newline, tab, carriage return — live in this range and are
 * genuine word separators. Removing them first turns "Bakery\nCookie" into
 * "BakeryCookie" and silently fuses two words into one.
 */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

/** Anything that looks like a tag. Never legitimate in a token's name. */
const TAG_LIKE = /<[^>]*>/g;

/**
 * Flatten untrusted input to a single line of plain text.
 *
 * Returns null rather than an empty string when nothing survives, so callers
 * can fall back to another source instead of rendering a blank label.
 */
export function plainText(
  value: unknown,
  maxLength = MAX_NAME_LENGTH
): string | null {
  if (typeof value !== "string") return null;

  /*
   * Order matters, and each step exists because of a specific failure:
   *   1. tags       — never legitimate in a token label
   *   2. invisibles — removed, not spaced: they have no width and no meaning
   *   3. whitespace — collapsed to single spaces so newlines stay separators
   *   4. controls   — the non-whitespace remainder, now safe to delete
   *   5. collapse   — tidies gaps left where an invisible sat between spaces
   */
  const cleaned = value
    .replace(TAG_LIKE, "")
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 0) return null;
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…`
    : cleaned;
}

/** True only for an `https:` URL this app is willing to request. */
export function isSafeMetadataUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:";
}

/**
 * An image URL safe to put in a `src`.
 *
 * Same rule as the document itself: `https:` or nothing. A `data:` image would
 * render, which is exactly why it is refused — it is an arbitrary payload from
 * a stranger with no origin to attribute it to.
 */
export function safeImageUrl(value: unknown): string | null {
  return isSafeMetadataUrl(value) ? value : null;
}

/**
 * Read at most `maxBytes` of a response body.
 *
 * A declared `content-length` over the cap short-circuits before a single byte
 * of body is read. Where the body is a stream it is read incrementally and
 * cancelled on overflow; the `text()` path is a fallback for environments
 * without streams and is the weaker of the two.
 */
async function readCapped(
  response: Response,
  maxBytes: number
): Promise<string | null> {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const body = response.body as ReadableStream<Uint8Array> | null | undefined;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }

    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  const text = await response.text();
  return text.length > maxBytes ? null : text;
}

export type MetadataOptions = {
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
};

/**
 * Fetch and sanitise a token's metadata document.
 *
 * Never throws. Every failure — bad scheme, timeout, 404, oversized body,
 * invalid JSON, a JSON array where an object was expected — resolves to null,
 * because the dashboard's job is to render the mint with whatever it could
 * confirm, not to break because a stranger's server misbehaved.
 */
export async function fetchRemoteMetadata(
  uri: string,
  options: MetadataOptions = {}
): Promise<RemoteMetadata | null> {
  const {
    fetchImpl = fetch,
    maxBytes = MAX_METADATA_BYTES,
    timeoutMs = METADATA_TIMEOUT_MS,
  } = options;

  if (!isSafeMetadataUrl(uri)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(uri, {
      credentials: "omit",
      headers: { accept: "application/json" },
      method: "GET",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const text = await readCapped(response, maxBytes);
    if (text === null) return null;

    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const document = parsed as Record<string, unknown>;
    return {
      description: plainText(document.description, MAX_DESCRIPTION_LENGTH),
      image: safeImageUrl(document.image),
      name: plainText(document.name),
      symbol: plainText(document.symbol, 32),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
