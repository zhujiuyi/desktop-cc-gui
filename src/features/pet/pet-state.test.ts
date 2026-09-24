import { describe, expect, it } from "vitest";
import { derivePetStates } from "./pet-state";

const chat = (session: Record<string, unknown>) => ({ bySession: { current: session } }) as never;
const mission = (runs: Record<string, unknown>) => ({ runs }) as never;

const firstStatus = (
  chatState: Parameters<typeof derivePetStates>[0],
  missionState: Parameters<typeof derivePetStates>[1],
  now?: number,
) => derivePetStates(chatState, missionState, now)[0]?.status;

describe("pet state aggregation", () => {
  it("works on the v1.0.8 session shape without PR #1266 task signals", () => {
    const states = derivePetStates(
      chat({
        error: null,
        streaming: true,
        messages: [{ role: "thinking", text: "正在分析", live: true }],
      }),
      mission({}),
    );

    expect(states[0]?.status).toBe("running");
    expect(states[0]?.activity).toBe("thinking");
  });

  it("keeps waiting ahead of a sibling task failure", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: true,
          tasks: [{ status: "failed" }],
        }),
        mission({}),
      ),
    ).toBe("waiting");
  });

  it("shows resumed session activity after a child task failed", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: true,
          backgroundActive: false,
          awaitingTasks: false,
          tasks: [{ status: "failed" }],
          messages: [],
        }),
        mission({}),
      ),
    ).toBe("running");
  });

  it("shows a failed task while the session sits idle", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          tasks: [{ status: "failed" }],
          messages: [],
        }),
        mission({}),
      ),
    ).toBe("failed");
  });

  it("drops the failure once a newer task settles", () => {
    const states = derivePetStates(
      chat({
        error: null,
        streaming: false,
        backgroundActive: false,
        awaitingTasks: false,
        // Array order is start order: the later task's completion supersedes
        // the earlier failure — the pet must not pin 任务失败 forever.
        tasks: [{ status: "failed" }, { status: "completed" }],
        messages: [],
      }),
      mission({}),
    );
    expect(states).toHaveLength(0);
  });

  it("does not read an interrupted task as a failure", () => {
    const states = derivePetStates(
      chat({
        error: null,
        streaming: false,
        backgroundActive: false,
        awaitingTasks: false,
        tasks: [{ status: "interrupted" }],
        messages: [],
      }),
      mission({}),
    );
    expect(states).toHaveLength(0);
  });

  it("ignores an ambient task's failure", () => {
    const states = derivePetStates(
      chat({
        error: null,
        streaming: false,
        backgroundActive: false,
        awaitingTasks: false,
        tasks: [{ status: "failed", ambient: true }],
        messages: [],
      }),
      mission({}),
    );
    expect(states).toHaveLength(0);
  });

  it("prefers background activity over a stale failure", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: true,
          awaitingTasks: false,
          tasks: [{ status: "failed" }],
          messages: [],
        }),
        mission({}),
      ),
    ).toBe("running");
  });

  it("includes active mission runs when chat is idle", () => {
    expect(
      firstStatus(
        chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
        mission({
          run: {
            endedAt: undefined,
            cancelled: false,
            interrupted: false,
            tasks: [{ status: "waiting_human" }],
          },
        }),
      ),
    ).toBe("waiting");
  });

  it("reports a failed task inside an active mission run", () => {
    expect(
      firstStatus(
        chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
        mission({
          run: {
            endedAt: undefined,
            cancelled: false,
            tasks: [{ status: "failed" }],
          },
        }),
      ),
    ).toBe("failed");
  });

  it("keeps an active mission run's human wait ahead of a failed sibling", () => {
    expect(
      firstStatus(
        chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
        mission({
          run: {
            endedAt: undefined,
            cancelled: false,
            tasks: [{ status: "failed" }, { status: "waiting_human" }],
          },
        }),
      ),
    ).toBe("waiting");
  });

  it("keeps a mission run's live work ahead of a failed sibling", () => {
    expect(
      firstStatus(
        chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
        mission({
          run: {
            endedAt: undefined,
            cancelled: false,
            tasks: [{ status: "failed" }, { status: "running" }],
          },
        }),
      ),
    ).toBe("running");
  });

  it("ignores finished mission runs instead of pinning a stale state", () => {
    const states = derivePetStates(
      chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
      mission({
        failedRun: {
          endedAt: 1000,
          cancelled: false,
          tasks: [{ status: "failed" }],
        },
        doneRun: {
          endedAt: 2000,
          cancelled: false,
          tasks: [{ status: "succeeded" }],
        },
      }),
    );

    expect(states.every((state) => state.sessionKey !== "__mission__")).toBe(true);
  });

  it("ignores cancelled or interrupted mission runs", () => {
    const states = derivePetStates(
      chat({ error: null, streaming: false, backgroundActive: false, awaitingTasks: false, tasks: [] }),
      mission({
        interruptedRun: {
          endedAt: 3000,
          cancelled: true,
          interrupted: true,
          tasks: [{ status: "cancelled" }],
        },
      }),
    );

    expect(states.every((state) => state.sessionKey !== "__mission__")).toBe(true);
  });

  it("keeps concurrent session names attached to their own states", () => {
    const session = (text: string) => ({
      messages: [{ role: "thinking", text, live: true }],
      error: null,
      streaming: true,
      backgroundActive: false,
      awaitingTasks: false,
      tasks: [],
    });
    const states = derivePetStates(
      {
        bySession: {
          "claude/session-a": session("A"),
          "claude/session-b": session("B"),
        },
        sessions: [
          {
            engine: "claude",
            sessionId: "session-a",
            workspacePath: "E:/a",
            title: "会话 A",
            customTitle: null,
          },
          {
            engine: "claude",
            sessionId: "session-b",
            workspacePath: "E:/b",
            title: "会话 B",
            customTitle: null,
          },
        ],
      } as never,
      mission({}),
    );

    expect(states.map((state) => [state.sessionKey, state.sessionName])).toEqual([
      ["claude/session-a", "会话 A"],
      ["claude/session-b", "会话 B"],
    ]);
  });
});

