import type { PluginInfo } from "@/lib/ipc";

/**
 * 「已安装」页头的筛选。`recent` 是时间窗而不是来源：最近 3 天内安装的
 * 插件按安装时间倒序；其余三项保持后端返回的 id 序。
 */
export type InstalledFilter = "all" | "recent" | "marketplace" | "local";

/** 下拉里的顺序；`all` 是默认态，也是「清除筛选」的复位目标。 */
export const INSTALLED_FILTERS: InstalledFilter[] = [
  "all",
  "recent",
  "marketplace",
  "local",
];

/** 「最近安装」窗口：3 天（秒）。 */
export const RECENT_INSTALL_WINDOW_SECS = 3 * 24 * 60 * 60;

/**
 * `installedAt` 是 backend 的 Unix 秒（`src-tauri/src/plugins/state.rs` 的
 * `now_secs`），不是毫秒；重装 / 更新保留首次安装时间，所以一次更新不会把
 * 旧插件顶进「最近安装」。`now` 可注入以便测试时间窗边界。
 */
export function filterInstalledPlugins(
  plugins: PluginInfo[],
  filter: InstalledFilter,
  now: number = Math.floor(Date.now() / 1000),
): PluginInfo[] {
  switch (filter) {
    case "all":
      return plugins;
    case "recent":
      // 未落时间戳（builtin 的 state-only 记录）不算「最近安装」。
      return plugins
        .filter(
          (plugin) =>
            plugin.installedAt > 0 && now - plugin.installedAt <= RECENT_INSTALL_WINDOW_SECS,
        )
        .sort((a, b) => b.installedAt - a.installedAt);
    case "marketplace":
      return plugins.filter((plugin) => plugin.source === "marketplace");
    case "local":
      return plugins.filter((plugin) => plugin.source === "local");
  }
}
