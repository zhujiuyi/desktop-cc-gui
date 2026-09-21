import type { AgentTaskStep } from "./components/agent-task-steps";
import type { BackgroundTask } from "./store/stream";

/** Tasks grouped under their run (turn), running groups first, then newest. */
export function groupTasksByRun(
  tasks: BackgroundTask[],
): { runId: string; startedAt: number; tasks: BackgroundTask[] }[] {
  const groups = new Map<string, { runId: string; startedAt: number; tasks: BackgroundTask[] }>();
  for (const task of tasks) {
    const group = groups.get(task.runId) ?? { runId: task.runId, startedAt: task.startedAt, tasks: [] };
    group.startedAt = Math.min(group.startedAt, task.startedAt);
    group.tasks.push(task);
    groups.set(task.runId, group);
  }
  return [...groups.values()].sort((a, b) => {
    const aRunning = a.tasks.some((t) => t.status === "running") ? 1 : 0;
    const bRunning = b.tasks.some((t) => t.status === "running") ? 1 : 0;
    return bRunning - aRunning || b.startedAt - a.startedAt;
  });
}

export function runningTaskCount(tasks: BackgroundTask[]): number {
  return tasks.filter((t) => t.status === "running").length;
}

/** Real task data → the run-status strip's subagent steps (claude engine). */
export function stepsFromTasks(tasks: BackgroundTask[]): AgentTaskStep[] {
  return tasks.map((t) => ({
    key: t.id,
    label: t.workflowName || t.subagentType || t.description || t.taskType,
    state: t.status === "running" ? "active" : t.status === "failed" ? "failed" : "complete",
  }));
}
