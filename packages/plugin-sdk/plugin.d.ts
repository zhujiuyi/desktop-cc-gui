/**
 * @ccgui/plugin-sdk — 插件侧公共契约声明（VS Code 的 vscode.d.ts 同款模式：
 * 本文件是插件作者面对的公共 API 定义，与 src/ 同包维护、同版本发布；
 * 双向漂移由 src/contract-check.ts 在类型层面把守）。
 *
 * 插件仓用法（包未发布 npm 前的过渡方案）：复制本文件为插件仓的
 * `src/ccgui-plugin.d.ts`，首行版本戳必须与所用宿主 SDK 一致。
 *
 * @ccgui/plugin-sdk v0.3.18
 */

/** 宿主实现的 SDK 契约版本。 */
export declare const SDK_VERSION: string;

/** 每次注册的撤销句柄；卸载时逆序执行。 */
export type Disposer = () => void;

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
  /** 引擎当前可用模型。provider 是模型所属渠道 id（与 providers[].id 对齐，
   *  0.3.18 起），插件可据此分组；label 已是显示名。 */
  models: { id: string; label: string; provider?: string }[];
  /** 该引擎支持的推理强度档位（滑块顺序；空数组 = 不支持配置）。 */
  efforts: string[];
}

/** 侧栏工作区行(ctx.workspaces.list())。刻意不含 meta:那是宿主与其它插件
 *  写入的私有载荷,读接口只给展示与路径解析需要的字段。 */
export interface PluginWorkspaceRow {
  id: string;
  /** 本机绝对路径(远程/WSL 工作区的路径在本机不存在,但字符串原样可用)。 */
  path: string;
  /** 侧栏显示名(目录名或用户重命名后的名字)。 */
  name: string;
  /** "worktree" = git worktree 子行;undefined = 普通工作区。 */
  kind?: "worktree";
  /** 侧栏分组 id;null = 未分组。 */
  groupId: string | null;
  /** 父工作区 id;仅 kind="worktree" 时存在。 */
  parentId?: string;
  /** 上次打开时间(Unix 毫秒);从未打开为 null。 */
  lastOpenedAt: number | null;
  /** worktree 子行的只读投影(0.3.17 起):分支名与来源 PR 编号。kind 为
   *  "worktree" 时存在;meta 里的其它私有载荷(如 wsl)仍然不出。 */
  worktree?: { branch: string; prNumber?: number };
}

/** 信任层级（ADR-1）：declarative = 零 JS 声明式。 */
export type PluginTier = "declarative" | "js";

/** 插件入口唯一约定：main.js 默认导出本函数。 */
export type PluginActivate = (ctx: PluginContext) => void | (() => void);

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

export interface JsonSchemaProperty {
  type?: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  default?: unknown;
  enum?: (string | number)[];
}

export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/** ccgui.plugin.json（plan §5.1）。 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion?: string;
  /** SDK 兼容区间："^0.3" / "~0.3.0" / ">=0.3.0" / 精确 / "*"（缺省不校验）。 */
  sdkVersion?: string;
  author?: string;
  description?: string;
  tier: PluginTier;
  /** 基座权限与 `network:<host>[…]` / `exec:<bin>` 授权；全集、形状与放行
   *  规则以包内 spec/permissions.json 为单一事实源（TS/Rust/模板校验脚本
   *  三方消费同一文件）。`network:none` 是基座权限（声明无网络），永远
   *  不是授权——它不会放行任何主机。 */
  permissions: string[];
  contributes?: {
    themes?: { name?: string; tokens: { light?: Record<string, string>; dark?: Record<string, string> } }[];
    i18n?: { lang: string; ns?: string; resources: Record<string, unknown> }[];
    statusBarItems?: { key?: string; text: string }[];
    commands?: { key: string; title: string; emits?: string }[];
  };
  configSchema?: JsonSchemaObject;
  /** 市场方形图标：仓库内相对路径（推荐 `docs/icon.png`）或 https URL；
   *  缺省 = 市场用首字母瓷砖。仅索引消费，宿主安装不读。 */
  icon?: string;
  /** 市场详情页效果图：仓库内相对路径或 https URL，≤ 5 张；缺省 = 不渲染图集。 */
  screenshots?: string[];
}

