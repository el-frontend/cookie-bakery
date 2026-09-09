import { isAddress } from "@solana/kit";

/**
 * CSV parsing for the airdrop list (RF-03.1).
 *
 * Parsing only — nothing here decides whether an address or an amount is
 * valid. Splitting the two means a malformed file fails once, loudly, while a
 * well-formed file with bad data reaches the per-row error table the user can
 * actually act on.
 */

/** v1 cap from the PRD. Beyond this the batching UI stops being usable. */
export const MAX_ROWS = 1000;

export type CsvRow = {
  /** 1-based line number IN THE ORIGINAL TEXT, so errors point where the user looks. */
  line: number;
  rawAddress: string;
  rawAmount: string;
};

export type ParsedCsv = {
  hasHeader: boolean;
  rows: CsvRow[];
  separator: "," | ";";
};

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/**
 * Pick the separator by counting candidates in the first non-empty line.
 * Guessing from the whole file would let one stray semicolon in an error
 * message flip the parse.
 */
function detectSeparator(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  if (commas === 0 && semis === 0) {
    throw new CsvError(
      "Each line needs an address and an amount separated by , or ;"
    );
  }
  return semis > commas ? ";" : ",";
}

/**
 * A header is DETECTED, not assumed, and only when BOTH fields disagree with
 * being data: field 0 is not a base58 address AND field 1 is not a number.
 *
 * Either signal alone silently eats a real recipient. On the amount alone,
 * `<address>,-5` — a typo'd amount on the first line — is read as a header and
 * that recipient vanishes. On the address alone, the same happens to a line
 * with a typo'd address. Requiring both means a row that is merely WRONG still
 * reaches the validator, which can point at the offending line.
 */
function looksLikeHeader(fields: string[]): boolean {
  const [maybeAddress, maybeAmount] = fields;
  if (maybeAddress === undefined || maybeAmount === undefined) return false;
  const isNumber = /^\d+(\.\d+)?$/.test(
    maybeAmount.trim().replace(/[\s,_]/g, "")
  );
  return !isAddress(maybeAddress.trim()) && !isNumber;
}

export function parseCsv(input: string): ParsedCsv {
  const lines = input.split(/\r?\n/);

  const firstNonEmpty = lines.find((line) => line.trim() !== "");
  if (firstNonEmpty === undefined) {
    throw new CsvError("Paste at least one line of address,amount.");
  }

  const separator = detectSeparator(firstNonEmpty);
  const rows: CsvRow[] = [];
  let hasHeader = false;
  let seenFirst = false;

  for (let index = 0; index < lines.length; index++) {
    const text = lines[index];
    if (text.trim() === "") continue;

    const fields = text.split(separator).map((field) => field.trim());

    if (!seenFirst) {
      seenFirst = true;
      if (looksLikeHeader(fields)) {
        hasHeader = true;
        continue;
      }
    }

    if (rows.length >= MAX_ROWS) {
      throw new CsvError(
        `This list has more than ${MAX_ROWS} recipients. Split it into several airdrops.`
      );
    }

    rows.push({
      line: index + 1,
      rawAddress: fields[0] ?? "",
      rawAmount: fields[1] ?? "",
    });
  }

  if (rows.length === 0) {
    throw new CsvError("That file has a header but no recipients.");
  }

  return { hasHeader, rows, separator };
}
