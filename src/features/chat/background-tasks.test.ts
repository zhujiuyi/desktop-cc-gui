import { describe, expect, it } from "vitest";
import { groupTasksByRun, runningTaskCount, stepsFromTasks } from "./background-tasks";
import type { BackgroundTask } from "./store/stream";

const task = (over: Partial<BackgroundTask>): BackgroundTask => ({
  id: "t", runId: "r1", taskType: "local_agent", description: "d",
  status: "running", startedAt: 1, updatedAt: 1, ...over,
});

describe("background task helpers", () => {
  it("groups by run with running groups first", () => {
    const groups = groupTasksByRun([
      task({ id: "a", runId: "old", status: "completed", startedAt: 1 }),
      task({ id: "b", runId: "new", startedAt: 2 }),
    ]);
    expect(groups.map((g) => g.runId)).toEqual(["new", "old"]);
    expect(groups[0].tasks[0].id).toBe("b");
  });

  it("counts only running tasks", () => {
    expect(runningTaskCount([task({}), task({ id: "x", status: "completed" })])).toBe(1);
  });

  /** Ambient tasks are session-scoped housekeeping: they run for the life of
   *  the session, so counting them would pin the tail indicator on "running"
   *  forever. The panel still lists them. */
  it("keeps ambient tasks out of the running count", () => {
    expect(
      runningTaskCount([
        task({ id: "t", ambient: true }),
        task({ id: "x", status: "completed" }),
      ]),
    ).toBe(0);
    expect(runningTaskCount([task({ id: "t", ambient: true }), task({ id: "r" })])).toBe(1);
  });

  it("maps tasks onto the subagent pill steps", () => {
    const steps = stepsFromTasks([
      task({ id: "w", taskType: "local_workflow", workflowName: "ccgui-full-parse" }),
      task({ id: "a", status: "completed", subagentType: "general-purpose", description: "读文档" }),
      task({ id: "f", status: "failed", description: "挂了" }),
    ], null);
    expect(steps).toEqual([
      { key: "w", label: "ccgui-full-parse", state: "active" },
      { key: "a", label: "general-purpose", state: "complete" },
      { key: "f", label: "挂了", state: "failed" },
    ]);
  });

  /** The pill is a turn-level surface: ambient housekeeping never belongs to
   *  it, and with a live run only that run's tasks (plus anything still
   *  running) are the turn's story. */
  it("scopes the pill steps to the current run and never to ambient tasks", () => {
    const steps = stepsFromTasks([
      task({ id: "old-done", runId: "old", status: "completed" }),
      task({ id: "old-running", runId: "old" }),
      task({ id: "ambient", runId: "old", ambient: true }),
      task({ id: "now-done", runId: "now", status: "completed" }),
      task({ id: "now-run", runId: "now" }),
    ], "now");
    expect(steps.map((s) => s.key)).toEqual(["old-running", "now-done", "now-run"]);
  });
});
