/**
 * The cookie B.
 *
 * Loaded as an `<img>` rather than inlined as JSX: the artwork is 139 paths,
 * about 41 kB, and inlining it would put every byte into the CreatorApp chunk
 * to render one 28px mark. As a static asset it is fetched once, cached, and
 * costs the public register page — which never renders the header — nothing.
 *
 * The trade is that it no longer inherits `currentColor` the way the old
 * stroke-based glyph did. That is fine here: this mark is full-colour by
 * design and the header is the only place it appears.
 */

/** The art's own bounding box, so `size` can mean height and width follows. */
const ASPECT = 118 / 167;

export function BakeryMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/mark.svg"
      alt=""
      aria-hidden
      // Both dimensions are set so the header does not reflow while the file
      // loads — the wordmark beside it would visibly jump.
      width={Math.round(size * ASPECT)}
      height={size}
      className="block"
    />
  );
}
