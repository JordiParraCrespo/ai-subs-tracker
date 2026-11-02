import { formatAgo, formatResetsIn, formatTokens, severity } from "./format.js";
import type { AccountSnapshot } from "./types.js";

export interface RenderOptions {
  color: boolean;
  now: Date;
  barWidth?: number;
}

const CODES = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
} as const;

export function renderSnapshots(snaps: AccountSnapshot[], opts: RenderOptions): string {
  const c = (code: keyof typeof CODES, s: string) => (opts.color ? `${CODES[code]}${s}${CODES.reset}` : s);
  const sevColor = { low: "green", medium: "yellow", high: "red" } as const;
  const width = opts.barWidth ?? 24;
  const labelWidth = Math.max(12, ...snaps.flatMap((s) => s.limits.map((w) => w.label.length)));
  const lines: string[] = [];

  for (const snap of snaps) {
    const dot = snap.status === "ok" ? c("green", "●") : snap.status === "error" ? c("red", "●") : c("yellow", "●");
    const email = snap.identity.email === snap.label ? undefined : snap.identity.email;
    const meta = [email, snap.identity.plan].filter(Boolean).join(" · ");
    lines.push(`${dot} ${c("bold", snap.label)}${meta ? "  " + c("dim", meta) : ""}`);

    if (snap.message) lines.push(`  ${c(snap.status === "error" ? "red" : "yellow", snap.message)}`);

    for (const w of snap.limits) {
      const pct = w.utilization;
      const filled = pct === null ? 0 : Math.round((Math.min(Math.max(pct, 0), 100) / 100) * width);
      const bar = c(sevColor[severity(pct)], "█".repeat(filled)) + c("dim", "░".repeat(width - filled));
      const pctText = pct === null ? "  –" : `${Math.round(pct)}%`.padStart(4);
      const reset = formatResetsIn(w.resetsAt, opts.now);
      lines.push(`  ${w.label.padEnd(labelWidth)}  ${bar} ${pctText}  ${c("dim", reset)}`);
    }

    if (snap.extraUsage?.enabled) {
      const e = snap.extraUsage;
      const used = e.usedCredits ?? 0;
      lines.push(
        `  ${"Extra usage".padEnd(labelWidth)}  ${used}${e.monthlyLimit !== null ? ` / ${e.monthlyLimit}` : ""} credits`,
      );
    }

    if (snap.local) {
      const l = snap.local;
      lines.push(
        c(
          "dim",
          `  This machine: ${formatTokens(l.session.total)} tokens this session · ` +
            `${formatTokens(l.last7Days.total)} last 7d · last active ${formatAgo(l.lastActivityAt, opts.now)}`,
        ),
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
