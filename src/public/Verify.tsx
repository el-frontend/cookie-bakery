import { useEffect, useMemo, useState, type FormEvent } from "react";
import { explorer } from "../lib/chain/explorer";
import { hashEntry } from "../lib/draw/hashEntry";
import { verifyDraw, type PublishedDraw } from "../lib/draw/verifyDraw";
import { listPublicDraws, type PublishedDrawRow } from "../lib/supabase/draws";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Field";
import { EmptyState } from "../components/EmptyState";

/**
 * The public verifier (spec §5.3.3, §5.5).
 *
 * "Provably fair" is a claim until someone other than us can check it. This
 * page recomputes the whole draw from the same public columns anyone can
 * read, rather than asking a visitor to trust a green checkmark we drew —
 * every one of the five checks below is either computed here from first
 * principles (`verifyDraw`, a SECOND, independently written implementation
 * of the algorithm — see its docstring) or handed off as a link to CookieScan
 * so a reader confirms the on-chain half themselves.
 *
 * Every draw an event ever had is listed here, abandoned ones included —
 * `draws` has no DELETE policy specifically so a creator who commits, doesn't
 * like the outcome and starts over cannot make the first attempt disappear.
 * Hiding abandoned draws would remove the only defence against that.
 *
 * NEVER render a wallet address. The draw runs over salted commitments
 * (`SHA256(event_id || 0x00 || wallet)`), never over addresses, so this page
 * can be verified in full without publishing the handle→wallet map. A
 * participant checks their own inclusion with the "check your own entry" box
 * below — it hashes an address locally and never sends it anywhere.
 */
export function Verify({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });

    listPublicDraws(slug)
      .then((draws) => {
        if (!cancelled) setPhase({ kind: "loaded", draws });
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "load-error" });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="flex min-h-dvh justify-center bg-bg1 px-4 py-10 text-ink sm:py-16">
      <div className="w-full max-w-2xl space-y-6">
        <header className="enter space-y-2 text-center">
          <h1 className="break-words font-display text-2xl font-bold tracking-[-0.03em]">
            Verify a draw
          </h1>
          <p className="text-sm text-ink-2">
            Every draw ever run for{" "}
            <span className="font-mono text-ink">/e/{slug}</span>, recomputed
            from the public record — nothing here needs to be taken on faith.
          </p>
        </header>

        {phase.kind === "loading" ? (
          <p
            role="status"
            className="animate-pulse py-24 text-center text-sm text-ink-2"
          >
            Loading draws…
          </p>
        ) : phase.kind === "load-error" ? (
          <NoticeCard
            title="Something went wrong"
            body="We couldn't load this giveaway's draws. Check your connection and try reloading the page."
          />
        ) : phase.draws.length === 0 ? (
          <EmptyState
            action={{ href: `/e/${slug}`, label: "View this giveaway" }}
            detail="This giveaway hasn't run a draw yet. Once the creator commits to one, it will show up here — including if it's later abandoned."
            title="No draws yet"
          />
        ) : (
          <>
            <HowToCheck />
            <CheckMyEntry draws={phase.draws} />
            <div className="enter flex flex-col gap-5">
              {phase.draws.map((draw) => (
                <DrawCard draw={draw} key={draw.id} />
              ))}
            </div>
            <Limitations />
          </>
        )}
      </div>
    </main>
  );
}

type Phase =
  | { kind: "loading" }
  | { kind: "load-error" }
  | { kind: "loaded"; draws: PublishedDrawRow[] };

function NoticeCard({ body, title }: { body: string; title: string }) {
  return (
    <section className="enter flex flex-col items-center gap-3 rounded-xl border border-border-low bg-card px-6 py-12 text-center">
      <h2 className="break-words font-display text-xl font-bold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="max-w-[360px] text-sm leading-relaxed text-ink-2">{body}</p>
    </section>
  );
}

function HowToCheck() {
  return (
    <section className="rounded-xl border border-border-low bg-card/60 p-5 text-[13px] leading-relaxed text-ink-2">
      <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
        How to check this yourself
      </h2>
      <p>
        For each draw below: hash the revealed seed with SHA-256 and compare it
        to the commit. Open the commit and reveal transactions on CookieScan to
        confirm the slot and blockhash instead of trusting the values stored
        here. Sort the entry hash list and hash it to confirm the entries root.
        Then re-run the shuffle — documented in `verifyDraw.ts` — over that list
        with the seed and blockhash to confirm the winners.
      </p>
    </section>
  );
}

function Limitations() {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border-strong bg-card/40 p-5 text-[13px] leading-relaxed text-ink-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
        What this can and can't prove
      </h2>
      <p>
        <strong className="text-ink">This is not a VRF.</strong> A validator
        that happens to produce the target block has marginal influence over the
        outcome. That's fine for a community giveaway — it is not sold as
        anything more than that.
      </p>
      <p>
        <strong className="text-ink">
          A clean draw does not mean an honest list.
        </strong>{" "}
        Nothing stops a creator from registering many wallets of their own
        before closing entries, and the draw would still run mathematically
        cleanly over that padded list. This tool makes the draw verifiable — it
        does not make the entry list honest.
      </p>
    </section>
  );
}

