import { describe, expect, it } from "vitest";
import type { PluginInfo } from "@/lib/ipc";
import { filterInstalledPlugins, RECENT_INSTALL_WINDOW_SECS } from "./installed-filter";

/** Unix 秒，和 backend 的 installedAt 同单位。 */
const NOW = 1_800_000_000;

function plugin(overrides: Partial<PluginInfo> & { id: string }): PluginInfo {
  return {
    name: overrides.id,
    version: "1.0.0",
    description: "",
    author: "",
    tier: "js",
    source: "marketplace",
    enabled: true,
    quarantined: false,
    lastError: null,
    permissions: [],
    installedAt: NOW,
    minAppVersion: null,
    icon: null,
    screenshots: [],
    ...overrides,
  };
}

describe("filterInstalledPlugins", () => {
  const freshMarket = plugin({ id: "a-market", source: "marketplace", installedAt: NOW - 3600 });
  const freshLocal = plugin({ id: "b-local", source: "local", installedAt: NOW - 60 });
  const boundary = plugin({
    id: "c-boundary",
    source: "local",
    installedAt: NOW - RECENT_INSTALL_WINDOW_SECS,
  });
  const stale = plugin({
    id: "d-stale",
    source: "local",
    installedAt: NOW - RECENT_INSTALL_WINDOW_SECS - 1,
  });
  const builtin = plugin({ id: "e-builtin", source: "builtin", installedAt: 0 });
  const all = [stale, freshMarket, builtin, boundary, freshLocal];

  it("全部原样返回，保持后端顺序", () => {
    expect(filterInstalledPlugins(all, "all", NOW)).toBe(all);
  });

  it("市场安装 / 本地安装按记录来源收窄", () => {
    expect(filterInstalledPlugins(all, "marketplace", NOW).map((p) => p.id)).toEqual([
      "a-market",
    ]);
    // 来源筛选不改变后端顺序（只有 `recent` 按安装时间重排）。
    expect(filterInstalledPlugins(all, "local", NOW).map((p) => p.id)).toEqual([
      "d-stale",
      "c-boundary",
      "b-local",
    ]);
  });

  it("最近安装 = 3 天窗口内（恰好满 3 天算内），按安装时间倒序", () => {
    // 时间窗边界含当天：c-boundary 距 now 正好一个窗口，仍在列表里；
    // d-stale 多出 1 秒就被排除。e-builtin 没有时间戳（0），不算安装。
    expect(filterInstalledPlugins(all, "recent", NOW).map((p) => p.id)).toEqual([
      "b-local",
      "a-market",
      "c-boundary",
    ]);
  });

  it("不修改传入数组", () => {
    const order = all.map((p) => p.id);
    filterInstalledPlugins(all, "recent", NOW);
    expect(all.map((p) => p.id)).toEqual(order);
    expect(all).toHaveLength(5);
  });
});
