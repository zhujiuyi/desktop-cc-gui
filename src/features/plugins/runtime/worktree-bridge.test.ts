import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorktreeCreateProgress } from "@/lib/ipc";

const createMock = vi.fn();
const removeMock = vi.fn();
vi.mock("@/lib/ipc", () => ({
  ipc: {
    gitWorktreeCreate: (...args: unknown[]) => createMock(...args),
    gitWorktreeCreateCancel: vi.fn(async () => undefined),
    gitWorktreeRemove: (...args: unknown[]) => removeMock(...args),
    // workspace-bridge 的投影在本测试里不走（chat store 已 mock），但
    // worktree-bridge 经 pr-input 只取纯函数，这里不需要真实 ipc 实现。
  },
  worktreeMetaOf: () => null,
}));

const listenMock = vi.fn();
vi.mock("@/lib/transport", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

const refreshWorkspacesMock = vi.fn();
const removeWorkspaceMock = vi.fn(async () => {});
const setChatStateMock = vi.fn();
vi.mock("@/features/chat/store", () => ({
  useChatStore: {
    getState: () => ({
      workspaces: [
        { id: "ws-parent", path: "/repo/app", name: "app", lastOpenedAt: 1, sortOrder: null, groupId: null },
        { id: "ws-wt", path: "/repo/app-worktrees/pr-7-x", name: "pr-7-x", kind: "worktree", parentId: "ws-parent", lastOpenedAt: null, sortOrder: null, groupId: null },
      ],
      refreshWorkspaces: refreshWorkspacesMock,
      removeWorkspace: removeWorkspaceMock,
    }),
    setState: (...args: unknown[]) => setChatStateMock(...args),
  },
}));

const terminalRemoveMock = vi.fn();
vi.mock("@/features/terminal/store", () => ({
  useTerminalStore: { getState: () => ({ removeWorkspace: terminalRemoveMock }) },
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));

const dismissCenterSurfacesMock = vi.fn();
vi.mock("@/features/chat/center-surfaces", () => ({
  dismissCenterSurfaces: dismissCenterSurfacesMock,
}));

// vi.mock 提升后静态导入拿到的是 mock 版。
import { useWorktreeStore } from "@/features/worktree/store";
import { createPluginWorktree, removePluginWorktree } from "./worktree-bridge";

const DEF = {
  repoPath: "/repo/app",
  parentWorkspaceId: "ws-parent",
  branch: "pr-1842-x",
  prNumber: 1842,
  prTitle: "Add worktree support",
  prUrl: "https://github.com/o/r/pull/1842",
};

function finish(stage: WorktreeCreateProgress["stage"], extra: Partial<WorktreeCreateProgress> = {}) {
  const id = useWorktreeStore.getState().pending.at(-1)!.creationId;
  useWorktreeStore.getState().applyProgress({ creationId: id, stage, ...extra });
}

describe("plugin worktree bridge", () => {
  beforeEach(() => {
    localStorage.clear();
    useWorktreeStore.setState({
      pending: [],
      prefs: { location: null, openSessionAfter: true },
    });
    createMock.mockReset().mockResolvedValue(undefined);
    listenMock.mockReset().mockResolvedValue(() => {});
    refreshWorkspacesMock.mockReset().mockResolvedValue(undefined);
    dismissCenterSurfacesMock.mockReset();
  });

  it("starts the host pipeline with the default layout and resolves on done", async () => {
    const pending = createPluginWorktree("git-tasks", DEF);
    const rows = useWorktreeStore.getState().pending;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      branch: "pr-1842-x",
      parentWorkspaceId: "ws-parent",
      args: {
        repoPath: "/repo/app",
        worktreePath: "/repo/app-worktrees/pr-1842-x",
        prNumber: 1842,
        prTitle: "Add worktree support",
        prUrl: "https://github.com/o/r/pull/1842",
      },
      // 插件创建的 worktree 不开宿主空会话：会话由插件自己的 agent 轮次承担。
      openSessionAfter: false,
    });
    finish("done");
    await expect(pending).resolves.toEqual({ worktreePath: "/repo/app-worktrees/pr-1842-x" });
  });

  it("rejects with kind-prefixed message on failure and keeps the retry row", async () => {
    const pending = createPluginWorktree("git-tasks", DEF);
    finish("failed", { errorKind: "pr_not_found", error: "remote ref not found" });
    await expect(pending).rejects.toThrow(/^pr_not_found: remote ref not found$/);
    // 失败行留在侧栏（宿主既有语义）：用户可重试，插件也在任务条上给同一个原因。
    expect(useWorktreeStore.getState().pending).toHaveLength(1);
  });

  it("rejects as canceled when the user cancels the sidebar row", async () => {
    const pending = createPluginWorktree("git-tasks", DEF);
    finish("canceled");
    await expect(pending).rejects.toThrow(/^canceled$/);
  });

  it("rejects before touching the pipeline when the parent workspace is unknown", async () => {
    await expect(
      createPluginWorktree("git-tasks", { ...DEF, parentWorkspaceId: "missing" }),
    ).rejects.toThrow(/unknown parent workspace missing/);
    expect(useWorktreeStore.getState().pending).toHaveLength(0);
  });

  it("remove 走宿主删除流程：按路径反查 workspaceId，回传结果尾巴", async () => {
    removeMock.mockResolvedValueOnce({ orphanDirectory: true, branchDeleted: false, branchKeptReason: "unknown" });
    const result = await removePluginWorktree("git-tasks", {
      repoPath: "/repo/app",
      worktreePath: "/repo/app-worktrees/pr-7-x",
      branch: "pr-7-x",
      deleteBranch: true,
    });
    expect(removeMock).toHaveBeenCalledWith("/repo/app", "/repo/app-worktrees/pr-7-x", "pr-7-x", true);
    expect(removeWorkspaceMock).toHaveBeenCalledWith("ws-wt");
    expect(terminalRemoveMock).toHaveBeenCalledWith("/repo/app-worktrees/pr-7-x");
    expect(result).toEqual({ orphanDirectory: true, branchKeptReason: "unknown" });
    // silent：不要同时弹宿主的 actionError 横幅
    expect(setChatStateMock).not.toHaveBeenCalled();
  });

  it("remove 失败以 remove_failed 前缀 reject", async () => {
    removeMock.mockRejectedValueOnce(new Error("worktree is dirty"));
    await expect(
      removePluginWorktree("git-tasks", { repoPath: "/repo/app", worktreePath: "/repo/app-worktrees/pr-7-x" }),
    ).rejects.toThrow(/^remove_failed: worktree is dirty/);
  });

  it("remove 缺参数直接 reject invalid_args", async () => {
    await expect(removePluginWorktree("git-tasks", { repoPath: "", worktreePath: "/x" })).rejects.toThrow(/invalid_args/);
  });

  it("rejects empty branch / repoPath synchronously-ish without IPC", async () => {
    await expect(createPluginWorktree("git-tasks", { ...DEF, branch: "  " })).rejects.toThrow(
      /empty branch/,
    );
    await expect(createPluginWorktree("git-tasks", { ...DEF, repoPath: "" })).rejects.toThrow(
      /empty repoPath/,
    );
    expect(createMock).not.toHaveBeenCalled();
  });
});