// --- Check your own entry, locally, without publishing the wallet map ----

function CheckMyEntry({ draws }: { draws: PublishedDrawRow[] }) {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<"found" | "not-found" | null>(null);

  const eventId = draws[0]?.eventId;
  const allHashes = useMemo(
    () => new Set(draws.flatMap((draw) => draw.entryHashes)),
    [draws]
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!eventId || trimmed === "") return;
    setResult(
      allHashes.has(hashEntry(eventId, trimmed)) ? "found" : "not-found"
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border-low bg-card p-5">
      <h2 className="font-display text-base font-bold tracking-[-0.02em]">
        Check your own entry
      </h2>
      <p className="text-[13px] leading-relaxed text-ink-2">
        Entries are published as hashes, never as wallet addresses, so nobody
        but you can tell which one is yours. Paste your address below — it is
        hashed right here in your browser and never sent anywhere.
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={handleSubmit}
      >
        <div className="min-w-0 flex-1">
          <Field label="Your Cookie Chain address">
            <Input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              onChange={(e) => {
                setAddress(e.target.value);
                setResult(null);
              }}
              placeholder="Paste your address here"
              spellCheck={false}
              style={{ fontSize: "16px" }}
              value={address}
            />
          </Field>
        </div>
        <Button disabled={address.trim() === ""} type="submit">
          Check
        </Button>
      </form>
      {result === "found" ? (
        <p className="text-sm text-success">
          Found — your hash is in the published entry list.
        </p>
      ) : result === "not-found" ? (
        <p className="text-sm text-ink-2">
          Not found in any published list here. Double-check the address you
          registered with.
        </p>
      ) : null}
    </section>
  );
}

// --- Per-draw states -------------------------------------------------------

function DrawCard({ draw }: { draw: PublishedDrawRow }) {
  if (draw.status === "abandoned") return <AbandonedDraw draw={draw} />;
  if (draw.status === "committed") return <CommittedDraw draw={draw} />;
  return <RevealedDraw draw={draw} />;
}

function CommitLink({ draw }: { draw: PublishedDrawRow }) {
  if (!draw.commitSignature) return null;
  return (
    <a
      className="text-[12.5px] font-medium text-accent underline underline-offset-2"
      href={explorer.txUrl(draw.commitSignature)}
      rel="noreferrer"
      target="_blank"
    >
      View commit tx on CookieScan →
    </a>
  );
}

function CommittedDraw({ draw }: { draw: PublishedDrawRow }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-border-low bg-card p-5"
      data-testid="draw-committed"
    >
      <span className="inline-flex w-fit items-center rounded-full bg-accent/12 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-accent">
        Committed
      </span>
      <p className="text-sm leading-relaxed text-ink-2">
        This draw is committed but not revealed yet — there is nothing to verify
        until the creator reveals it, once Cookie Chain reaches slot{" "}
        <span className="num font-mono text-ink">{draw.targetSlot}</span>.
      </p>
      <CommitLink draw={draw} />
    </section>
  );
}

function AbandonedDraw({ draw }: { draw: PublishedDrawRow }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-card/40 p-5"
      data-testid="draw-abandoned"
    >
      <span className="inline-flex w-fit items-center rounded-full bg-ink-3/20 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-2">
        Not completed
      </span>
      <p className="text-sm leading-relaxed text-ink-2">
        This draw was committed and then abandoned before its winners were
        revealed. It stays listed rather than disappearing — hiding an abandoned
        draw is exactly what would let a re-roll go unnoticed.
      </p>
      <CommitLink draw={draw} />
    </section>
  );
}

/** `null` when a "revealed" row is missing a field verification needs. */
function toPublishedDraw(draw: PublishedDrawRow): PublishedDraw | null {
  if (
    draw.blockhash === null ||
    draw.revealedSeed === null ||
    draw.commitSlot === null ||
    draw.winners === null
  ) {
    return null;
  }
  return {
    blockhash: draw.blockhash,
    commit: draw.commit,
    commitSlot: draw.commitSlot,
    entriesRoot: draw.entriesRoot,
    entryHashes: draw.entryHashes,
    revealedSeed: draw.revealedSeed,
    targetSlot: draw.targetSlot,
    winners: draw.winners,
    winnersCount: draw.winnersCount,
  };
}

