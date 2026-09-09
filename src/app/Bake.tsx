import { useCallback, useState } from "react";
import { generateKeyPairSigner, type TransactionSigner } from "@solana/kit";
import {
  usePayer,
  usePlanTransaction,
  useSendTransaction,
} from "@solana/react";
import { BakeSummary } from "../components/BakeSummary";
import { Button } from "../components/ui/Button";
import { Checkbox, Field, Input } from "../components/ui/Field";
import { TokenResultCard } from "../components/TokenResultCard";
import { useBakeCost } from "../hooks/useBakeCost";
import { useCookBalance } from "../hooks/useCookBalance";
import { useTrackedSend } from "../hooks/useTrackedSend";
import { mapError } from "../lib/errors/mapError";
import type { MappedError } from "../lib/errors/types";
import {
  DEFAULT_BAKE_FORM,
  toBaseUnits,
  validateBakeForm,
  type BakeFormValues,
  type FieldErrors,
} from "../lib/token/bakeForm";
import {
  buildCreateToken2022Plan,
  extensionsFor,
} from "../lib/token/buildCreateToken2022";
import { buildCreateTokenClassicPlan } from "../lib/token/buildCreateTokenClassic";
import { estimateBakeCost, type BakeCost } from "../lib/token/sizing";
import { formatCookWithSymbol } from "../lib/format/lamports";
import type { Lamports } from "@solana/kit";
import { addMyToken, type MyToken } from "../store/myTokens";
import type { AppClient } from "../providers";

/**
 * The Bake screen (RF-02.6).
 *
 * Three phases, because the PRD requires the cost and the simulation result on
 * screen BEFORE anything reaches the wallet:
 *
 *   form → review (plan + simulate + price) → result
 *
 * The mint keypair is generated on entering `review` and held until the token
 * is created, so the address shown in the summary is the address the user ends
 * up with.
 */

type AdvancedOptions = {
  mintCloseAuthority: boolean;
  program: "token" | "token-2022";
  revokeFreezeAuthority: boolean;
  revokeMintAuthority: boolean;
  transferFeeBasisPoints: string;
  transferFeeEnabled: boolean;
  transferFeeMax: string;
};

const DEFAULT_ADVANCED: AdvancedOptions = {
  mintCloseAuthority: false,
  program: "token-2022",
  // PRD RF-02: "revocar freeze authority (checkbox, default activado)".
  revokeFreezeAuthority: true,
  revokeMintAuthority: false,
  transferFeeBasisPoints: "0",
  transferFeeEnabled: false,
  transferFeeMax: "0",
};

type Phase = "form" | "result" | "review";

const SELECT_CLASS =
  "h-[46px] w-full rounded-md border border-border-strong bg-bg1 px-3.5 text-[14.5px] " +
  "outline-none transition-[border-color,box-shadow] duration-[160ms] " +
  "[transition-timing-function:var(--ease-strong-out)] focus:border-accent " +
  "focus:shadow-[0_0_0_3px_rgba(232,163,61,0.15)]";

/**
 * The cost strip under the form. It appears as soon as the token has a name
 * and a symbol — seeing the price before committing to a review is the point.
 */
function CostPreview({
  balance,
  cost,
}: {
  balance: Lamports | null;
  cost: BakeCost | null;
}) {
  const short = cost != null && balance != null && balance < cost.total;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/20 bg-accent/[0.05] px-5 py-[18px]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-ink-2">Estimated cost</span>
        <span className="font-mono text-[15px] font-semibold text-accent num">
          {cost ? formatCookWithSymbol(cost.total as Lamports) : "—"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-ink-3">Your balance</span>
        <span
          className={
            "font-mono text-[13px] num " +
            (short ? "font-semibold text-danger" : "text-ink-2")
          }
        >
          {balance == null ? "—" : formatCookWithSymbol(balance)}
        </span>
      </div>
    </div>
  );
}