export type ComposerSlotId = "addMenu" | "cliMenu" | "permissionMenu";

/** 侧栏会话右键菜单被打开时所在的会话行。 */
export interface SessionMenuTarget {
  engine: string;
  sessionId: string;
}

export type ComponentLike<P = Record<string, never>> = (props: P) => unknown;

/** 插件唯一能力门面（plan §5.2）。每个 register* 需要对应权限声明，
 *  返回 Disposer；未显式回收也由宿主 disposer 栈兜底。 */
export interface PluginContext {
  pluginId: string;
  version: string;
  /** 宿主共享 React：宿主树容器组件经它创建（createElement/useRef/...）；
   *  插件自有子树用自己的 createRoot 挂进容器（双段挂载模式）。 */
  react: typeof import("react");
  ui: {
    registerConversationMode(def: {
      key?: string;
      label: () => string;
      component: ComponentLike<PluginConversationProps>;
    }): Disposer;
    /** 设置页 section（权限 ui:settings-section）。 */
    registerSettingsSection(def: {
      key?: string;
      label: () => string;
      icon?: ComponentLike<{ className?: string }>;
      component: ComponentLike;
    }): Disposer;
    /** Composer「Add」菜单行（权限 ui:add-menu）。 */
    registerAddMenuRow(def: {
      key?: string;
      label: () => string;
      description?: () => string;
      icon?: ComponentLike<{ className?: string }>;
      onSelect: () => void;
    }): Disposer;
    /** Composer 工具栏插槽额外控件（权限 ui:composer-status；历史上曾要求
     *  不存在的 `ui:composer`，1.0.4 及更早版本据此拒绝一切声明，现已随
     *  spec/permissions.json 收敛为同一权限字符串）。 */
    registerComposerSlot(def: {
      slot: ComposerSlotId;
      key?: string;
      component: ComponentLike;
      order?: number;
    }): Disposer;
    /** 聊天右侧面板 tab（权限 ui:panel-tab）。插件 tab 在页签条里只渲染
     *  图标，`icon` 即用户看到的主体；缺省时回落插件素材 / 首字母瓷砖，
     *  `label` 作为 title 与可访问名。 */
    registerPanelTab(def: {
      key?: string;
      label: () => string;
      icon?: ComponentLike<{ className?: string }>;
      component: ComponentLike<{ workspacePath: string }>;
      order?: number;
    }): Disposer;
    /** 应用底部状态栏条目（权限 ui:status-bar）。 */
    registerStatusBarItem(def: {
      key?: string;
      component: ComponentLike;
      order?: number;
      /** 摆放区域（0.3.8 起）："start" = 左对齐区；缺省/"end" =
       *  同步状态之后、版本号之前的既有槽位。 */
      zone?: "start" | "end";
    }): Disposer;
    /** Composer 状态行条目（权限 ui:composer-status，0.3.9 起）：渲染在
     *  输入框状态行（分支/上下文用量那一行）左组、分支切换器之后。 */
    registerComposerStatusItem(def: {
      key?: string;
      component: ComponentLike;
      order?: number;
    }): Disposer;
    /** ⌘K 命令面板命令（权限 ui:command）。 */
    registerCommand(def: {
      key: string;
      title: () => string;
      keywords?: () => string[];
      run: () => void;
    }): Disposer;
    /** 侧栏会话右键菜单追加行（权限 ui:session-menu，0.3.5 起）；
     *  run 收到打开菜单的会话。 */
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
    /** Markdown 渲染管线追加（权限 ui:markdown）。 */
    registerMarkdownRenderer(def: {
      key?: string;
      remarkPlugins?: unknown[];
      rehypePlugins?: unknown[];
      components?: Record<string, unknown>;
    }): Disposer;
    /** 覆盖层页面，路由 `#/p/<id>`（权限 ui:page）。 */
    registerPage(def: {
      key?: string;
      title: () => string;
      component: ComponentLike;
    }): Disposer;
    /** 自定义 timeline 行 kind 渲染器（权限 ui:timeline-row）。 */
    registerTimelineRowRenderer(def: {
      kind: string;
      key?: string;
      component: ComponentLike<{ row: { kind: string } }>;
    }): Disposer;
    /** 首页侧栏导航入口，位于内建「自动化」之下（权限 ui:sidebar-entry，
     *  0.3.12 起）。onOpen 通常经 openCenterTab 打开本插件的中心页签。 */
    registerSidebarNav(def: {
      key?: string;
      label: () => string;
      icon?: ComponentLike<{ className?: string }>;
      order?: number;
      onOpen: () => void;
    }): Disposer;
    /** 中心页签定义（权限 ui:center-tab，0.3.12 起）：与会话/文件/浏览器
     *  页签共享中部页签条；打开经 openCenterTab。 */
    registerCenterTab(def: {
      key?: string;
      title: () => string;
      icon?: ComponentLike<{ className?: string }>;
      component: ComponentLike;
      order?: number;
    }): Disposer;
    /** 打开（或聚焦）本插件已注册的中心页签（权限 ui:center-tab，
     *  0.3.12 起）；页签未注册时抛错——打开失败必须可见。 */
    openCenterTab(key?: string): void;
  };
  theme: {
    /** 注入样式表（权限 theme）；拒绝 @import/远程 url。 */
    injectCss(css: string): Disposer;
    /** BoardUI token 覆盖快捷方式；key 必须是 --* 自定义属性。 */
    setTokens(tokens: { light?: Record<string, string>; dark?: Record<string, string> }): Disposer;
    /**
     * 插件可消费的宿主 token 公开契约见 @ccgui/plugin-ui 的
     * PLUGIN_UI_TOKEN_CONTRACT（packages/plugin-ui/src/tokens.ts）：清单内
     * 的 --color-…、--gradient-… 等变量宿主承诺不重命名、不删除，插件样式
     * 可安全 var() 引用（建议带 fallback）。做界面优先用 @ccgui/plugin-ui
     * 组件包，而不是手搓样式或猜变量名。
     */
  };
  i18n: {
    /** 注册语言包（权限 i18n）。 */
    addBundle(lang: string, ns: string, resources: Record<string, unknown>): Disposer;
  };
  storage: {
    /** 每插件 KV（权限 storage）。 */
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
  events: {
    /** 事件总线（权限 events）。宿主话题：`usage://updated`（引擎 usage
     *  事件透传，payload 为完整 EngineEventPayload `{ runId, sessionId,
     *  engine, seq, kind, data, ts?, genMs? }`，data 是引擎原始 usage JSON）；
     *  `usage://done`（0.3.8 起，引擎 done 事件透传，data.usage 携带
     *  该轮最终用量——claude/grok 等只经 Done 上报用量的引擎由此对插件
     *  可见）；`session://activated`（0.3.8 起，活动会话切换，payload
     *  `{ engine, sessionId }`，pending 标签 sessionId 为 null，无活动
     *  标签时两者皆 null）；`composer://draft`（payload { text }，草稿
     *  变化/清空/会话切换均发射）。
     *
     *  `genMs`（0.3.15 起，仅 `usage`/`done` 携带）：该报告对应的宿主实测
     *  生成窗口毫秒——从响应流打开到流关闭，工具执行、用户等待与轮间隔
     *  全部排除。插件按 `output tokens ÷ genMs` 即得不含工具等待的生成速度；
     *  字段缺失（旧宿主 / 未计时的报告）时回退相邻报告 `ts` 间隔。 */
    on(topic: string, cb: (data: unknown) => void): Disposer;
    emit(topic: string, data: unknown): void;
  };
  /** 聊天输入框(composer)草稿写入(权限 composer:draft,0.3.2 起)。
   *  写入即替换当前活动会话的草稿;不触发发送——发送永远是用户动作。 */
  composer: {
    setDraft(text: string): void;
  };
  /** 工作区登记(权限 host:workspace,0.3.3 起)。把任意路径登记为侧栏
   *  工作区——不要求本机存在该目录(如经 ssh 管理的远程机/WSL 发行版内
   *  路径)。meta 透传存储在宿主工作区行上(如 { wsl: { hostId, distro } }),
   *  会话/文件等宿主能力按需消费;形状由写入方与消费方约定。
   *
   *  list 返回侧栏当前的工作区行(含 worktree 子行,kind 区分),是只读快照:
   *  不含 meta、不含分组定义。需要跟随变更时重新调用,宿主不为插件广播
   *  工作区变更事件。
   *
   *  meta 携带 `wsl` 键(远程工作区,宿主引擎经 ssh 把会话流量导到
   *  meta.wsl 指定的主机与发行版)需要额外权限 `host:workspace:remote`
   *  (0.3.4 起)——这等效于出网 + 远程执行导向,远超登记一行侧栏数据。
   *  信任权衡:远程通道首连采用 StrictHostKeyChecking=accept-new
   *  (首连自动记录 host key,之后变更才拒绝),插件作者应知晓这是
   *  TOFU 而非严格 pinning。 */
  workspaces: {
    add(path: string, meta?: Record<string, unknown>): Promise<void>;
    /** 侧栏工作区快照(只读;权限 host:workspace,0.3.16 起)。worktree 子行
     *  额外带 worktree: { branch, prNumber? } 只读投影(0.3.17 起),用来把
     *  PR 绑到本地 worktree;meta 本体仍不输出。 */
    list(): Promise<PluginWorkspaceRow[]>;
  };
  /** Worktree 创建(权限 host:worktree,0.3.17 起):经宿主「新建 Worktree」
   *  管线(validate → fetch → add → register)创建,宿主侧栏出现同一份进度
   *  行与取消/重试语义;成功后 worktree 以 kind="worktree" 登记进侧栏
   *  (父行是 parentWorkspaceId 对应的工作区),resolve 已注册的路径。
   *
   *  prNumber 存在时 fetch pull/<n>/head 再检出;existingBranch 表示
   *  branch 是已存在的本地分支(检出而非新建)。路径缺省 = 宿主默认布局
   *  <仓库同级>/<仓库名>-worktrees/<branch>。
   *
   *  失败/取消以 Error reject,message 形如 "<errorKind>: <detail>"
   *  (kind 与宿主错误分类一致:not_a_repo / invalid_branch /
   *  branch_not_found / branch_exists / branch_checked_out / dir_exists /
   *  pr_not_found / fetch_failed / register_failed / sparse_checkout_empty /
   *  canceled / unknown),插件据此给用户可读文案。 */
  worktrees: {
    create(def: {
      /** 本地仓库路径(父工作区目录,必须是 git 仓库)。 */
      repoPath: string;
      /** 侧栏父工作区 id:新 worktree 作为子行挂在它下面。 */
      parentWorkspaceId: string;
      /** 新 worktree 检出的分支名。 */
      branch: string;
      /** 新建分支时的起点;缺省 = 仓库 HEAD。 */
      baseRef?: string | null;
      /** 从 PR 创建:fetch pull/<n>/head 到 branch。 */
      prNumber?: number | null;
      prTitle?: string | null;
      prUrl?: string | null;
      /** true = branch 是已存在的本地分支(检出而非新建)。 */
      existingBranch?: boolean;
    }): Promise<{ worktreePath: string }>;
  };
  /** 会话打开 + 外部会话源(权限 host:session;selectSession 0.3.3 起,
   *  registerSource 0.3.4 起)。registerSource:登记异步会话源,宿主在会话
   *  目录刷新时调用 list() 并把行合并进侧栏列表——本机扫描结果优先,同
   *  engine/sessionId/workspacePath 的外部行被丢弃。返回 Disposer,插件
   *  卸载时自动注销。 */
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
    /** 把一个 AI 轮次跑成**宿主聊天会话**(0.3.18 起,权限 host:session):
     *  会话立刻出现在侧栏(带运行中状态,不需要手动同步),打开就是实时流式
     *  输出;停止既能在聊天里点,也能用 interruptRun。会话挂在 workspacePath
     *  工作区下,模型/强度/渠道只覆盖这一轮,不动用户的全局默认。
     *
     *  与 ctx.agent.start 的分工:那个是插件自有的后台轮次(事件只回插件,
     *  不进聊天);这个就是「像用户自己发了一条」。需要用户看得见、随时
     *  能接管/停止的轮次用本方法。
     *
     *  spawn 成功后 resolve { runId, sessionId }(引擎稍后才 announce
     *  sessionId 时为 null);轮次终止经 plugin-run://<pluginId> 事件回执:
     *  { runId, sessionId, engine, workspacePath, kind: "done" | "error", error }。
     *  被用户/插件中断的轮次同样以 done 收尾。 */
    startRun(def: {
      engine: string;
      prompt: string;
      /** 会话所属工作区路径(如某个 worktree)。 */
      workspacePath: string;
      /** 本轮模型 id(ctx.agent.catalog 的 models[].id)。 */
      model?: string | null;
      /** 本轮推理强度(catalog 的 efforts 里的一档)。 */
      effort?: string | null;
      /** 本轮渠道 id(catalog 的 providers[].id)。 */
      providerId?: string | null;
    }): Promise<{ runId: string; sessionId: string | null }>;
    /** 停止 startRun 起的轮次(等价于聊天里的停止按钮)。 */
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
   *  进程——渠道注入、进程注册与聊天发送同构。事件经 `agent://<pluginId>`
   *  总线话题推送（ctx.events.on 订阅）。桌面专属。 */
  agent: {
    catalog(workspacePath: string): Promise<PluginAgentCatalogEntry[]>;
    start(def: {
      engine: string;
      prompt: string;
      workspacePath: string;
      model?: string;
      providerId?: string;
      sessionId?: string;
      readOnly?: boolean;
      requestId?: string;
    }): Promise<{ runId: string; sessionId: string | null }>;
    interrupt(runId: string): Promise<boolean>;
  };
  bridge: {
    /** 通用能力出口（0.3.0 起；旧的 `cmd:<command>` 逐命令授权机制已删除）。
     *  仅四条命令，`pluginId` 由宿主自动注入（插件无需也不能传）：
     *
     *  - `plugin_http_request` `{ method, url, headers?, body? }` →
     *    `{ status, body }`：url 限 http/https，host(+端口) 须命中 manifest 的
     *    `network:<host>` / `network:<host>:<port>` / `network:<host>:<a>-<b>` 授权
     *    （形状与放行规则以 spec/permissions.json 为准）。
     *  - `plugin_exec_run` `{ bin, args, env?, timeoutMs? }` →
     *    `{ code, stdout, stderr }`：bin 须命中 `exec:<bin>` 授权（裸名，无路径）。
     *  - `plugin_exec_spawn` `{ bin, args, env?, lifecycle? }` → void：
     *    同授权；成功时 resolve 为 void（Rust 返回 ()），失败 reject。
     *    lifecycle 缺省 "detached"（用户级服务，活过插件）；"plugin" =
     *    附属进程，宿主跟踪，插件禁用/卸载时自动 kill。
     *  - `plugin_exec_kill` `{}` → `{ killed: number }`：kill 本插件全部
     *    lifecycle="plugin" 子进程（配置变更改名重启用；需任意 exec: 授权）。
     *
     *  授权未命中的调用在 JS 侧即 reject（不打 IPC）；Rust 侧对授权与插件
     *  启用态另有强制（纵深防御）。 */
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
  host: {
    appVersion: string;
    /** 宿主实现的 SDK 版本（= @ccgui/plugin-sdk version）。 */
    sdkVersion: string;
    locale: string;
    /** Web 客户端为 true；上述桌面独占桥命令在那里不可用。 */
    isWeb: boolean;
  };
}
