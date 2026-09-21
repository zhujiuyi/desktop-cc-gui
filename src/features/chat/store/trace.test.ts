import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ traceFrontend: vi.fn(async (_lines: string[]) => {}) }));
vi.mock("@/lib/ipc", () => ({
  ipc: { traceFrontendEnabled: vi.fn(async () => true), traceFrontend: h.traceFrontend },
}));

import { trace, traceDelta } from "./trace";

describe("ui trace channel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.traceFrontend.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches decision lines and per-run delta summaries through ipc", async () => {
    // Let the module's enable probe (a resolved promise) settle.
    await Promise.resolve();
    await Promise.resolve();
    trace("ev message run=r1 act=routed streaming=true owner=r1");
    traceDelta("r1", 12);
    traceDelta("r1", 8);
    await vi.advanceTimersByTimeAsync(600);
    expect(h.traceFrontend).toHaveBeenCalledTimes(1);
    const lines = h.traceFrontend.mock.calls[0]![0];
    expect(lines.some((l) => l.includes("act=routed"))).toBe(true);
    expect(lines.some((l) => l.includes("delta run=r1 n=2 chars=20"))).toBe(true);
  });
});
