/* 自动生成：CC GUI 插件索引真实快照（docs/design 设计稿专用数据）
 * 来源 zhukunpenglinyutong/ccgui-plugins@main ：community-plugins.json + plugins/{id}.json + download-counts.json
 * 抓取时间：2026-10-08 · 名称/描述/作者/版本/分类/安装量/素材全部来自线上，无手写；
 * 仅 installed[] 是按应用截图复现的本地安装状态，以及 session-notes 的「可更新」是为了演示更新态而虚构的。 */
window.MOCK = {
  source: "zhukunpenglinyutong/ccgui-plugins@main · 2026-10-08",
  plugins: [
    {"id":"ai-quota-monitor","name":"AI 配额与用量监控","desc":"当前支持 Google Antigravity（Gemini）和 OpenAI Codex，查看可用额度、用量与重置时间；其他 AI 服务待适配。支持底部状态栏、详情弹窗、自动刷新及当前会话联动。","author":"libo-zhou","official":false,"tier":null,"version":"v0.3.1","cat":"other","scene":"naming","downloads":34,"repo":"libo-zhou/ccgui-plugin-ai-quota-monitor","icon":null,"shots":["docs/codex-quota.png"]},
    {"id":"auto-title","name":"会话自动命名","desc":"每轮对话结束后用本机 CLI 或 DeepSeek 生成「emoji + 对象｜目标」式会话标题，支持 codex / omp / pi / claude；不覆盖手动改名，可暂停、可只命名一次。","author":"zhukunpenglinyutong","official":true,"tier":null,"version":"v0.7.1","cat":"productivity","scene":"chart","downloads":573,"repo":"zhukunpenglinyutong/ccgui-plugin-auto-title","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png","docs/screenshot-3.png"]},
    {"id":"balance-meter","name":"余额与余量","desc":"按当前引擎实际在用的网关识别供应商与计费方式：API 查余额、订阅查余量；已支持 ChatGPT、Claude、OpenCode Go、Kimi、智谱、MiniMax、Grok 等订阅渠道，没有可用接口时明确提示；支持手动刷新与每轮对话后自动刷新。","author":"zhujiuyi","official":false,"tier":null,"version":"v0.2.2","cat":"integration","scene":"providers","downloads":282,"repo":"zhujiuyi/ccgui-plugin-balance-meter","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png","docs/screenshot-3.png"]},
    {"id":"claude-ip-check","name":"Claude IP 检查","desc":"查看访问 Claude 的出口 IP、纯净度、地理与风险信号：三路出口 IP、信任评分、安全检测、DNS / WebRTC 泄露、设备信息与 IP 历史。移植自 TokenTracker。","author":"zhukunpenglinyutong","official":true,"tier":null,"version":"v1.0.0","cat":"productivity","scene":"chart","downloads":110,"repo":"zhukunpenglinyutong/ccgui-plugin-claude-ip-check","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
    {"id":"composer-rainbow-border","name":"彩虹跑马灯边界线","desc":"对话运行中为聊天输入框添加沿边界持续流动的彩虹跑马灯效果，空闲时恢复常规边框。","author":"libo-zhou","official":false,"tier":"轻量插件","version":"v1.1.0","cat":"appearance","scene":"chart","downloads":515,"repo":"libo-zhou/ccgui-plugin-composer-rainbow-border","icon":null,"shots":[]},
    {"id":"engine-hopper","name":"引擎接力","desc":"在同一对话中随时切换引擎与模型：自动整理完整对话上下文并智能分层交接，新引擎无缝续聊；支持接力链回跳与增量续接。","author":"wszbest68-gif","official":false,"tier":null,"version":"v0.1.2","cat":"integration","scene":"providers","downloads":269,"repo":"wszbest68-gif/ccgui-plugin-engine-hopper","icon":null,"shots":[]},
    {"id":"file-drag-upload","name":"文件拖拽上传","desc":"拖拽文件到聊天窗口，支持预览、删除和重新排序","author":"wszbest68-gif","official":false,"tier":null,"version":"v1.0.0","cat":"other","scene":"naming","downloads":21,"repo":"wszbest68-gif/ccgui-plugin-file-drag-upload","icon":null,"shots":[]},
    {"id":"font-tuner","name":"字体调校","desc":"自定义窗口界面字体、对话内容字体与代码字体，并可配置字号、行高、字距、字体平滑与文本渲染方式。","author":"3774929","official":false,"tier":null,"version":"v0.3.0","cat":"dev","scene":"ring","downloads":27,"repo":"3774929/ccgui-plugin-font-tuner","icon":null,"shots":[]},
    {"id":"model-switcher","name":"模型与供应商助手","desc":"模型与 CLI 选择、供应商渠道切换、独立渠道管理、全局主题、会话模型显示、幕布链接跳转，以及可选的 Claude Agent SDK 提示词清洗。","author":"Guardian-J","official":false,"tier":null,"version":"v1.0.35","cat":"integration","scene":"providers","downloads":736,"repo":"Guardian-J/ccgui-plugin-model-switcher","icon":null,"shots":[]},
    {"id":"port-manager","name":"端口管理","desc":"按工作区分组展示本机监听中的 TCP 端口，分组可折叠，支持一键打开浏览器和关闭端口；自动适配 macOS / Linux / Windows，纯本地执行不出网。","author":"hekai753","official":false,"tier":null,"version":"v0.3.0","cat":"other","scene":"naming","downloads":36,"repo":"hekai753/port-manager","icon":null,"shots":[]},
    {"id":"prompt-enhancer","name":"提示词增强","desc":"默认使用专用文本 API 增强提示词，支持 OpenAI 兼容、Responses、Claude、Gemini；可选引擎模式，预览后写回。","author":"wszbest68-gif","official":false,"tier":null,"version":"v0.5.1","cat":"integration","scene":"providers","downloads":40,"repo":"wszbest68-gif/ccgui-plugin-prompt-enhancer","icon":null,"shots":[]},
    {"id":"react-doctor","name":"React Doctor","desc":"一键运行 npx react-doctor@latest 代码体检：评分环、错误/警告统计、按文件分组的问题列表与修复建议、原始输出，结果本地持久化；非满分时可「一键修复」把问题清单填入聊天输入框。","author":"zhukunpenglinyutong","official":true,"tier":null,"version":"v0.3.1","cat":"dev","scene":"ring","downloads":318,"repo":"zhukunpenglinyutong/ccgui-plugin-react-doctor","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png"]},
    {"id":"service-status","name":"服务状态","desc":"在中心页签聚合 Claude / OpenAI / Cursor / GitHub / Gemini / Kimi / MiniMax / Zed 官方状态页的实时事故状态，每分钟自动刷新。","author":"zhukunpenglinyutong","official":true,"tier":null,"version":"v1.0.0","cat":"dev","scene":"ring","downloads":131,"repo":"zhukunpenglinyutong/ccgui-plugin-service-status","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
    {"id":"session-notes","name":"会话便签","desc":"给任意会话贴上本地便签：右侧面板编辑当前会话备注、右键菜单直达、列表统一管理，数据仅存本机。","author":"wszbest68-gif","official":false,"tier":null,"version":"v0.1.0","cat":"other","scene":"naming","downloads":99,"repo":"wszbest68-gif/ccgui-plugin-session-notes","icon":null,"shots":[]},
    {"id":"session-rainbow-border","name":"工作区对话跑马灯","desc":"左侧面板工作区各对话运行中时，为正在工作的对话列表项添加渐变旋转、闪灭呼吸、炽热烈焰等多种光效边框，支持设置面板自由切换与实时预览。","author":"zsw118-sw","official":false,"tier":null,"version":"v2.0.0","cat":"appearance","scene":"chart","downloads":48,"repo":"zsw118-sw/ccgui-plugin-session-rainbow-border","icon":null,"shots":[]},
    {"id":"token-meter","name":"Token 速度表","desc":"composer 状态行实时显示 token 输出速度与缓存命中率，支持全部 11 个 CLI 引擎。","author":"zhukunpenglinyutong","official":true,"tier":null,"version":"v0.1.3","cat":"productivity","scene":"chart","downloads":541,"repo":"zhukunpenglinyutong/ccgui-plugin-token-meter","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
    {"id":"window-model-assistant","name":"窗口与模型助手","desc":"仅管理 CC GUI 主窗口的位置与大小（自动恢复/保存/建议尺寸/微信采样，不动其他窗口），并按引擎与来源透明展示宿主公开的服务商模型目录；初始加载不出网，手动刷新才访问服务商接口，失败缓存降级并标注原因。","author":"wszbest68-gif","official":false,"tier":null,"version":"v0.1.2","cat":"integration","scene":"providers","downloads":141,"repo":"wszbest68-gif/ccgui-plugin-window-model-assistant","icon":null,"shots":[]},
    {"id":"wsl","name":"WSL 管理器","desc":"WSL 发行版管理器:本机诊断与设默认、引擎探针、远程宿主(密码/key)、WSL 工作区登记、发行版内文件面板,claude/codex/omp 会话列表与历史回放。","author":"chenxiangning","official":false,"tier":null,"version":"v0.4.6","cat":"dev","scene":"ring","downloads":177,"repo":"chenxiangning/ccgui-plugin-wsl","icon":null,"shots":[]},
  ],
  featured: [
    { id: "model-switcher", tagline: "一个入口切遍所有渠道：模型、CLI、供应商、会话级覆盖", note: "最多人用它解决的其实是「换 key 不用重启」。" },
    { id: "auto-title", tagline: "再也不用给会话起名字", note: "官方出品，零配置：装完就生效。" },
    { id: "token-meter", tagline: "把「等得值不值」变成两个数字", note: "输出速度与缓存命中率，直接长在 composer 上。" },
    { id: "react-doctor", tagline: "一条命令，给前端项目做一次体检", note: "评分环 + 逐文件定位，适合发版前跑一次。" },
    { id: "engine-hopper", tagline: "对话中途换引擎，上下文不丢", note: "社区作者 @wszbest68-gif 的作品，一周内安装量翻倍。" },
    { id: "balance-meter", tagline: "余额这件事，不该靠开网页查", note: "按网关识别计费方式：API 查余额、订阅查余量。" },
  ],
  collections: [
    {"id":"official","title":"官方出品","sub":"CC GUI 团队维护，随版本一起升级","items":["auto-title","token-meter","react-doctor","service-status","claude-ip-check"]},
    {"id":"new","title":"本周新上架","sub":"按首次提交时间排序","items":["ai-quota-monitor","file-drag-upload","port-manager","font-tuner","session-rainbow-border"]},
  ],
  installed: ["auto-title","token-meter","composer-rainbow-border","react-doctor","balance-meter","service-status","claude-ip-check","session-notes"],
  art: {
    "ai-quota-monitor": {"repo":"libo-zhou/ccgui-plugin-ai-quota-monitor","icon":null,"shots":["docs/codex-quota.png"]},
    "auto-title": {"repo":"zhukunpenglinyutong/ccgui-plugin-auto-title","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png","docs/screenshot-3.png"]},
    "balance-meter": {"repo":"zhujiuyi/ccgui-plugin-balance-meter","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png","docs/screenshot-3.png"]},
    "claude-ip-check": {"repo":"zhukunpenglinyutong/ccgui-plugin-claude-ip-check","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
    "react-doctor": {"repo":"zhukunpenglinyutong/ccgui-plugin-react-doctor","icon":"docs/icon.png","shots":["docs/screenshot-1.png","docs/screenshot-2.png"]},
    "service-status": {"repo":"zhukunpenglinyutong/ccgui-plugin-service-status","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
    "token-meter": {"repo":"zhukunpenglinyutong/ccgui-plugin-token-meter","icon":"docs/icon.png","shots":["docs/screenshot-1.png"]},
  },
  /* 演示态：session-notes 虚构一个可更新版本 */
  updates: { "session-notes": "0.2.0" },
};
