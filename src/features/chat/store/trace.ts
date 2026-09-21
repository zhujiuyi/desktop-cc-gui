import { ipc } from "@/lib/ipc";

/**
 * TEMPORARY diagnostics (2026-09-22) for the "reply never shows" report: the
 * engine-event dispatcher records every gate decision here, the Rust side
 * appends the lines to %TEMP%\ccgui-trace-<pid>.jsonl — but only when the app
 * was started with CCGUI_TRACE=1. Without that env var nothing leaves the
 * webview (the enable probe returns false), so a shipped build is unaffected
 * beyond one extra invoke at startup. Remove this module — and the
 * `trace(...)` call sites — once the bug is closed.
 */

let enabled = false;
const buf: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const deltas = new Map<string, { n: number; chars: number; first: number; last: number }>();

void Promise.resolve(ipc.traceFrontendEnabled?.())
  .then((on) => {
    enabled = on === true;
  })
  .catch(() => {});

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushUiTrace();
  }, 500);
}

/** Record one decision line. No-op unless tracing is enabled. */
export function trace(line: string) {
  if (!enabled) return;
  buf.push(`${Date.now()} ${line}`);
  if (buf.length > 4000) buf.splice(0, buf.length - 4000);
  schedule();
}

/** Aggregate delta/thinking traffic per run into one summary line per flush —
 *  the interesting questions are "did the run stream at all" and "how much",
 *  not the text itself. */
export function traceDelta(runId: string, chars: number) {
  if (!enabled) return;
  const d = deltas.get(runId);
  if (d) {
    d.n += 1;
    d.chars += chars;
    d.last = Date.now();
  } else {
    const now = Date.now();
    deltas.set(runId, { n: 1, chars, first: now, last: now });
  }
  schedule();
}

export function flushUiTrace() {
  if (!enabled) return;
  const now = Date.now();
  for (const [runId, d] of deltas) {
    buf.push(
      `${now} delta run=${runId} n=${d.n} chars=${d.chars} first=${d.first} last=${d.last}`,
    );
  }
  deltas.clear();
  if (!buf.length) return;
  const batch = buf.splice(0, buf.length);
  void Promise.resolve(ipc.traceFrontend?.(batch)).catch(() => {});
}
