import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEventPayload } from "@/lib/events";
import { useChatStore } from "./store";
import {
  handleEngineEvents,
  settledRuns,
  settleOrphanedRuns,
  type EngineEventDeps,
} from "./store/engine-events";
import { sessionKey } from "./store/persistence";
import { EMPTY_SESSION, flushPendingStreams, runRouting } from "./store/stream";

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
      ev("delta", 1, "正文段"),
      ev("task_started", 2, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
      ev("task_notification", 4, { taskId: "w1", status: "completed" }),
      ev("delta", 5, "工作流完成："),
    ], deps());

    // The completion turn's text is a fresh live assistant row, not an append
    // to the reply row settled by the background-phase done above it.
    flushPendingStreams(useChatStore.setState);
    const mid = useChatStore.getState().bySession[KEY]!;
    expect(mid.streaming).toBe(true);
    expect(mid.messages).toHaveLength(3); // user + 正文段 + 通知轮新段
    const newRow = mid.messages[mid.messages.length - 1];
    expect(newRow.role).toBe("assistant");
    expect(newRow.live).toBe(true);
    expect(newRow.text).toBe("工作流完成：");
    expect(mid.messages[mid.messages.length - 2].text).toBe("正文段");

    handleEngineEvents([ev("done", 6, { usage: null, backgroundTasks: 0 })], deps());

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

  it("a task frame does not reopen the completion turn; the delta after it does", () => {
    const bodyStartedAt = Date.now() - 60_000;
    useChatStore.setState((s) => ({
      bySession: {
        ...s.bySession,
        [KEY]: { ...s.bySession[KEY]!, turnStartedAt: bodyStartedAt },
      },
    }));
    handleEngineEvents([
      ev("delta", 1, "跑起来了"),
      ev("task_started", 2, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
    ], deps());
    const afterDone = useChatStore.getState().bySession[KEY]!;
    expect(afterDone.awaitingTasks).toBe(true);
    expect(afterDone.streaming).toBe(false);
    expect(afterDone.turnStartedAt).toBeNull();

    // A task frame is not the completion turn: it must leave the background
    // phase alone (still waiting, not streaming, no fresh segment clock) while
    // still updating the task row itself.
    handleEngineEvents([
      ev("task_progress", 4, { taskId: "w1", description: "阶段: b" }),
    ], deps());
    const during = useChatStore.getState().bySession[KEY]!;
    expect(during.awaitingTasks).toBe(true);
    expect(during.streaming).toBe(false);
    expect(during.turnStartedAt).toBeNull();
    expect(during.tasks[0].progress).toBe("阶段: b");
    // Not streaming means the composer keeps sending: nothing was queued.
    expect(useChatStore.getState().streamingByKey[KEY]).not.toBe(true);

    // The completion turn's own first delta is what reopens the segment.
    handleEngineEvents([ev("delta", 5, "工作流完成：")], deps());
    const reopened = useChatStore.getState().bySession[KEY]!;
    expect(reopened.awaitingTasks).toBe(false);
    expect(reopened.streaming).toBe(true);
    expect(reopened.turnStartedAt).toBeGreaterThan(bodyStartedAt);
    expect(useChatStore.getState().streamingByKey[KEY]).toBe(true);
  });

  it("a killed run's lingering tasks settle when the final done arrives", () => {
    handleEngineEvents([
      ev("delta", 1, "跑起来了"),
      ev("task_started", 2, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
      // The process was killed mid-task: no notification ever comes, only the
      // synthesized terminal done.
      ev("done", 4, { usage: null, backgroundTasks: 0 }),
    ], deps());

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.tasks[0].status).toBe("interrupted");
    expect(s.awaitingTasks).toBe(false);
    expect(s.backgroundActive).toBe(false);
  });

  it("error during the background phase clears awaiting tasks", () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 2, { usage: null, backgroundTasks: 1 }),
      ev("error", 3, "boom"),
    ], deps());

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.awaitingTasks).toBe(false);
    expect(s.tasks[0].status).toBe("interrupted");
    expect(s.backgroundActive).toBe(false);
  });

  it("clears awaiting tasks when the orphan sweep reaps the run", () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("task_notification", 2, { taskId: "w1", status: "completed" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
    ], deps());
    expect(useChatStore.getState().bySession[KEY]!.awaitingTasks).toBe(true);

    settleOrphanedRuns(useChatStore.setState, [[runId, KEY]]);

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.awaitingTasks).toBe(false);
    expect(s.streaming).toBe(false);
  });
});
