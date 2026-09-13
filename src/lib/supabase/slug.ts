/**
 * A title into the event's public URL.
 *
 * The output alphabet MUST match `parsePublicRoute`'s `SLUG` pattern, or the
 * creator gets a link the public app refuses to open. The test above asserts
 * exactly that, on purpose.
 */
export function slugify(title: string): string {
  const ascii = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const kebab = ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");

  // A title of nothing but emoji still needs a usable URL.
  return kebab === "" ? `event-${Date.now().toString(36)}` : kebab;
}
