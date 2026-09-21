import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEventPayload } from "@/lib/events";
import { useChatStore } from "./store";
import { handleEngineEvents, settledRuns, type EngineEventDeps } from "./store/engine-events";
import { sessionKey } from "./store/persistence";
import { EMPTY_SESSION, runRouting } from "./store/stream";

vi.mock("@/lib/ipc", () => ({
  ipc: { rescanSessions: vi.fn(async () => {}), usageRecord: vi.fn(async () => {}) },
}));
vi.mock("@/lib/events", () => ({
  listenEngineEvents: vi.fn(async () => () => {}),
  listenSessionsChanged: vi.fn(async () => () => {}),
}));

const KEY = sessionKey("claude", "s-1", "/tmp/ws");
let runId: string;
let drainSpy: ReturnType<typeof vi.fn>;

function deps(): EngineEventDeps {
  return {
    set: useChatStore.setState, get: useChatStore.getState,
    drainQueue: drainSpy, markUnseenIfBackground: () => {}, upsertSessionMeta: () => {},
  };
}
const ev = (kind: EngineEventPayload["kind"], seq: number, data: unknown) => ({
  runId, sessionId: "s-1", engine: "claude", seq, kind, data,
});

describe("background turn lifecycle", () => {
  beforeEach(() => {
    runId = `bg-life-${Date.now()}-${Math.random()}`;
    localStorage.clear();
    vi.clearAllMocks();
    drainSpy = vi.fn();
    runRouting.clear();
    settledRuns.clear();
    useChatStore.setState({
      openTabs: [], active: null, unseen: {},
      bySession: { [KEY]: { ...EMPTY_SESSION, streaming: true, turnStartedAt: Date.now(), messages: [{ seq: 1, role: "user", text: "go", ts: null }] } },
      streamingByKey: { [KEY]: true },
    });
  });

  it("keeps the run live after done with background tasks and drains the queue", () => {
    handleEngineEvents([
      ev("delta", 1, "跑起来了"),
      ev("task_started", 2, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
    ], deps());

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.streaming).toBe(false);          // 正文段已收尾
    expect(s.awaitingTasks).toBe(true);       // 但回合未终结
    expect(s.backgroundActive).toBe(true);
    expect(runRouting.get(runId)).toBe(KEY);  // 路由保留：任务帧与通知轮还要回来
    expect(settledRuns.has(runId)).toBe(false);
    expect(drainSpy).toHaveBeenCalledTimes(1); // 输入不锁
  });

  it("reopens a live segment for the completion turn, then settles fully", () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 2, { usage: null, backgroundTasks: 1 }),
      ev("task_notification", 3, { taskId: "w1", status: "completed" }),
      ev("delta", 4, "工作流完成："),
      ev("done", 5, { usage: null, backgroundTasks: 0 }),
    ], deps());

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.awaitingTasks).toBe(false);
    expect(s.streaming).toBe(false);
    expect(s.tasks[0].status).toBe("completed");
    expect(s.settledRunIds).toContain(runId);
    expect(runRouting.has(runId)).toBe(false);
    const last = s.messages[s.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.text).toContain("工作流完成");
  });

  it("settles normally when done carries no background tasks", () => {
    handleEngineEvents([ev("delta", 1, "普通回合"), ev("done", 2, { usage: null })], deps());
    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.awaitingTasks).toBe(false);
    expect(s.settledRunIds).toContain(runId);
    expect(runRouting.has(runId)).toBe(false);
  });

  it("keeps streaming open while tasks run, so late tasks still route", () => {
    handleEngineEvents([
      ev("done", 1, { usage: null, backgroundTasks: 2 }),
    ], deps());
    handleEngineEvents([
      ev("task_progress", 2, { taskId: "w1", description: "阶段: a" }),
    ], deps());
    expect(useChatStore.getState().bySession[KEY]!.tasks[0].progress).toBe("阶段: a");
  });
});
