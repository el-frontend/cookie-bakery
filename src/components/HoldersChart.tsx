import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { formatTokenAmount } from "../lib/format/tokenAmount";
import type { DistributionSlice } from "../lib/token/distribution";

/**
 * Distribution of the supply across the top holders (RF-04.5, AC-04.4).
 *
 * ## Why a ranked bar and not a pie
 *
 * The question this chart exists to answer is "how concentrated is this
 * token?" — is one wallet sitting on 90% of it? Length answers that; angle
 * does not. Eleven slices of a pie are eleven angular comparisons, and the
 * small ones become unreadable slivers exactly when the concentration story
 * matters most. Ranked horizontal bars put the answer in the first row and
 * make the drop-off legible down the list.
 *
 * ## Why two colours and not eleven
 *
 * Every bar measures the same thing — share of supply — so colour carries no
 * information and one hue is correct; the length is the encoding. The only
 * genuine category break is "Others", which is an AGGREGATE rather than a
 * holder, so it takes the recessive warm grey. Cycling eleven hues would imply
 * eleven identities that do not exist.
 *
 * The pair was checked with the palette validator against this surface: CVD
 * separation ΔE 16.4 (protan) and 19.2 for normal vision, both comfortably
 * above the thresholds, contrast ≥ 3:1. Percentages are direct-labelled and
 * the same numbers appear in the adjacent holders table, so identity never
 * rests on colour alone.
 */

type ChartRow = {
  isOthers: boolean;
  key: string;
  label: string;
  /** Recharts needs a number; the exact bigint lives in `raw`. */
  percent: number;
  raw: DistributionSlice;
};

function Legendless({
  slice,
  decimals,
  symbol,
}: {
  decimals: number;
  slice: DistributionSlice;
  symbol: string;
}) {
  return (
    <div className="rounded-md border border-border-strong bg-card px-3 py-2 shadow-lg">
      <p className="font-mono text-[11.5px] text-ink-2">
        {slice.isOthers ? "Everyone else" : slice.key}
      </p>
      <p className="mt-1 font-mono text-[13px] font-semibold num">
        {formatTokenAmount(slice.amount, decimals)}
        {symbol ? <span className="ml-1 text-ink-3">{symbol}</span> : null}
      </p>
      <p className="font-mono text-[11.5px] text-accent num">
        {slice.percent.toFixed(2)}% of supply
      </p>
    </div>
  );
}

export function HoldersChart({
  decimals,
  slices,
  symbol,
}: {
  decimals: number;
  slices: readonly DistributionSlice[];
  symbol: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (slices.length === 0) return null;

  const rows: ChartRow[] = slices.map((slice) => ({
    isOthers: slice.isOthers,
    key: slice.key,
    label: slice.label,
    percent: slice.percent,
    raw: slice,
  }));

  // 30px a row keeps the bars thin and the labels clear of each other; a fixed
  // container height would squash an 11-row chart or strand a 3-row one.
  const height = Math.max(140, rows.length * 30 + 24);

  return (
    <div
      className="rounded-xl border border-border-low bg-card p-5"
      data-testid="holders-chart"
    >
      <div className="mb-3 flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          Supply distribution
        </h3>
        <p className="text-[12.5px] text-ink-3">
          Top {slices.filter((s) => !s.isOthers).length} holders
          {slices.some((s) => s.isOthers) ? " and everyone else" : ""}, by share
          of supply.
        </p>
      </div>

      {/*
       * The chart is decorative in the accessibility tree: every number in it
       * is also a row in the holders table below, which is the text
       * alternative. Duplicating it as a long aria-label would make a screen
       * reader read eleven percentages twice.
       */}
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer height="100%" width="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ bottom: 4, left: 4, right: 44, top: 4 }}
          >
            <XAxis domain={[0, 100]} hide type="number" />
            <YAxis
              axisLine={false}
              dataKey="label"
              tick={{ fill: "var(--ink-3)", fontSize: 11 }}
              tickLine={false}
              type="category"
              width={78}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as ChartRow;
                return (
                  <Legendless
                    decimals={decimals}
                    slice={row.raw}
                    symbol={symbol}
                  />
                );
              }}
              cursor={{ fill: "var(--raised)" }}
            />
            <Bar
              barSize={12}
              dataKey="percent"
              isAnimationActive={!reducedMotion}
              label={{
                fill: "var(--ink-2)",
                fontSize: 11,
                formatter: (value: unknown) =>
                  typeof value === "number" ? `${value.toFixed(1)}%` : "",
                position: "right",
              }}
              radius={[0, 4, 4, 0]}
            >
              {rows.map((row) => (
                <Cell
                  fill={row.isOthers ? "var(--ink-3)" : "var(--accent)"}
                  key={row.key}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
