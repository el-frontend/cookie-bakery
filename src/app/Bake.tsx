import { useCallback, useState } from "react";
import { generateKeyPairSigner, type TransactionSigner } from "@solana/kit";
import {
  usePayer,
  usePlanTransaction,
  useSendTransaction,
} from "@solana/react";
import { BakeSummary } from "../components/BakeSummary";
import { TokenResultCard } from "../components/TokenResultCard";
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

const inputClass =
  "w-full rounded-lg border border-border-low bg-bg1 px-3 py-2 text-sm outline-none focus:border-primary";

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
      {error ? (
        <span role="alert" className="block text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Checkbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={disabled ? "text-muted" : undefined}>{label}</span>
    </label>
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
      <div className="space-y-4">
        <BakeSummary
          balance={lamports}
          cost={cost}
          decimals={values.decimals}
          isPlanning={isPlanning}
          isSending={tracked.isRunning}
          mint={mintSigner?.address ?? null}
          onSubmit={() => void submit()}
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
    <section
      aria-label="Bake a token"
      className="space-y-6 rounded-2xl border border-border-low bg-card p-6"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Bake a token</h2>
        <p className="text-sm text-muted">
          Creates the mint, your associated token account and the initial
          supply.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <input
            aria-label="Name"
            className={inputClass}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Bakery Cookie"
            value={values.name}
          />
        </Field>
        <Field label="Symbol" error={errors.symbol}>
          <input
            aria-label="Symbol"
            className={inputClass}
            onChange={(e) => update("symbol", e.target.value)}
            placeholder="BAKE"
            value={values.symbol}
          />
        </Field>
        <Field label="Decimals" error={errors.decimals}>
          <input
            aria-label="Decimals"
            className={inputClass}
            max={9}
            min={0}
            onChange={(e) => update("decimals", Number(e.target.value))}
            type="number"
            value={values.decimals}
          />
        </Field>
        <Field label="Initial supply" error={errors.supply}>
          <input
            aria-label="Initial supply"
            className={inputClass}
            onChange={(e) => update("supply", e.target.value)}
            value={values.supply}
          />
        </Field>
      </div>

      <Field label="Metadata URI (optional)" error={errors.metadataUri}>
        <input
          aria-label="Metadata URI"
          className={inputClass}
          disabled={!isToken2022}
          onChange={(e) => update("metadataUri", e.target.value)}
          placeholder="https://example.com/metadata.json"
          value={values.metadataUri ?? ""}
        />
      </Field>

      <Field label="Short description (stored locally)">
        <input
          aria-label="Short description"
          className={inputClass}
          onChange={(e) => update("description", e.target.value)}
          value={values.description ?? ""}
        />
      </Field>

      <details className="rounded-lg border border-border-low px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced options
        </summary>
        <div className="mt-4 space-y-4">
          <Field label="Token program">
            <select
              aria-label="Token program"
              className={inputClass}
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
                <input
                  aria-label="Fee basis points"
                  className={inputClass}
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
                <input
                  aria-label="Maximum fee"
                  className={inputClass}
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

      <button
        data-testid="bake-review"
        disabled={!payer}
        onClick={() => void review()}
        className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-bg1 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {payer ? "Review transaction" : "Connect a wallet to bake"}
      </button>
    </section>
  );
}
