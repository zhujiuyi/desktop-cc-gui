import type { AgentTaskStep } from "./components/agent-task-steps";
import type { BackgroundTask } from "./store/stream";

/** The task's display label: the engine's own name for it first (workflow,
 *  subagent type, description), then its bare type. `translateType` localizes
 *  that type fallback (`chat.tasks.type.*`); without it the raw type name
 *  shows. Shared by the tasks panel and the run-status pill so both name the
 *  same task the same way. */
export function taskLabel(
  task: BackgroundTask,
  translateType: (taskType: string) => string = (taskType) => taskType,
): string {
  if (task.workflowName || task.subagentType || task.description) {
    return task.workflowName || task.subagentType || task.description;
  }
  return translateType(task.taskType);
}

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

/** Running tasks that count for a TURN (the tail indicator's count). Ambient
 *  (session-scoped) tasks never do: they outlive every turn, so counting one
 *  would keep the session reading as "background running" forever. The Rust
 *  side draws the same line (`pending_tasks` drops ambient frames). The panel
 *  lists ambient rows as usual. */
export function runningTaskCount(tasks: BackgroundTask[]): number {
  return tasks.filter((t) => t.status === "running" && !t.ambient).length;
}

/** Real task data → the run-status strip's subagent steps (claude engine).
 *
 *  Turn-level surface, so the same two rules as the tail indicator:
 *  - ambient tasks never show (session housekeeping, not this turn's work);
 *  - with a live run (`currentRunId`), only that run's tasks do — plus
 *    anything still running, which the reader is owed while it works. A
 *    session without a claimed run keeps the whole non-ambient table, so the
 *    pill's counts still freeze over a completed turn (see RunStatusStrip). */
export function stepsFromTasks(
  tasks: BackgroundTask[],
  currentRunId: string | null,
  translateType?: (taskType: string) => string,
): AgentTaskStep[] {
  return tasks
    .filter(
      (t) =>
        !t.ambient &&
        (currentRunId === null || t.runId === currentRunId || t.status === "running"),
    )
    .map((t) => ({
      key: t.id,
      label: taskLabel(t, translateType),
      state: t.status === "running" ? "active" : t.status === "failed" ? "failed" : "complete",
    }));
}
