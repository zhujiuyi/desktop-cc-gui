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

  it("maps tasks onto the subagent pill steps", () => {
    const steps = stepsFromTasks([
      task({ id: "w", taskType: "local_workflow", workflowName: "ccgui-full-parse" }),
      task({ id: "a", status: "completed", subagentType: "general-purpose", description: "读文档" }),
      task({ id: "f", status: "failed", description: "挂了" }),
    ]);
    expect(steps).toEqual([
      { key: "w", label: "ccgui-full-parse", state: "active" },
      { key: "a", label: "general-purpose", state: "complete" },
      { key: "f", label: "挂了", state: "failed" },
    ]);
  });
});
