import { useChatStore } from "@/features/chat/store";
import { defaultWorktreePath } from "@/features/worktree/pr-input";
import { useWorktreeStore } from "@/features/worktree/store";
import type { WorktreeCreateArgs } from "@/lib/ipc";

/**
 * ctx.worktrees.create 的宿主实现（SDK 0.3.17，权限 host:worktree）。
 *
 * 刻意经宿主 worktree store 而不是直接打 ipc.gitWorktreeCreate：创建进度行、
 * 取消 / 重试、失败分类与「注册进侧栏」全部是宿主既有行为，插件触发和用户
 * 在侧栏点「新建 Worktree…」应当长同一条路。独立成模块而不是内联进
 * context.ts：worktree store 的依赖链重（ipc / events / chat store），
 * runtime/context 的单测只 mock 本模块（workspace-bridge 同款理由）。
 *
 * 权限门禁在 JS 侧（与 workspaces.list / composer.setDraft 同类）：创建走的是
 * 宿主自己的前端管线，Rust 侧没有为插件专设命令；插件连 git 都不需要（本仓库
 * git-tasks 另有 exec:git 授权，绕过 JS 门也造不出比它更大的能力面）。
 */

export interface PluginWorktreeCreateDef {
  repoPath: string;
  parentWorkspaceId: string;
  branch: string;
  baseRef?: string | null;
  prNumber?: number | null;
  prTitle?: string | null;
  prUrl?: string | null;
  existingBranch?: boolean;
}

/** 终态行里的 kind 直接进 reject message 前缀，插件据此映射可读文案。 */
function creationError(kind: string | undefined, detail: string | null | undefined): Error {
  const text = (detail ?? "").trim();
  return new Error(text ? `${kind}: ${text}` : (kind ?? "unknown"));
}

/** 等待一次创建走到终态：done = 从 pending 里消失（store 的既有语义），
 *  failed / canceled = 行留在侧栏可重试，同时把原因 reject 给插件。 */
function awaitCreation(creationId: string, worktreePath: string): Promise<{ worktreePath: string }> {
  return new Promise((resolve, reject) => {
    const inspect = () => {
      const entry = useWorktreeStore.getState().pending.find((p) => p.creationId === creationId);
      if (!entry) {
        unsubscribe();
        resolve({ worktreePath });
        return true;
      }
      if (entry.stage === "failed" || entry.stage === "canceled") {
        unsubscribe();
        reject(
          creationError(
            entry.stage === "canceled" ? "canceled" : (entry.errorKind ?? "unknown"),
            entry.stage === "canceled" ? null : entry.error,
          ),
        );
        return true;
      }
      return false;
    };
    const unsubscribe = useWorktreeStore.subscribe(inspect);
    inspect();
  });
}

export interface PluginWorktreeRemoveDef {
  repoPath: string;
  worktreePath: string;
  branch?: string | null;
  deleteBranch?: boolean;
}

/** ctx.worktrees.remove 的宿主实现（SDK 0.3.19，权限 host:worktree）。
 *
 *  与侧栏右键「删除 Worktree」同一条路：git worktree remove（可选删分支）
 *  + 终端会话清理 + 侧栏登记注销 + 非致命尾巴（目录残留 / 分支保留原因）。
 *  插件只给路径，workspaceId 由宿主按路径反查；silent + onResult 让结果回到
 *  插件而不是弹宿主的横幅。 */
export function removePluginWorktree(
  pluginId: string,
  def: PluginWorktreeRemoveDef,
): Promise<{ orphanDirectory: boolean; branchKeptReason: string | null }> {
  const repoPath = def.repoPath?.trim();
  const worktreePath = def.worktreePath?.trim();
  if (!repoPath) {
    return Promise.reject(new Error(`invalid_args: ${pluginId} worktrees.remove: empty repoPath`));
  }
  if (!worktreePath) {
    return Promise.reject(new Error(`invalid_args: ${pluginId} worktrees.remove: empty worktreePath`));
  }
  const workspace = useChatStore
    .getState()
    .workspaces.find((row) => row.kind === "worktree" && row.path === worktreePath);
  const branch = typeof def.branch === "string" && def.branch.trim() ? def.branch.trim() : null;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`remove_failed: ${pluginId} worktrees.remove timed out`));
    }, 120000);
    useWorktreeStore.getState().remove({
      workspaceId: workspace ? workspace.id : "",
      worktreePath,
      repoPath,
      branch,
      deleteBranch: def.deleteBranch === true,
      silent: true,
      onResult: (outcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (outcome.ok) {
          resolve({
            orphanDirectory: outcome.value.orphanDirectory,
            branchKeptReason: outcome.value.branchKeptReason ?? null,
          });
          return;
        }
        const detail = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
        reject(new Error(`remove_failed: ${detail}`));
      },
    });
  });
}

export function createPluginWorktree(
  pluginId: string,
  def: PluginWorktreeCreateDef,
): Promise<{ worktreePath: string }> {
  const repoPath = def.repoPath?.trim();
  const branch = def.branch?.trim();
  const parentWorkspaceId = def.parentWorkspaceId?.trim();
  if (!repoPath) {
    return Promise.reject(new Error(`invalid_args: ${pluginId} worktrees.create: empty repoPath`));
  }
  if (!branch) {
    return Promise.reject(new Error(`invalid_args: ${pluginId} worktrees.create: empty branch`));
  }
  if (!parentWorkspaceId) {
    return Promise.reject(
      new Error(`invalid_args: ${pluginId} worktrees.create: empty parentWorkspaceId`),
    );
  }
  const parentKnown = useChatStore
    .getState()
    .workspaces.some((workspace) => workspace.id === parentWorkspaceId);
  if (!parentKnown) {
    return Promise.reject(
      new Error(`invalid_args: ${pluginId} worktrees.create: unknown parent workspace ${parentWorkspaceId}`),
    );
  }

  const worktreePath = defaultWorktreePath(repoPath, branch);
  const args: WorktreeCreateArgs = {
    repoPath,
    parentWorkspaceId,
    branch,
    worktreePath,
    baseRef: def.baseRef ?? null,
    prNumber: def.prNumber ?? null,
    prTitle: def.prTitle ?? null,
    prUrl: def.prUrl ?? null,
    existingBranch: def.existingBranch ?? false,
  };
  // openSessionAfter=false：会话交给调用方（插件在自己的 worktree 里起 agent
  // 轮次），宿主不在这里抢开一个空会话。
  const creationId = useWorktreeStore
    .getState()
    .start(args, { parentPath: repoPath, openSessionAfter: false });
  return awaitCreation(creationId, worktreePath);
}
