/**
 * The dashboard is a single self-contained page (no build step, no CDN) so it
 * works offline and can later be dropped straight into a tray-app webview.
 */
export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Subs Tracker</title>
<style>
  :root {
    --bg: #f6f6f4; --card: #ffffff; --text: #1d1d1b; --muted: #6b6b66; --line: #e4e4df;
    --track: #ecece7; --low: #2f9e5b; --medium: #d39a14; --high: #d6453d; --accent: #c96442;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #161614; --card: #1f1f1d; --text: #ecece8; --muted: #9a9a93; --line: #2e2e2b;
      --track: #2c2c29; --low: #4cc27e; --medium: #e7b33c; --high: #f06a61; --accent: #e08260;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header { display: flex; align-items: center; gap: 12px; padding: 20px 24px 8px; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 18px; margin: 0; font-weight: 650; letter-spacing: -0.01em; }
  h1 span { color: var(--accent); }
  .spacer { flex: 1; }
  .updated { color: var(--muted); font-size: 12px; }
  button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line);
    background: var(--card); color: var(--text); cursor: pointer; }
  button:hover { border-color: var(--muted); }
  button:disabled { opacity: .5; cursor: default; }
  main { max-width: 1100px; margin: 0 auto; padding: 8px 24px 40px; }
  .notice { background: var(--card); border: 1px dashed var(--line); border-radius: 10px; padding: 10px 14px;
    color: var(--muted); margin: 8px 0 16px; font-size: 13px; }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--track);
    padding: 1px 5px; border-radius: 4px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
  .card-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 2px; }
  .card-head h2 { font-size: 15px; margin: 0; font-weight: 620; }
  .pill { font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .pill.ok { color: var(--low); border-color: color-mix(in srgb, var(--low) 40%, transparent); }
  .pill.warn { color: var(--medium); border-color: color-mix(in srgb, var(--medium) 40%, transparent); }
  .pill.err { color: var(--high); border-color: color-mix(in srgb, var(--high) 40%, transparent); }
  .meta { color: var(--muted); font-size: 12px; margin-bottom: 12px; min-height: 1em; }
  .msg { font-size: 12.5px; color: var(--muted); background: var(--bg); border-radius: 8px; padding: 8px 10px; margin-bottom: 12px; }
  .limit { margin: 10px 0; }
  .limit-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
  .limit-row b { font-variant-numeric: tabular-nums; font-weight: 600; }
  .track { height: 8px; background: var(--track); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; transition: width .4s ease; }
  .fill.low { background: var(--low); } .fill.medium { background: var(--medium); } .fill.high { background: var(--high); }
  .reset { color: var(--muted); font-size: 11.5px; margin-top: 3px; }
  .local { border-top: 1px solid var(--line); margin-top: 14px; padding-top: 10px; display: grid;
    grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .stat .v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .stat .k { font-size: 11px; color: var(--muted); }
  .empty { color: var(--muted); text-align: center; padding: 60px 0; }
  @media (max-width: 520px) { header, main { padding-left: 16px; padding-right: 16px; } .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>AI Subs <span>Tracker</span></h1>
  <div class="spacer"></div>
  <span class="updated" id="updated"></span>
  <button id="refresh">Refresh</button>
</header>
<main>
  <div id="notice"></div>
  <div class="grid" id="grid"><div class="empty">Loading…</div></div>
</main>
<script>
const $ = (id) => document.getElementById(id);
let data = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmtTokens(n) {
  if (n < 1000) return String(n);
  for (const [size, sfx] of [[1e9, "B"], [1e6, "M"], [1e3, "k"]]) {
    if (n >= size) { const v = n / size; return (v >= 100 ? Math.round(v) : +v.toFixed(1)) + sfx; }
  }
}
function fmtDur(ms) {
  const t = Math.floor(Math.abs(ms) / 60000);
  if (t < 1) return "<1m";
  const d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60;
  if (d) return h ? d + "d " + h + "h" : d + "d";
  if (h) return m ? h + "h " + m + "m" : h + "h";
  return m + "m";
}
const sev = (u) => (u == null || u < 50 ? "low" : u < 80 ? "medium" : "high");
const STATUS = { ok: ["ok", "live"], auth_expired: ["warn", "login expired"], no_credentials: ["warn", "not logged in"], error: ["err", "error"] };

function resetText(iso) {
  if (!iso) return "";
  const ms = new Date(iso) - Date.now();
  const when = new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return ms <= 0 ? "resetting now" : "resets in " + fmtDur(ms) + " · " + when;
}

function card(s) {
  const [cls, label] = STATUS[s.status] || ["err", s.status];
  const meta = [s.identity.email === s.label ? null : s.identity.email, s.identity.organization, s.identity.plan].filter(Boolean).map(esc).join(" · ");
  const limits = s.limits.map((w) => {
    const u = w.utilization;
    const pct = u == null ? "–" : Math.round(u) + "%";
    return '<div class="limit"><div class="limit-row"><span>' + esc(w.label) + "</span><b>" + pct + "</b></div>" +
      '<div class="track"><div class="fill ' + sev(u) + '" style="width:' + Math.min(Math.max(u || 0, 0), 100) + '%"></div></div>' +
      '<div class="reset" data-reset="' + esc(w.resetsAt || "") + '">' + esc(resetText(w.resetsAt)) + "</div></div>";
  }).join("");
  const extra = s.extraUsage && s.extraUsage.enabled
    ? '<div class="reset">Extra usage: ' + (s.extraUsage.usedCredits ?? 0) + (s.extraUsage.monthlyLimit != null ? " / " + s.extraUsage.monthlyLimit : "") + " credits</div>"
    : "";
  const l = s.local;
  const local = l
    ? '<div class="local">' +
      '<div class="stat"><div class="v">' + fmtTokens(l.session.total) + '</div><div class="k">tokens this session</div></div>' +
      '<div class="stat"><div class="v">' + fmtTokens(l.last7Days.total) + '</div><div class="k">tokens last 7 days</div></div>' +
      '<div class="stat"><div class="v">' + (l.lastActivityAt ? fmtDur(Date.now() - new Date(l.lastActivityAt)) : "–") + '</div><div class="k">since last use</div></div>' +
      "</div>"
    : "";
  return '<section class="card"><div class="card-head"><h2>' + esc(s.label) + '</h2><span class="pill ' + cls + '">' + label + "</span></div>" +
    '<div class="meta">' + meta + "</div>" +
    (s.message ? '<div class="msg">' + esc(s.message) + "</div>" : "") +
    limits + extra + local + "</section>";
}

function render() {
  if (!data) return;
  $("notice").innerHTML = data.discovered && data.snapshots.length
    ? '<div class="notice">Showing auto-discovered accounts. Run <code>aisubs discover --save</code> to keep them, then rename them in <code>' + esc(data.configPath) + "</code>.</div>"
    : "";
  $("grid").innerHTML = data.snapshots.length
    ? data.snapshots.map(card).join("")
    : '<div class="empty">No accounts yet. Add one with <code>aisubs accounts add --label Work --config-dir ~/.claude-work</code></div>';
  tick();
}

function tick() {
  if (data) $("updated").textContent = "updated " + fmtDur(Date.now() - new Date(data.generatedAt)) + " ago";
  document.querySelectorAll("[data-reset]").forEach((el) => { el.textContent = resetText(el.dataset.reset); });
}

async function load(force) {
  $("refresh").disabled = true;
  try {
    const res = await fetch("/api/usage" + (force ? "?refresh=1" : ""));
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    data = await res.json();
    render();
  } catch (err) {
    $("notice").innerHTML = '<div class="notice">Could not load usage: ' + esc(err.message) + "</div>";
  } finally {
    $("refresh").disabled = false;
  }
}

$("refresh").onclick = () => load(true);
load(false);
setInterval(() => load(false), 60000);
setInterval(tick, 15000);
</script>
</body>
</html>
`;
