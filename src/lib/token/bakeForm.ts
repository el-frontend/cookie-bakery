/** Limits come straight from RF-02's statement. */
export const LIMITS = {
  DECIMALS_MAX: 9,
  DECIMALS_MIN: 0,
  NAME_MAX: 32,
  SYMBOL_MAX: 10,
} as const;

export type BakeFormValues = {
  decimals: number;
  /** Kept locally only; never written on-chain. */
  description?: string;
  metadataUri?: string;
  name: string;
  supply: string;
  symbol: string;
};

export type FieldErrors = Partial<Record<keyof BakeFormValues, string>>;

export const DEFAULT_BAKE_FORM: BakeFormValues = {
  decimals: 6,
  description: "",
  metadataUri: "",
  name: "",
  supply: "1000000",
  symbol: "",
};

/**
 * Converts a decimal supply string into base units without floating point.
 *
 * `Number` loses precision above 2^53, and a supply of 1e9 with 9 decimals is
 * 1e18 base units — far past that. Parsing the string digit-wise keeps it exact.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new RangeError(`"${amount}" is not a positive decimal number`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new RangeError(
      `${amount} has ${fraction.length} decimal places but the mint allows ${decimals}`
    );
  }
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole + padded);
}

export function validateBakeForm(values: BakeFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length > LIMITS.NAME_MAX) {
    errors.name = `Name must be ${LIMITS.NAME_MAX} characters or fewer (currently ${name.length}).`;
  }

  const symbol = values.symbol.trim();
  if (!symbol) {
    errors.symbol = "Symbol is required.";
  } else if (symbol.length > LIMITS.SYMBOL_MAX) {
    errors.symbol = `Symbol must be ${LIMITS.SYMBOL_MAX} characters or fewer (currently ${symbol.length}).`;
  }

  if (!Number.isInteger(values.decimals)) {
    errors.decimals = "Decimals must be a whole number.";
  } else if (
    values.decimals < LIMITS.DECIMALS_MIN ||
    values.decimals > LIMITS.DECIMALS_MAX
  ) {
    errors.decimals = `Decimals must be between ${LIMITS.DECIMALS_MIN} and ${LIMITS.DECIMALS_MAX}.`;
  }

  if (errors.decimals == null) {
    try {
      const base = toBaseUnits(values.supply, values.decimals);
      if (base <= 0n) errors.supply = "Initial supply must be greater than 0.";
    } catch (error) {
      errors.supply =
        error instanceof RangeError ? error.message : "Invalid supply.";
    }
  }

  const uri = values.metadataUri?.trim();
  if (uri) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(uri);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      errors.metadataUri = "Metadata URI must be a valid URL.";
    } else if (parsed.protocol !== "https:") {
      // http and data: URIs would be fetched by every viewer of this token.
      errors.metadataUri = "Metadata URI must use https.";
    }
  }

  return errors;
}

export function isBakeFormValid(values: BakeFormValues): boolean {
  return Object.keys(validateBakeForm(values)).length === 0;
}
