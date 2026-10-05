/**
 * 插件轮次（ctx.sessions.startRun）没有打开的标签页。会话事件必须从轮次的
 * 路由键里取工作区：回落成「当前激活工作区」会让新行先出现在用户正看着的
 * 仓库下（侧栏位置错，点一次同步才归位），并把前台的待发标签页认领成这个
 * 会话。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import type { EngineEventPayload } from "@/lib/events";
import type { ChatStore } from "../store";
import { handleEngineEvents, settledRuns, type EngineEventDeps } from "./engine-events";
import { EMPTY_SESSION, runRouting } from "./stream";

vi.mock("@/lib/ipc", () => ({ ipc: { rescanSessions: vi.fn(async () => {}) } }));

const ENGINE = "claude";
const WORKTREE = "/tmp/app-worktrees/pr-1331-fix";
const REPO = "/tmp/app";
const PENDING_KEY = `new:${ENGINE}:${WORKTREE}`;

function setup() {
  const store = createStore<ChatStore>(() => ({
    bySession: {
      [PENDING_KEY]: {
        ...EMPTY_SESSION,
        streaming: true,
        messages: [{ role: "user", text: "审查 PR #1331", ts: null }],
      },
    },
    streamingByKey: { [PENDING_KEY]: true },
    retryingByKey: {},
    models: {},
    efforts: {},
    // 前台：用户在仓库里开着一个待发的新会话
    openTabs: [{ engine: ENGINE, sessionId: null, workspacePath: REPO }],
    active: { engine: ENGINE, sessionId: null, workspacePath: REPO },
    drafts: {},
    archivedSessionKeys: {},
  }) as unknown as ChatStore);
  const set = vi.fn<EngineEventDeps["set"]>((update) => store.setState(update));
  const upsertSessionMeta = vi.fn();
  const deps: EngineEventDeps = {
    set,
    get: store.getState,
    drainQueue: vi.fn(),
    markUnseenIfBackground: vi.fn(),
    upsertSessionMeta,
  };
  runRouting.set("run-plugin", PENDING_KEY);
  return { store, deps, upsertSessionMeta };
}

function sessionEvent(): EngineEventPayload {
  return {
    kind: "session",
    data: "sess-9",
    engine: ENGINE,
    sessionId: "sess-9",
    runId: "run-plugin",
    seq: 1,
  } as EngineEventPayload;
}

beforeEach(() => {
  runRouting.clear();
  settledRuns.clear();
});

describe("plugin run session announce", () => {
  it("keeps the routed workspace instead of the foreground one", () => {
    const { store, deps, upsertSessionMeta } = setup();

    handleEngineEvents([sessionEvent()], deps);

    const meta = upsertSessionMeta.mock.calls[0]?.[0];
    expect(meta).toBeTruthy();
    expect(meta.workspacePath).toBe(WORKTREE);
    expect(meta.sessionId).toBe("sess-9");
    // 轮次状态迁到原生 id（带 worktree 工作区），前台的待发标签页不受影响
    expect(store.getState().bySession[`${ENGINE}/sess-9`]).toBeTruthy();
    expect(store.getState().bySession[PENDING_KEY]).toBeUndefined();
    expect(store.getState().openTabs[0].sessionId).toBeNull();
    expect(store.getState().active?.workspacePath).toBe(REPO);
  });
});
