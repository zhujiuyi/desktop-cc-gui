import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEventPayload } from "@/lib/events";
import { useChatStore } from "./store";
import {
  handleEngineEvents,
  settledRuns,
  type EngineEventDeps,
} from "./store/engine-events";
import { sessionKey } from "./store/persistence";
import { EMPTY_SESSION, flushPendingStreams, runRouting } from "./store/stream";

vi.mock("@/lib/ipc", () => ({
  ipc: {
    rescanSessions: vi.fn(async () => {}),
    usageRecord: vi.fn(async () => {}),
    // The echo-back backend: the run id the client asked for is the run id it
    // reports (the real Rust command does the same).
    sendMessage: vi.fn(async (args: { runId: string }) => ({
      runId: args.runId,
      sessionId: "s-1",
    })),
    interruptSession: vi.fn(async () => true),
    rememberSessionModel: vi.fn(async () => {}),
    rememberSessionEffort: vi.fn(async () => {}),
    rememberSessionProvider: vi.fn(async () => {}),
    loadSessionPage: vi.fn(async () => ({ messages: [], nextBefore: null })),
  },
}));
vi.mock("@/lib/events", () => ({
  listenEngineEvents: vi.fn(async () => () => {}),
  listenSessionsChanged: vi.fn(async () => () => {}),
}));

const WS = "/tmp/ws";
const KEY = sessionKey("claude", "s-1", WS);
const TAB = { engine: "claude", sessionId: "s-1", workspacePath: WS };
const RUN_A = "run-a";
const RUN_B = "run-b";

let drainSpy: ReturnType<typeof vi.fn>;

function deps(): EngineEventDeps {
  return {
    set: useChatStore.setState,
    get: useChatStore.getState,
    drainQueue: drainSpy,
    markUnseenIfBackground: () => {},
    upsertSessionMeta: () => {},
    refreshSessionUsage: vi.fn(async () => {}),
  };
}

const ev = (runId: string, kind: EngineEventPayload["kind"], seq: number, data: unknown) => ({
  runId, sessionId: "s-1", engine: "claude", seq, kind, data,
});

const session = () => useChatStore.getState().bySession[KEY]!;
const assistantTexts = () =>
  session().messages.filter((m) => m.role === "assistant").map((m) => m.text);

/** Run A's reply settles with background work still running. */
function settleRunAOnBackground() {
  handleEngineEvents([
    ev(RUN_A, "delta", 1, "正文段"),
    ev(RUN_A, "task_started", 2, {
      taskId: "w1", taskType: "local_workflow", description: "wf",
    }),
    ev(RUN_A, "done", 3, { usage: null, backgroundTasks: 1 }),
  ], deps());
}

describe("same-session dual run", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    drainSpy = vi.fn();
    runRouting.clear();
    settledRuns.clear();
    useChatStore.setState({
      active: TAB,
      openTabs: [TAB],
      models: { claude: "claude-sonnet-4" },
      unseen: {},
      bySession: {
        [KEY]: {
          ...EMPTY_SESSION,
          streaming: true,
          turnStartedAt: Date.now(),
          messages: [{ seq: 1, role: "user", text: "跑一下", ts: null }],
        },
      },
      streamingByKey: { [KEY]: true },
    });
  });

  it("keeps a newer run's live turn out of the old run's settle", () => {
    settleRunAOnBackground();
    const afterA = session();
    expect(afterA.awaitingTasks).toBe(true);
    expect(afterA.streaming).toBe(false);
    expect(drainSpy).toHaveBeenCalledTimes(1); // A 的后台段不锁输入
    drainSpy.mockClear();

    // 用户随即给同一会话发 B（新 run）：B 的第一帧认领会话。
    handleEngineEvents([ev(RUN_B, "delta", 1, "B 正文")], deps());
    const bStartedAt = session().turnStartedAt;
    flushPendingStreams(useChatStore.setState);
    expect(session().streaming).toBe(true);
    expect(session().currentRunId).toBe(RUN_B);
    expect(session().turnStartedAt).toBe(bStartedAt);

    // B 流式期间用户排队一条消息：它属于 B 的下一回合。
    useChatStore.setState((s) => ({
      bySession: {
        ...s.bySession,
        [KEY]: {
          ...s.bySession[KEY]!,
          queue: [{ id: "q-1", text: "下一句", images: [], queuedAt: 0 }],
        },
      },
    }));

    // A 的通知轮内容在 B 流式期间到达：不得并入 B 的 live 行（降级口径）。
    handleEngineEvents([ev(RUN_A, "delta", 4, "工作流完成：")], deps());
    flushPendingStreams(useChatStore.setState);
    expect(assistantTexts()).toEqual(["正文段", "B 正文"]);

    // A 的 run 级终局 done：只结算 A 自己的任务与路由。
    handleEngineEvents([ev(RUN_A, "done", 5, { usage: null, backgroundTasks: 0 })], deps());

    const s = session();
    expect(s.streaming).toBe(true);                    // B 仍在流
    expect(s.currentRunId).toBe(RUN_B);
    expect(s.turnStartedAt).toBe(bStartedAt);          // A 不得清掉 B 的计时
    expect(s.messages[s.messages.length - 1].live).toBe(true); // B 的 live 行未被结算
    expect(s.queue).toHaveLength(1);                   // 队列仍在
    expect(drainSpy).not.toHaveBeenCalled();           // A 的 done 不得 drain B 的队列
    expect(s.tasks.find((t) => t.id === "w1")!.status).toBe("interrupted");
    expect(runRouting.has(RUN_A)).toBe(false);
    expect(settledRuns.get(RUN_A)).toBe("done");
  });

  it("claims the session for a locally sent run", async () => {
    settleRunAOnBackground();
    drainSpy.mockClear();

    await useChatStore.getState().send("B 提问", []);
    const claimed = session().currentRunId;
    expect(claimed).toBeTruthy();
    expect(session().streaming).toBe(true);

    // A 的通知轮照旧在 B 流式期间到达，但会话已归 B。
    handleEngineEvents([
      ev(RUN_A, "delta", 4, "工作流完成："),
      ev(RUN_A, "done", 5, { usage: null, backgroundTasks: 0 }),
    ], deps());
    flushPendingStreams(useChatStore.setState);
    const s = session();
    expect(s.currentRunId).toBe(claimed);
    expect(s.streaming).toBe(true);
    expect(s.turnStartedAt).not.toBeNull();
    expect(drainSpy).not.toHaveBeenCalled();
    // B 自己的 done 才是这个会话的回合终点。
    handleEngineEvents([ev(claimed!, "done", 6, { usage: null, backgroundTasks: 0 })], deps());
    expect(session().streaming).toBe(false);
    expect(session().currentRunId).toBeNull();
  });

  it("lets a run take over a session whose claim was already settled", () => {
    // 会话处于 idle（无认领）：任何 run 都能成为它的回合主人。
    handleEngineEvents([ev(RUN_A, "delta", 1, "正文")], deps());
    expect(session().currentRunId).toBe(RUN_A);
    handleEngineEvents([ev(RUN_A, "done", 2, { usage: null })], deps());
    expect(session().streaming).toBe(false);
    expect(session().currentRunId).toBeNull();

    handleEngineEvents([ev(RUN_B, "delta", 1, "下一回合")], deps());
    handleEngineEvents([ev(RUN_B, "done", 2, { usage: null })], deps());
    expect(session().streaming).toBe(false);
    expect(session().currentRunId).toBeNull();
    expect(session().settledRunIds).toEqual(expect.arrayContaining([RUN_A, RUN_B]));
  });
});
