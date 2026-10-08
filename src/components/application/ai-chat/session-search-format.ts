/**
 * Duration formatting for the session-search stats line.
 *
 * Kept out of `session-search-palette.tsx` (non-component exports break Fast
 * Refresh) so the component module exports only components.
 */

/** Duration chip for the stats line: sub-10ms keeps one decimal so a
 *  sub-millisecond FTS query does not collapse to "0 ms", whole ms below a
 *  second, seconds with two decimals past that. */
export function formatSearchDuration(elapsedUs: number): string {
  if (!Number.isFinite(elapsedUs) || elapsedUs <= 0) return "0 ms";
  const ms = elapsedUs / 1000;
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}
