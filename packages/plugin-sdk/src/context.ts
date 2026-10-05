import type { ComponentType } from "react";
import type * as React from "react";
import type { Disposer } from "./manifest";
import type { ComposerSlotId, SessionMenuTarget } from "./registry";

/**
 * PluginContext（plan §5.2）：插件唯一能力门面。宿主 runtime/context.ts
 * 实现本接口；插件侧的类型镜像见包根 plugin.d.ts（双向漂移由
 * contract-check.ts 在类型层面把守）。
 */

/** 外部会话源行(ctx.sessions.registerSource,0.3.4 起):插件上报的
 *  远端/容器内会话摘要。workspacePath 必须是已登记工作区的 path,否则
 *  宿主合并时丢弃(侧栏按 workspacePath 分组)。 */
export interface ExternalSessionRow {
  engine: string;
  sessionId: string;
  workspacePath: string;
  title?: string;
  updatedAt?: number | null;
  /** 远端 jsonl 绝对路径(可选;宿主历史回放经远程通道拉取)。 */
  remotePath?: string;
}

export type PluginConversationProps = {
  conversationId: string;
  workspacePath: string;
  language: string;
  onExit: () => void;
  setExitBlocked?: (blocked: boolean) => void;
};

export interface PluginAgentCatalogEntry {
  engine: string;
  label: string;
  available: boolean;
  readOnly: boolean;
  providers: { id: string; label: string }[];
  /** 引擎当前可用模型。`provider` 是模型所属渠道 id（与 `providers[].id`
   *  对齐，0.3.18 起），插件可据此分组；`label` 已是显示名。 */
  models: { id: string; label: string; provider?: string }[];
  /** 该引擎支持的推理强度档位（滑块顺序；空数组 = 不支持配置）。 */
  efforts: string[];
}

/** 侧栏工作区行（`ctx.workspaces.list()`）。刻意不含 `meta`：那是宿主与
 *  其它插件写入的私有载荷，读接口只给展示与路径解析需要的字段。 */
export interface PluginWorkspaceRow {
  id: string;
  /** 本机绝对路径（远程/WSL 工作区的路径在本机不存在，但字符串原样可用）。 */
  path: string;
  /** 侧栏显示名（目录名或用户重命名后的名字）。 */
  name: string;
  /** "worktree" = git worktree 子行；undefined = 普通工作区。 */
  kind?: "worktree";
  /** 侧栏分组 id；null = 未分组。 */
  groupId: string | null;
  /** 父工作区 id；仅 kind="worktree" 时存在。 */
  parentId?: string;
  /** 上次打开时间（Unix 毫秒）；从未打开为 null。 */
  lastOpenedAt: number | null;
  /** worktree 子行的只读投影（0.3.17 起）：分支名与来源 PR 编号。`kind` 为
   *  "worktree" 时存在；`meta` 里的其它私有载荷（如 wsl）仍然不出。 */
  worktree?: { branch: string; prNumber?: number };
}