function RevealedDraw({ draw }: { draw: PublishedDrawRow }) {
  const published = toPublishedDraw(draw);
  const result = published ? verifyDraw(published) : null;
  const failures = new Set(result && !result.ok ? result.failures : []);
  const incomplete = published === null;
  const ok = !incomplete && result?.ok === true;

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-border-low bg-card p-5"
      data-testid="draw-revealed"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold tracking-[-0.02em]">
          Draw #{draw.id.slice(0, 8)}
        </h3>
        <VerdictBadge state={incomplete ? "unknown" : ok ? "pass" : "fail"} />
      </div>

      {incomplete ? (
        <p className="text-sm text-ink-2">
          This draw's on-chain record is incomplete, so it can't be fully
          verified from here.
        </p>
      ) : ok ? (
        <p className="text-sm text-success">
          This draw checks out — every value below recomputes exactly as
          published.
        </p>
      ) : (
        <p className="text-sm text-danger">
          This draw does not check out. {failures.size} of the five checks below
          failed.
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        <CheckRow
          label="SHA-256 of the revealed seed matches the published commit"
          state={
            incomplete
              ? "info"
              : failures.has("commit-mismatch")
                ? "fail"
                : "pass"
          }
        />
        <CheckRow
          label={`Commit landed before target slot ${draw.targetSlot}`}
          link={draw.commitSignature ? commitLinkFor(draw) : undefined}
          note="On-chain, not a database timestamp — confirm the slot yourself on the transaction."
          state={
            incomplete
              ? "info"
              : failures.has("commit-not-before-target")
                ? "fail"
                : "pass"
          }
        />
        <CheckRow
          label={`Blockhash is the real one for slot ${draw.targetSlot}`}
          link={draw.revealSignature ? revealLinkFor(draw) : undefined}
          note="We can't check this for you — open the block on CookieScan and compare its hash to the one below."
          state="info"
        />
        <CheckRow
          label="Entry list matches the published root, in canonical order"
          state={
            incomplete
              ? "info"
              : failures.has("root-mismatch") ||
                  failures.has("not-canonical-order")
                ? "fail"
                : "pass"
          }
        />
        <CheckRow
          label="Recomputing the shuffle yields exactly the published winners"
          state={
            incomplete
              ? "info"
              : failures.has("winners-mismatch") ||
                  failures.has("winners-count-mismatch")
                ? "fail"
                : "pass"
          }
        />
      </ul>

      <DrawInputs draw={draw} />
    </section>
  );
}

function commitLinkFor(draw: PublishedDrawRow) {
  return draw.commitSignature
    ? { href: explorer.txUrl(draw.commitSignature), label: "View commit tx →" }
    : undefined;
}

function revealLinkFor(draw: PublishedDrawRow) {
  return draw.revealSignature
    ? { href: explorer.txUrl(draw.revealSignature), label: "View reveal tx →" }
    : undefined;
}

function VerdictBadge({ state }: { state: "pass" | "fail" | "unknown" }) {
  const styles =
    state === "pass"
      ? "bg-success/15 text-success"
      : state === "fail"
        ? "bg-danger/15 text-danger"
        : "bg-ink-3/20 text-ink-2";
  const label =
    state === "pass"
      ? "Checks out"
      : state === "fail"
        ? "Failed"
        : "Incomplete";
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] " +
        styles
      }
    >
      {label}
    </span>
  );
}

function CheckRow({
  label,
  link,
  note,
  state,
}: {
  label: string;
  link?: { href: string; label: string };
  note?: string;
  state: "pass" | "fail" | "info";
}) {
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border-low bg-bg1 px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold " +
            (state === "pass"
              ? "bg-success/15 text-success"
              : state === "fail"
                ? "bg-danger/15 text-danger"
                : "bg-ink-3/20 text-ink-2")
          }
        >
          {state === "pass" ? "✓" : state === "fail" ? "✕" : "i"}
        </span>
        <span className="text-[13.5px] font-medium leading-snug text-ink">
          {label}
        </span>
      </div>
      {note ? (
        <p className="pl-[30px] text-[12px] leading-relaxed text-ink-3">
          {note}
        </p>
      ) : null}
      {link ? (
        <a
          className="pl-[30px] text-[12px] font-medium text-accent underline underline-offset-2"
          href={link.href}
          rel="noreferrer"
          target="_blank"
        >
          {link.label}
        </a>
      ) : null}
    </li>
  );
}

function DrawInputs({ draw }: { draw: PublishedDrawRow }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <InputField label="Commit" value={draw.commit} />
      <InputField label="Revealed seed" value={draw.revealedSeed} />
      <InputField label="Blockhash" value={draw.blockhash} />
      <InputField label="Entries root" value={draw.entriesRoot} />
      <InputField label="Target slot" value={String(draw.targetSlot)} />
      <InputField
        label="Commit slot"
        value={draw.commitSlot === null ? null : String(draw.commitSlot)}
      />
      {draw.winners ? (
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.06em] text-ink-3">
            Winning entry hashes
          </dt>
          <ul className="mt-1 flex flex-col gap-1">
            {draw.winners.map((hash, index) => (
              <li
                className="break-all rounded-md border border-border-low bg-card px-2.5 py-1.5 font-mono text-[11px] text-ink-2"
                key={hash}
              >
                #{index + 1} {hash}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </dl>
  );
}

function InputField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-[0.06em] text-ink-3">
        {label}
      </dt>
      <dd className="break-all font-mono text-[11.5px] text-ink-2">
        {value ?? "—"}
      </dd>
    </div>
  );
}