describe("failure flash and round scoping", () => {
  // 显式"现在"：暂显窗口按时间判定，用真实时钟会漂移。
  const NOW = 1_800_000_000_000;
  const failedTask = (updatedAt: number) => ({ status: "failed", updatedAt });

  it("flashes a fresh failure even while the round keeps working", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: true,
          backgroundActive: true,
          awaitingTasks: false,
          messages: [],
          tasks: [failedTask(NOW - 1_000)],
        }),
        mission({}),
        NOW,
      ),
    ).toBe("failed");
  });

  it("hands back to the remaining work once the flash window passes", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: true,
          awaitingTasks: false,
          messages: [],
          tasks: [failedTask(NOW - 6_000)],
        }),
        mission({}),
        NOW,
      ),
    ).toBe("running");
  });

  it("hands back to waiting while the round still awaits its tasks", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: true,
          messages: [],
          tasks: [failedTask(NOW - 6_000)],
        }),
        mission({}),
        NOW,
      ),
    ).toBe("waiting");
  });

  it("keeps the failure after the round only when nothing followed it", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          messages: [],
          tasks: [failedTask(NOW - 60_000)],
        }),
        mission({}),
        NOW,
      ),
    ).toBe("failed");
  });

  it("drops the old failure once a later task settles", () => {
    expect(
      derivePetStates(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          messages: [],
          tasks: [failedTask(NOW - 60_000), { status: "completed", updatedAt: NOW - 10_000 }],
        }),
        mission({}),
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("keeps the failure when only the CLI's notification turn followed it", () => {
    expect(
      firstStatus(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          tasks: [failedTask(NOW - 20_000)],
          // 失败后 CLI 自排的通知回合重开了段：模型回执晚于失败，但它不是
          // "新一轮对话"，不该把收尾持续状态的失败清掉。
          notificationTurnStartedAt: NOW - 15_000,
          messages: [
            {
              role: "assistant",
              text: "那个任务失败了。",
              ts: new Date(NOW - 12_000).toISOString(),
              seq: 2,
            },
          ],
        }),
        mission({}),
        NOW,
      ),
    ).toBe("failed");
  });

  it("clears the failure when a real user round follows it", () => {
    expect(
      derivePetStates(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          tasks: [failedTask(NOW - 20_000)],
          notificationTurnStartedAt: NOW - 15_000,
          messages: [
            {
              role: "assistant",
              text: "那个任务失败了。",
              ts: new Date(NOW - 12_000).toISOString(),
              seq: 2,
            },
            {
              role: "user",
              text: "知道，继续。",
              ts: new Date(NOW - 8_000).toISOString(),
              seq: 3,
            },
          ],
        }),
        mission({}),
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("drops the old failure once the conversation moved on", () => {
    expect(
      derivePetStates(
        chat({
          error: null,
          streaming: false,
          backgroundActive: false,
          awaitingTasks: false,
          tasks: [failedTask(NOW - 60_000)],
          messages: [
            {
              role: "assistant",
              text: "那个任务失败了，我换条路继续。",
              ts: new Date(NOW - 5_000).toISOString(),
              seq: 1,
            },
          ],
        }),
        mission({}),
        NOW,
      ),
    ).toHaveLength(0);
  });
});
