import { useState } from "react";

/**
 * Collapsible viewer for program logs.
 *
 * Logs are on-chain data and therefore untrusted input (PRD §0.9): they are
 * rendered as text inside <pre>, never as markup, and nothing in them is
 * interpreted as an instruction.
 */
export function ProgramLogViewer({
  logs,
  summary,
}: {
  logs: readonly string[];
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (logs.length === 0) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      {summary ? (
        <p data-testid="log-summary" className="text-sm text-muted">
          {summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-lg border border-border-low bg-card px-2 py-1 text-xs font-medium cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
        >
          {open ? "Hide logs" : "View logs"}
        </button>
        {open ? (
          <button
            onClick={copy}
            className="rounded-lg border border-border-low bg-card px-2 py-1 text-xs font-medium cursor-pointer transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>

      {open ? (
        <pre
          data-testid="program-logs"
          className="max-h-64 overflow-auto rounded-lg border border-border-low bg-cream p-3 font-mono text-xs whitespace-pre-wrap break-all"
        >
          {logs.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}
