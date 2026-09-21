import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEventPayload } from "@/lib/events";
import { ipc } from "@/lib/ipc";
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
  ipc: {
    rescanSessions: vi.fn(async () => {}),
    usageRecord: vi.fn(async () => {}),
    // Only the interrupt path reaches these two.
    interruptSession: vi.fn(async () => true),
    loadSessionPage: vi.fn(async () => ({ messages: [], nextBefore: null })),
  },
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

  // The CLI can close a content-free turn of its own: the resume-time
  // reconciliation notification it queues ahead of the message the user just
  // sent, reported as `runContinues`. Taking that done as terminal settles
  // the run and the settled gate then drops the real turn's frames — observed
  // live on 2026-09-22, when the reply to a mid-background message never
  // reached the UI.
  it("keeps a run open when its done closed a content-free turn", () => {
    const queued = `${runId}-queued`;
    runRouting.set(queued, KEY);
    const evq = (seq: number, kind: EngineEventPayload["kind"], data: unknown) => ({
      runId: queued, sessionId: "s-1", engine: "claude", seq, kind, data,
    });
    handleEngineEvents([
      evq(1, "model", "m"),
      evq(2, "done", { usage: null, backgroundTasks: 0, runContinues: true }),
    ], deps());
    expect(settledRuns.has(queued)).toBe(false);
    expect(runRouting.get(queued)).toBe(KEY);

    handleEngineEvents([
      evq(3, "delta", "答案在这里"),
      evq(4, "done", { usage: null, backgroundTasks: 0 }),
    ], deps());
    flushPendingStreams(useChatStore.setState);
    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.messages.some((m) => m.role === "assistant" && m.text.includes("答案在这里"))).toBe(true);
    expect(settledRuns.has(queued)).toBe(true);
    expect(runRouting.get(queued)).toBeUndefined();
  });

  it("still settles a done that carried content", () => {
    handleEngineEvents([
      ev("delta", 1, "答"),
      ev("done", 2, { usage: null, backgroundTasks: 0 }),
    ], deps());
    expect(settledRuns.has(runId)).toBe(true);
    expect(runRouting.get(runId)).toBeUndefined();
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

  it("stopping a session settles its running tasks as stopped", async () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 2, { usage: null, backgroundTasks: 1 }),
    ], deps());
    expect(runRouting.get(runId)).toBe(KEY);
    useChatStore.setState({
      active: { engine: "claude", sessionId: "s-1", workspacePath: "/tmp/ws" },
    });

    await useChatStore.getState().interrupt();

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.interrupted).toBe(true);
    expect(s.streaming).toBe(false);
    // The turn is no longer waiting on anything, and the tail indicator must
    // stop claiming a task is running.
    expect(s.awaitingTasks).toBe(false);
    expect(s.backgroundActive).toBe(false);
    // The user asked for the stop, so this is 已停止 — not the 已中断 the store
    // reserves for a run that died without a terminal notification.
    expect(s.tasks[0].status).toBe("stopped");
  });

  it("a stop leaves tasks that already settled alone", async () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("task_notification", 2, { taskId: "w1", status: "failed" }),
      ev("done", 3, { usage: null, backgroundTasks: 1 }),
    ], deps());
    useChatStore.setState({
      active: { engine: "claude", sessionId: "s-1", workspacePath: "/tmp/ws" },
    });

    await useChatStore.getState().interrupt();

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.awaitingTasks).toBe(false);
    // A reported outcome is not rewritten by the stop that follows it.
    expect(s.tasks[0].status).toBe("failed");
  });

  it("drops the task frames a killed run emits while the stop IPC is in flight", async () => {
    handleEngineEvents([
      ev("task_started", 1, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("done", 2, { usage: null, backgroundTasks: 1 }),
    ], deps());
    useChatStore.setState({
      active: { engine: "claude", sessionId: "s-1", workspacePath: "/tmp/ws" },
    });
    // The kill IPC has not returned yet. The dying process is exactly what
    // emits its last task frames in this window, when the run is still routed
    // and no done has ever marked it settled.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(ipc.interruptSession).mockImplementationOnce(async () => {
      await gate;
      return true;
    });

    const stopping = useChatStore.getState().interrupt();
    handleEngineEvents([
      ev("task_progress", 3, { taskId: "w1", description: "阶段" }),
      ev("task_notification", 4, { taskId: "w1", status: "completed" }),
      ev("task_started", 5, { taskId: "w1", taskType: "local_workflow", description: "wf" }),
      ev("delta", 6, "还在说话"),
    ], deps());

    const mid = useChatStore.getState().bySession[KEY]!;
    expect(mid.streaming).toBe(false);
    expect(mid.turnStartedAt).toBeNull();
    expect(mid.tasks[0].status).toBe("stopped");
    expect(mid.backgroundActive).toBe(false);
    expect(useChatStore.getState().streamingByKey[KEY]).not.toBe(true);

    release();
    await stopping;
  });

  it("a stop during a plain streaming turn leaves the task state untouched", async () => {
    useChatStore.setState({
      active: { engine: "claude", sessionId: "s-1", workspacePath: "/tmp/ws" },
    });

    await useChatStore.getState().interrupt();

    const s = useChatStore.getState().bySession[KEY]!;
    expect(s.streaming).toBe(false);
    expect(s.interrupted).toBe(true);
    expect(s.tasks).toHaveLength(0);
    expect(s.awaitingTasks).toBe(false);
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
