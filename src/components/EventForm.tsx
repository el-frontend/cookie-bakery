import { useCallback, useState } from "react";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Field";
import { slugify } from "../lib/supabase/slug";

/**
 * The mint fields `EventForm` actually needs.
 *
 * Deliberately NOT `SelectedToken` verbatim: that type's `mint` is the branded
 * `Address`, but all this form does with it is hand it straight to
 * `createEvent`, whose column is a plain `string`. Keeping the prop narrow
 * means the parent (which DOES hold a full `SelectedToken` for the on-chain
 * `TokenSelector`) can pass one in without a cast — `Address` is already a
 * `string` — while this component stays decoupled from Kit's address
 * branding entirely.
 */
export type EventFormToken = {
  decimals: number;
  mint: string;
  symbol: string;
};

export type CreateEventInput = {
  mint: string;
  mintDecimals: number;
  mintSymbol: string | null;
  slug: string;
  title: string;
};

/**
 * Title, link and submit — the mint itself is picked elsewhere (`Events.tsx`
 * renders `TokenSelector` and hands the result down as `token`) so this form
 * never needs an RPC client of its own.
 *
 * The slug starts life derived from the title (`slugify`, matched byte-for-byte
 * against the public route's alphabet) and stops tracking the moment the
 * creator types into the link field directly — a manual edit must never be
 * silently overwritten by the next keystroke in the title.
 */
export function EventForm({
  onSubmit,
  token,
}: {
  onSubmit: (input: CreateEventInput) => void;
  token: EventFormToken | null;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const changeTitle = useCallback(
    (value: string) => {
      setTitle(value);
      if (!slugTouched) setSlug(slugify(value));
    },
    [slugTouched]
  );

  const changeSlug = useCallback((value: string) => {
    setSlug(value);
    setSlugTouched(true);
  }, []);

  const canSubmit = title.trim() !== "" && token !== null;

  const submit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (trimmedTitle === "" || token === null) return;
    onSubmit({
      mint: token.mint,
      mintDecimals: token.decimals,
      mintSymbol: token.symbol,
      slug,
      title: trimmedTitle,
    });
  }, [onSubmit, slug, title, token]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5">
      <Field label="Title">
        <Input
          aria-label="Title"
          onChange={(event) => changeTitle(event.target.value)}
          placeholder="Summer Jam Giveaway"
          value={title}
        />
      </Field>

      <Field
        hint={slug ? `cookiebakery.app/e/${slug}` : undefined}
        label="Link"
      >
        <Input
          aria-label="Link"
          mono
          onChange={(event) => changeSlug(event.target.value)}
          placeholder="summer-jam-giveaway"
          value={slug}
        />
      </Field>

      <Button
        className="self-start"
        disabled={!canSubmit}
        disabledReason={
          token === null
            ? "Pick a token above first."
            : "Give the event a title first."
        }
        onClick={submit}
      >
        Create event
      </Button>
    </div>
  );
}