export interface PluginContext {
  pluginId: string;
  version: string;
  /** Shared host React instance: external bundles can't resolve bare
   *  imports, so they build host-tree components with
   *  `ctx.react.createElement`; 插件自己的子树用自带 React createRoot 挂进
   *  ctx.react 容器（双段挂载模式，import-map 共享是 P0-3 后续）。 */
  react: typeof React;
  ui: {
    registerConversationMode(def: {
      key?: string;
      label: () => string;
      component: ComponentType<PluginConversationProps>;
    }): Disposer;
    registerSettingsSection(def: {
      /** Optional sub-key; the settings page key becomes
       *  `plugin:<id>` or `plugin:<id>:<key>`. */
      key?: string;
      label: () => string;
      icon?: ComponentType<{ className?: string }>;
      component: ComponentType;
    }): Disposer;
    registerAddMenuRow(def: {
      key?: string;
      label: () => string;
      description?: () => string;
      icon?: ComponentType<{ className?: string }>;
      onSelect: () => void;
    }): Disposer;
    /** Extra control rendered beside a composer slot's builtin control
     *  (plan §4.2 #2). Permission `ui:composer-status` (shared with
     *  registerComposerStatusItem — both gate on the same composer-area
     *  grant; there is no separate `ui:composer` permission). */
    registerComposerSlot(def: {
      slot: ComposerSlotId;
      key?: string;
      component: ComponentType;
      order?: number;
    }): Disposer;
    /** Chat right-panel tab (plan §4.2 #4); renders with the active
     *  workspace path. The strip renders plugin tabs icon-only, so `icon` is
     *  the visible identity — without one the tab falls back to the plugin's
     *  artwork / letter tile, and the label stays a title/accessible name. */
    registerPanelTab(def: {
      key?: string;
      label: () => string;
      icon?: ComponentType<{ className?: string }>;
      component: ComponentType<{ workspacePath: string }>;
      order?: number;
    }): Disposer;
    /** App status-bar chip (plan §4.2 #8). */
    registerStatusBarItem(def: {
      key?: string;
      component: ComponentType;
      order?: number;
      /** Placement zone (0.3.8): "start" = left-aligned zone; omitted/"end"
       *  = legacy slot after sync status, before version. */
      zone?: "start" | "end";
    }): Disposer;
    /** Composer status-row chip (permission `ui:composer-status`, 0.3.9):
     *  renders in the composer's status row (branch/context meter row),
     *  left group after the branch switcher. */
    registerComposerStatusItem(def: {
      key?: string;
      component: ComponentType;
      order?: number;
    }): Disposer;
    /** Command palette entry (plan §4.2 #9). */
    registerCommand(def: {
      key: string;
      title: () => string;
      keywords?: () => string[];
      run: () => void;
    }): Disposer;
    /** Sidebar session right-click menu row (permission `ui:session-menu`,
     *  0.3.5 起)。`run` 收到打开菜单的会话 `{ engine, sessionId }`。 */
    registerSessionMenuItem(def: {
      key?: string;
      label: () => string;
      icon?: ComponentType<{ className?: string }>;
      danger?: boolean;
      run: (target: SessionMenuTarget) => void;
    }): Disposer;
    /** 跳转到本插件的设置页（权限 `ui:settings-section`，0.3.6 起）。
     *  `key` 对应 registerSettingsSection 的子 key，省略时打开主 section；
     *  供状态栏 chip、面板按钮等做深链入口。 */
    openSettings(key?: string): void;
    /** Markdown pipeline additions, merged over host defaults (plan §4.2 #5). */
    registerMarkdownRenderer(def: {
      key?: string;
      remarkPlugins?: unknown[];
      rehypePlugins?: unknown[];
      components?: Record<string, unknown>;
    }): Disposer;
    /** Overlay page at `#/p/<id>` (plan §4.2 #10). */
    registerPage(def: {
      key?: string;
      title: () => string;
      component: ComponentType;
    }): Disposer;
        /** Renderer for a plugin-defined chat timeline row kind (plan §4.2 #5).
     * The row payload is plugin-defined and typed loosely — blob bundles
     * can't share the host's TimelineRow type identity. */
    registerTimelineRowRenderer(def: {
      kind: string;
      key?: string;
      component: ComponentType<{ row: { kind: string } }>;
    }): Disposer;
    /** Home sidebar nav entry under the builtin 自动化 row (permission
     *  `ui:sidebar-entry`, 0.3.12). `onOpen` usually opens the plugin's
     *  center tab via openCenterTab. */
    registerSidebarNav(def: {
      key?: string;
      label: () => string;
      icon?: ComponentType<{ className?: string }>;
      order?: number;
      onOpen: () => void;
    }): Disposer;
    /** Center-area tab definition (permission `ui:center-tab`, 0.3.12):
     *  renders in the center tab strip like session/file/browser tabs.
     *  Opening goes through openCenterTab; multiple keys = multiple tabs. */
    registerCenterTab(def: {
      key?: string;
      title: () => string;
      icon?: ComponentType<{ className?: string }>;
      component: ComponentType;
      order?: number;
    }): Disposer;
    /** Open (or focus) one of this plugin's registered center tabs
     *  (permission `ui:center-tab`, 0.3.12). Throws when the tab was never
     *  registered — open failures must be visible, not silent. */
    openCenterTab(key?: string): void;
  };
  theme: {
    /** Inject a stylesheet scoped to this plugin; removed on unload.
     *  Rejects remote references (`@import`, `url(http…)`): plugins must be
     *  self-contained (plan §8 gate rules). */
    injectCss(css: string): Disposer;
    /** Shorthand for BoardUI token overrides: keys must be `--*` custom
     *  properties; emits `:root {…}` and `.dark {…}` blocks. */
    setTokens(tokens: { light?: Record<string, string>; dark?: Record<string, string> }): Disposer;
  };
  i18n: {
    addBundle(lang: string, ns: string, resources: Record<string, unknown>): Disposer;
  };
  storage: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
  events: {
    on(topic: string, cb: (data: unknown) => void): Disposer;
    emit(topic: string, data: unknown): void;
  };
  /** 聊天输入框（composer）草稿写入（权限 `composer:draft`，0.3.2 起）。
   *  写入即替换当前活动会话的草稿；不触发发送——发送永远是用户动作。 */
  composer: {
    setDraft(text: string): void;
  };
  /** 工作区登记与读取（权限 `host:workspace`，0.3.3 起；
   *  `list` 0.3.16 起）。把任意路径登记为侧栏工作区——不要求本机存在该
   *  目录（如经 ssh 管理的远程机/WSL 发行版内路径）。`meta` 透传存储在
   *  宿主工作区行上，形状由写入方与消费方约定。
   *
   *  `list` 返回侧栏当前的工作区行（含 worktree 子行，`kind` 区分）。它是
   *  **只读快照**：不含 `meta`（远程/其它插件写入的私有载荷）、不含分组
   *  定义，只给插件做「按本机工作区解析仓库/路径」这类用途。需要跟随宿主
   *  变更时重新调用，宿主不为插件广播工作区变更事件。
   *
   *  `meta` 携带 `wsl` 键（远程工作区，宿主引擎经 ssh 把会话流量导到
   *  meta.wsl 指定的主机与发行版）需要额外权限 `host:workspace:remote`
   *  （0.3.4 起）——这等效于出网 + 远程执行导向，远超登记一行侧栏数据。
   *  信任权衡：远程通道首连采用 StrictHostKeyChecking=accept-new
   *  （首连自动记录 host key，之后变更才拒绝），插件作者应知晓这是
   *  TOFU 而非严格 pinning。 */
  workspaces: {
    add(path: string, meta?: Record<string, unknown>): Promise<void>;
    /** 侧栏工作区快照（只读；权限 `host:workspace`，0.3.16 起）。
     *  worktree 子行额外带 `worktree: { branch, prNumber? }` 只读投影
     *  （0.3.17 起），用来把 PR 绑到本地 worktree；字段定义见
     *  `PluginWorkspaceRow`，`meta` 本体仍不输出。 */
    list(): Promise<PluginWorkspaceRow[]>;
  };
  /** Worktree 创建（权限 `host:worktree`，0.3.17 起）：经宿主「新建 Worktree」
   *  管线（validate → fetch → add → register）创建，宿主侧栏出现同一份进度
   *  行与取消/重试语义；成功后 worktree 以 `kind="worktree"` 登记进侧栏
   *  （父行是 `parentWorkspaceId` 对应的工作区），resolve 已注册的路径。
   *
   *  `prNumber` 存在时 fetch `pull/<n>/head` 再检出；`existingBranch` 表示
   *  `branch` 是已存在的本地分支（检出而非新建）。路径缺省 = 宿主默认布局
   *  `<仓库同级>/<仓库名>-worktrees/<branch>`。
   *
   *  失败/取消以 `Error` reject，message 形如 `"<errorKind>: <detail>"`
   *  （kind 与宿主错误分类一致：not_a_repo / invalid_branch /
   *  branch_not_found / branch_exists / branch_checked_out / dir_exists /
   *  pr_not_found / fetch_failed / register_failed / sparse_checkout_empty /
   *  canceled / unknown），插件据此给用户可读文案。 */
  worktrees: {
    create(def: {
      /** 本地仓库路径（父工作区目录，必须是 git 仓库）。 */
      repoPath: string;
      /** 侧栏父工作区 id：新 worktree 作为子行挂在它下面。 */
      parentWorkspaceId: string;
      /** 新 worktree 检出的分支名。 */
      branch: string;
      /** 新建分支时的起点；缺省 = 仓库 HEAD。 */
      baseRef?: string | null;
      /** 从 PR 创建：fetch `pull/<n>/head` 到 `branch`。 */
      prNumber?: number | null;
      prTitle?: string | null;
      prUrl?: string | null;
      /** true = `branch` 是已存在的本地分支（检出而非新建）。 */
      existingBranch?: boolean;
    }): Promise<{ worktreePath: string }>;
  };
  /** 会话打开 + 外部会话源(权限 `host:session`;selectSession 0.3.3 起,
   *  registerSource 0.3.4 起)。registerSource:登记异步会话源,宿主在会话
   *  目录刷新(init/refreshSessions/rescan)时调用 `list()` 并把行合并进
   *  侧栏列表——本机扫描结果优先,同 engine/sessionId/workspacePath 的外部
   *  行被丢弃。返回 Disposer,插件卸载时自动注销。 */
  sessions: {
    selectSession(engine: string, sessionId: string, workspacePath: string): Promise<void>;
    /** 请求宿主立即刷新会话目录（侧栏/标签页），0.3.7 起。
     *  插件绕过宿主直写会话数据（如 sqlite custom_title、转录 title 行）后
     *  调用——否则变更要等用户手动同步或下次常规刷新才可见。 */
    refresh(): Promise<void>;
    /** 修改已有会话的 effort 档位，0.3.10 起。直写宿主会话状态并持久化
     *  （等价于用户在会话内切换档位，refreshSessions 不会回滚）。未知会话
     *  或空 effort 以 rejection 失败——不会创建幽灵会话条目。 */
    setEffort(engine: string, sessionId: string, workspacePath: string, effort: string): Promise<void>;
    /** 把一个 AI 轮次跑成**宿主聊天会话**（0.3.18 起，权限 `host:session`）：
     *  会话立刻出现在侧栏（带运行中状态，不需要手动同步），打开就是实时
     *  流式输出；停止既能在聊天里点，也能用 `interruptRun`。会话挂在
     *  `workspacePath` 工作区下，模型/强度/渠道只覆盖这一轮，不动用户的
     *  全局默认。
     *
     *  与 `ctx.agent.start` 的分工：那个是插件自有的后台轮次（事件只回
     *  插件，不进聊天）；这个就是「像用户自己发了一条」。需要用户看得见、
     *  随时能接管/停止的轮次用本方法。
     *
     *  spawn 成功后 resolve `{ runId, sessionId }`（引擎稍后才 announce
     *  sessionId 时为 null）；轮次终止经 `plugin-run://<pluginId>` 事件回执：
     *  `{ runId, sessionId, engine, workspacePath, kind: "done" | "error", error }`。
     *  被用户/插件中断的轮次同样以 `done` 收尾。 */
    startRun(def: {
      engine: string;
      prompt: string;
      /** 会话所属工作区路径（如某个 worktree）。 */
      workspacePath: string;
      /** 本轮模型 id（`ctx.agent.catalog` 的 `models[].id`）。 */
      model?: string | null;
      /** 本轮推理强度（catalog 的 `efforts` 里的一档）。 */
      effort?: string | null;
      /** 本轮渠道 id（catalog 的 `providers[].id`）。 */
      providerId?: string | null;
    }): Promise<{ runId: string; sessionId: string | null }>;
    /** 停止 `startRun` 起的轮次（等价于聊天里的停止按钮）。 */
    interruptRun(def: {
      engine: string;
      workspacePath: string;
      sessionId?: string | null;
    }): Promise<void>;
    registerSource(def: {
      /** 源 id,插件内唯一;同 id 重复登记覆盖(热重载语义)。 */
      id: string;
      list: () => Promise<ExternalSessionRow[]>;
    }): Disposer;
  };
  /** Agent 轮次（权限 `agent`，0.3.13 起）：经宿主引擎管线拉起 agent
   *  进程——渠道注入、进程注册与聊天发送同构。事件走独立的
   *  `agent://<pluginId>` 总线话题（ctx.events.on 订阅；payload 为引擎
   *  事件信封 { runId, sessionId, engine, seq, kind, data, ts }，kind ∈
   *  delta | tool | usage | done | error …）。桌面专属（isWeb 下不可用的
   *  插件要自呈现）。 */
  agent: {
    catalog(workspacePath: string): Promise<PluginAgentCatalogEntry[]>;
    /** 启动一个 agent 轮次；返回的 runId 用于事件过滤与 interrupt。 */
    start(def: {
      engine: string;
      prompt: string;
      /** agent 进程的工作目录（绝对路径）。 */
      workspacePath: string;
      model?: string;
      /** 缺省 = 引擎当前渠道（与聊天发送同一解析）。 */
      providerId?: string;
      /** 引擎相关的会话续接 id（如 pi 的 --session-id）：同一 id 续上轮。 */
      sessionId?: string;
      readOnly?: boolean;
      requestId?: string;
    }): Promise<{ runId: string; sessionId: string | null }>;
    /** 中断本插件启动的 run（run id 属主前缀由宿主强制）。 */
    interrupt(runId: string): Promise<boolean>;
  };
  /** 通用能力出口（0.3.0 起；旧的 `cmd:<command>` 逐命令授权机制已删除）。
   *  仅下列命令，`pluginId` 由宿主自动注入（插件无需也不能传）：
   *
   *  - `plugin_http_request` `{ method, url, headers?, body? }` →
   *    `{ status, body }`：url 限 http/https，host(+端口) 须命中 manifest 的
   *    `network:<host>` / `network:<host>:<port>` / `network:<host>:<a>-<b>` 授权
   *    （形状与放行规则见 spec/permissions.json）。
   *  - `plugin_exec_run` `{ bin, args, env?, timeoutMs? }` →
   *    `{ code, stdout, stderr }`：bin 须命中 `exec:<bin>` 授权（裸名，无路径）。
   *    子进程 PATH 由宿主注入为"插件 env 的 PATH（如有，保持优先）+ 宿主 CLI
   *    搜索目录（进程 PATH + 常见安装位置）"，保证 `#!/usr/bin/env node`
   *    类 shim 能找到解释器；插件无法借 env 完全锁死 PATH。
   *  - `plugin_exec_spawn` `{ bin, args, env?, lifecycle? }` → void：
   *    同授权；成功时 resolve 为 void（Rust 返回 ()），失败 reject。
   *    PATH 注入语义同 `plugin_exec_run`。
   *    lifecycle 缺省 "detached"（用户级服务，活过插件）；"plugin" =
   *    附属进程，宿主跟踪，插件禁用/卸载时自动 kill。
   *  - `plugin_exec_kill` `{}` → `{ killed: number }`：kill 本插件全部
   *    lifecycle="plugin" 子进程（配置变更改名重启用；需任意 exec: 授权）。
   *  - `plugin_agent_start` / `plugin_agent_interrupt`（0.3.13 起）：
   *    与 `ctx.agent` 同一能力（需 `agent` 授权）——引擎管线由宿主接管，
   *    run id 属主前缀在 Rust 侧强制。
   *
   *  授权未命中的调用在 JS 侧即 reject（不打 IPC）；Rust 侧对授权与插件
   *  启用态另有强制（纵深防御）。 */
  bridge: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  host: {
    appVersion: string;
    /** 宿主实现的 SDK 契约版本（= 本包 version），供插件运行时自检。 */
    sdkVersion: string;
    locale: string;
    /** True in the web-access browser client; the desktop-only bridge
     *  commands above are absent there. */
    isWeb: boolean;
  };
}
