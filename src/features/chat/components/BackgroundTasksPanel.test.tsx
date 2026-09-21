import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { sessionKey, useChatStore } from "../store";
import { EMPTY_SESSION, type BackgroundTask } from "../store/stream";
import { BackgroundTasksLine, BackgroundTasksPanel } from "./BackgroundTasksPanel";

// React's act() environment flag — same boundary as RunStatusStrip.test.tsx.
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const WS = "/ws";
const KEY = sessionKey("claude", "s-1", WS);

const task = (over: Partial<BackgroundTask>): BackgroundTask => ({
  id: "t", runId: "r1", taskType: "local_agent", description: "d",
  status: "running", startedAt: 1, updatedAt: 1, ...over,
});

/** Running run ("old" by clock) plus a completed later run: the panel must
 *  still float the running group above the newer settled one. */
const TASKS: BackgroundTask[] = [
  task({ id: "w", runId: "old", taskType: "local_workflow", workflowName: "ccgui-full-parse", startedAt: 1 }),
  task({
    id: "a", runId: "new", status: "completed", subagentType: "general-purpose",
    description: "读文档", startedAt: 2, progress: "Running Wait 590 seconds",
  }),
];

function seed(tasks: BackgroundTask[], active = true) {
  useChatStore.setState({
    active: active ? { engine: "claude", sessionId: "s-1", workspacePath: WS } : null,
    bySession: { [KEY]: { ...EMPTY_SESSION, tasks } },
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("zh");
  seed([]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function renderPanel() {
  await act(async () => {
    root.render(<BackgroundTasksPanel workspacePath={WS} />);
  });
}

describe("BackgroundTasksPanel", () => {
  it("renders tasks grouped by run with status badges", async () => {
    seed(TASKS);
    await renderPanel();
    const text = container.textContent ?? "";
    // Group header carries the turn time, one per run.
    expect(text).toContain("回合");
    expect(text.match(/回合/g)).toHaveLength(2);
    // Labels fall back through workflowName → subagentType → description.
    expect(text).toContain("ccgui-full-parse");
    expect(text).toContain("general-purpose");
    // One badge per task, keyed off its status.
    expect(text).toContain("运行中");
    expect(text).toContain("已完成");
    // Live activity line renders under the row.
    expect(text).toContain("Running Wait 590 seconds");
    // The running run floats above the newer settled one.
    expect(text.indexOf("ccgui-full-parse")).toBeLessThan(text.indexOf("general-purpose"));
  });

  it("shows the empty state when the session has no tasks", async () => {
    await renderPanel();
    expect(container.textContent).toContain("暂无后台任务");
  });

  it("falls back to the empty state when no session is active", async () => {
    seed(TASKS, false);
    await renderPanel();
    expect(container.textContent).toContain("暂无后台任务");
  });

  it("BackgroundTasksLine names the running task count", async () => {
    await act(async () => {
      root.render(<BackgroundTasksLine count={2} />);
    });
    expect(container.textContent).toContain("后台任务运行中 · 2 个");
  });
});
