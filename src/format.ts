/** Formatting helpers shared by the terminal renderer (the dashboard has its own copies in-browser). */

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  const units = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ] as const;
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}${suffix}`;
    }
  }
  return String(n);
}

/** Compact duration: "3d 4h", "2h 14m", "9m", "<1m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.abs(ms) / 60_000);
  if (totalMin < 1) return "<1m";
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function formatResetsIn(resetsAt: string | null, now: Date): string {
  if (!resetsAt) return "";
  const ms = new Date(resetsAt).getTime() - now.getTime();
  return ms <= 0 ? "resetting now" : `resets in ${formatDuration(ms)}`;
}

export function formatAgo(iso: string | null, now: Date): string {
  if (!iso) return "never";
  return `${formatDuration(now.getTime() - new Date(iso).getTime())} ago`;
}

export type Severity = "low" | "medium" | "high";

export function severity(utilization: number | null): Severity {
  if (utilization === null || utilization < 50) return "low";
  return utilization < 80 ? "medium" : "high";
}