export function Bake({ client }: { client: AppClient }) {
  const payer = usePayer(client);
  const { lamports } = useCookBalance(payer?.address);
  const planTransaction = usePlanTransaction(client);
  const sendTransaction = useSendTransaction(client);

  const tracked = useTrackedSend(sendTransaction.dispatchAsync, {
    pending: "Creating your token…",
    success: "Token created",
  });

  const [values, setValues] = useState<BakeFormValues>(DEFAULT_BAKE_FORM);
  const [advanced, setAdvanced] = useState<AdvancedOptions>(DEFAULT_ADVANCED);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("form");
  const [mintSigner, setMintSigner] = useState<TransactionSigner | null>(null);
  const [cost, setCost] = useState<BakeCost | null>(null);
  const [simulationError, setSimulationError] = useState<MappedError | null>(
    null
  );
  const [isPlanning, setIsPlanning] = useState(false);
  const [created, setCreated] = useState<MyToken | null>(null);

  const isToken2022 = advanced.program === "token-2022";

  const previewCost = useBakeCost(
    client,
    values.name.trim() && values.symbol.trim()
      ? {
          mintCloseAuthority: isToken2022 && advanced.mintCloseAuthority,
          name: values.name.trim(),
          symbol: values.symbol.trim(),
          token2022: isToken2022,
          transferFee: null,
          uri: isToken2022 ? (values.metadataUri?.trim() ?? "") : "",
        }
      : null
  );

  const update = useCallback(
    <K extends keyof BakeFormValues>(key: K, value: BakeFormValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
    },
    []
  );

  /** Everything the two builders need, derived from the validated form. */
  const buildInput = useCallback(
    (mint: TransactionSigner, authority: TransactionSigner) => {
      const supply = toBaseUnits(values.supply, values.decimals);
      const transferFee =
        isToken2022 && advanced.transferFeeEnabled
          ? {
              basisPoints: Number(advanced.transferFeeBasisPoints),
              maximumFee: toBaseUnits(
                advanced.transferFeeMax || "0",
                values.decimals
              ),
            }
          : null;

      return {
        authority,
        decimals: values.decimals,
        mint,
        mintCloseAuthority: isToken2022 && advanced.mintCloseAuthority,
        name: values.name.trim(),
        revokeFreezeAuthority: advanced.revokeFreezeAuthority,
        revokeMintAuthority: advanced.revokeMintAuthority,
        supply,
        symbol: values.symbol.trim(),
        transferFee,
        uri: values.metadataUri?.trim() ?? "",
      };
    },
    [advanced, isToken2022, values]
  );

  const buildPlan = useCallback(
    (mint: TransactionSigner, authority: TransactionSigner) => {
      const input = buildInput(mint, authority);
      return isToken2022
        ? buildCreateToken2022Plan(client, input)
        : buildCreateTokenClassicPlan(client, input);
    },
    [buildInput, client, isToken2022]
  );

  const review = useCallback(async () => {
    const fieldErrors = validateBakeForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (!payer) return;

    setIsPlanning(true);
    setSimulationError(null);
    setCost(null);
    setPhase("review");

    try {
      const mint = await generateKeyPairSigner();
      setMintSigner(mint);

      const input = buildInput(mint, payer);
      const extensions = isToken2022 ? extensionsFor(input) : [];
      setCost(await estimateBakeCost(client, extensions));

      // Planning simulates to estimate resource limits, so a transaction the
      // chain would reject fails here rather than after the user signs.
      await planTransaction.dispatchAsync(await buildPlan(mint, payer));
    } catch (raw) {
      setSimulationError(mapError(raw));
    } finally {
      setIsPlanning(false);
    }
  }, [
    buildInput,
    buildPlan,
    client,
    isToken2022,
    payer,
    planTransaction,
    values,
  ]);

  const submit = useCallback(async () => {
    if (!payer || !mintSigner) return;

    // The INSTRUCTION plan is sent, not the planned message: useTrackedSend
    // retries once on an expired blockhash, and only re-planning picks up a
    // fresh one. Signing takes long enough on Cookie Chain that this is the
    // normal path, not an edge case.
    const result = await tracked.dispatch(await buildPlan(mintSigner, payer));
    if (!result.signature) return;

    const token: MyToken = {
      createdAt: new Date().toISOString(),
      decimals: values.decimals,
      description: values.description?.trim() ?? "",
      metadataUri: isToken2022 ? (values.metadataUri?.trim() ?? "") : "",
      mint: mintSigner.address,
      name: values.name.trim(),
      program: advanced.program,
      signature: result.signature,
      supply: toBaseUnits(values.supply, values.decimals).toString(),
      symbol: values.symbol.trim(),
    };
    addMyToken(token);
    setCreated(token);
    setPhase("result");
  }, [
    advanced.program,
    buildPlan,
    isToken2022,
    mintSigner,
    payer,
    tracked,
    values,
  ]);

  const bakeAnother = useCallback(() => {
    setCreated(null);
    setMintSigner(null);
    setCost(null);
    setSimulationError(null);
    setPhase("form");
  }, []);

  if (phase === "result" && created) {
    return <TokenResultCard onBakeAnother={bakeAnother} token={created} />;
  }

  if (phase === "review") {
    return (
      <div className="enter space-y-4">
        <BakeSummary
          balance={lamports}
          cost={cost}
          decimals={values.decimals}
          freezeRevoked={advanced.revokeFreezeAuthority}
          isPlanning={isPlanning}
          isSending={tracked.isRunning}
          mint={mintSigner?.address ?? null}
          mintRevoked={advanced.revokeMintAuthority}
          name={values.name.trim()}
          onSubmit={() => void submit()}
          program={advanced.program}
          simulationError={simulationError}
          supply={values.supply}
          symbol={values.symbol.trim()}
        />
        <button
          data-testid="bake-back"
          onClick={() => setPhase("form")}
          className="text-sm font-medium underline underline-offset-2"
        >
          Back to the form
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Bake a token" className="flex flex-col gap-[22px]">
      <div className="enter enter-1 flex flex-col gap-[7px]">
        <h2 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em]">
          Bake a token
        </h2>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Creates the mint, your token account and the initial supply in a
          single transaction.
        </p>
      </div>

      <div className="enter enter-2 flex flex-col gap-[18px] rounded-xl border border-border-low bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <Input
              aria-label="Name"
              onChange={(e) => update("name", e.target.value)}
              placeholder="Bakery Cookie"
              value={values.name}
            />
          </Field>
          <Field label="Symbol" error={errors.symbol}>
            <Input
              aria-label="Symbol"
              onChange={(e) => update("symbol", e.target.value)}
              placeholder="BAKE"
              value={values.symbol}
            />
          </Field>
          <Field label="Decimals" error={errors.decimals}>
            <Input
              aria-label="Decimals"
              max={9}
              min={0}
              onChange={(e) => update("decimals", Number(e.target.value))}
              type="number"
              value={values.decimals}
            />
          </Field>
          <Field label="Initial supply" error={errors.supply}>
            <Input
              aria-label="Initial supply"
              onChange={(e) => update("supply", e.target.value)}
              value={values.supply}
            />
          </Field>
        </div>

        <Field label="Metadata URI (optional)" error={errors.metadataUri}>
          <Input
            aria-label="Metadata URI"
            disabled={!isToken2022}
            onChange={(e) => update("metadataUri", e.target.value)}
            placeholder="https://example.com/metadata.json"
            value={values.metadataUri ?? ""}
          />
        </Field>

        <Field label="Short description" hint="stored on this device">
          <Input
            aria-label="Short description"
            onChange={(e) => update("description", e.target.value)}
            value={values.description ?? ""}
          />
        </Field>

        <div className="h-px bg-border-low" />

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold marker:content-none">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="text-ink-2 transition-transform duration-[200ms] [transition-timing-function:var(--ease-strong-out)] group-open:rotate-90"
            >
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Advanced options
            {isToken2022 ? (
              <span className="rounded-full bg-accent/12 px-2.5 py-[3px] text-[11px] font-semibold text-accent">
                Token-2022
              </span>
            ) : null}
          </summary>
          <div className="mt-4 space-y-4">
            <Field label="Token program">
              <select
                aria-label="Token program"
                className={SELECT_CLASS}
                onChange={(e) =>
                  setAdvanced((current) => ({
                    ...current,
                    program: e.target.value as AdvancedOptions["program"],
                  }))
                }
                value={advanced.program}
              >
                <option value="token-2022">
                  Token-2022 (metadata + extensions)
                </option>
                <option value="token">Classic SPL Token (no metadata)</option>
              </select>
            </Field>

            <Checkbox
              checked={advanced.revokeFreezeAuthority}
              label="Revoke freeze authority"
              onChange={(checked) =>
                setAdvanced((c) => ({ ...c, revokeFreezeAuthority: checked }))
              }
            />
            <Checkbox
              checked={advanced.revokeMintAuthority}
              label="Revoke mint authority after the initial mint"
              onChange={(checked) =>
                setAdvanced((c) => ({ ...c, revokeMintAuthority: checked }))
              }
            />
            <Checkbox
              checked={advanced.mintCloseAuthority}
              disabled={!isToken2022}
              label="Mint close authority"
              onChange={(checked) =>
                setAdvanced((c) => ({ ...c, mintCloseAuthority: checked }))
              }
            />
            <Checkbox
              checked={advanced.transferFeeEnabled}
              disabled={!isToken2022}
              label="Transfer fee"
              onChange={(checked) =>
                setAdvanced((c) => ({ ...c, transferFeeEnabled: checked }))
              }
            />

            {advanced.transferFeeEnabled && isToken2022 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fee (basis points)">
                  <Input
                    aria-label="Fee basis points"
                    max={10000}
                    min={0}
                    onChange={(e) =>
                      setAdvanced((c) => ({
                        ...c,
                        transferFeeBasisPoints: e.target.value,
                      }))
                    }
                    type="number"
                    value={advanced.transferFeeBasisPoints}
                  />
                </Field>
                <Field label="Maximum fee (tokens)">
                  <Input
                    aria-label="Maximum fee"
                    onChange={(e) =>
                      setAdvanced((c) => ({
                        ...c,
                        transferFeeMax: e.target.value,
                      }))
                    }
                    value={advanced.transferFeeMax}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </details>
      </div>

      {payer ? (
        <div className="enter enter-3">
          <CostPreview balance={lamports} cost={previewCost} />
        </div>
      ) : null}

      <Button
        data-testid="bake-review"
        disabled={!payer}
        onClick={() => void review()}
        size="lg"
        className="enter enter-3 w-full"
      >
        {payer ? "Review transaction" : "Connect a wallet to bake"}
        {payer ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 12h13M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </Button>
    </section>
  );
}
