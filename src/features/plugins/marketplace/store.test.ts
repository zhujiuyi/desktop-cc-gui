import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeaturedPlugin, MarketPlugin, PluginInfo } from "@/lib/ipc";
import type { PluginInstallProgress } from "@/lib/events";

const pluginFetchIndex = vi.fn(async (_force = false): Promise<MarketPlugin[]> => []);
const pluginFetchFeatured = vi.fn(async (_force = false): Promise<FeaturedPlugin[]> => []);
const pluginCheckUpdates = vi.fn(async () => [] as { id: string }[]);
const pluginInstallFromMarketplace = vi.fn();
vi.mock("@/lib/ipc", () => ({
  ipc: {
    pluginFetchIndex: (force: boolean) => pluginFetchIndex(force),
    pluginFetchFeatured: (force: boolean) => pluginFetchFeatured(force),
    pluginCheckUpdates: () => pluginCheckUpdates(),
    pluginInstallFromMarketplace: (id: string) => pluginInstallFromMarketplace(id),
  },
}));

let progressCb: ((p: PluginInstallProgress) => void) | null = null;
const unlisten = vi.fn();
vi.mock("@/lib/events", () => ({
  listenPluginInstallProgress: vi.fn(async (cb: (p: PluginInstallProgress) => void) => {
    progressCb = cb;
    return unlisten;
  }),
}));

const loadPlugin = vi.fn(async (_args: unknown) => {});
const reloadPlugin = vi.fn(async (_args: unknown) => {});
vi.mock("../runtime/loader", () => ({
  loadPlugin: (args: unknown) => loadPlugin(args),
  reloadPlugin: (args: unknown) => reloadPlugin(args),
}));

const refreshInstalled = vi.fn(async () => {});
vi.mock("../manager/usePlugins", () => ({
  usePluginsStore: { getState: () => ({ refresh: refreshInstalled }) },
}));

// vi.mock calls above are hoisted, so this static import sees the mocks.
import { useMarketplaceStore } from "./store";

function entry(over: Partial<MarketPlugin> = {}): MarketPlugin {
  return {
    id: "react-doctor",
    repo: "zhukunpenglinyutong/ccgui-plugin-react-doctor",
    name: "React Doctor",
    description: "",
    author: "zhukunpenglinyutong",
    tier: "js",
    version: "0.2.0",
    minAppVersion: "1.0.0",
    sdkVersion: "^0.3",
    permissions: ["storage"],
    downloads: null,
    screenshots: [],
    icon: null,
    updatedAt: null,
    ...over,
  };
}

function installedInfo(over: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: "react-doctor",
    name: "React Doctor",
    version: "0.2.0",
    description: "",
    author: "",
    tier: "js",
    source: "marketplace",
    enabled: true,
    quarantined: false,
    lastError: null,
    permissions: ["storage"],
    installedAt: 0,
    minAppVersion: "1.0.0",
    icon: null,
    screenshots: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  progressCb = null;
  useMarketplaceStore.setState({
    entries: [],
    featured: [],
    loaded: false,
    error: null,
    updates: [],
    installing: null,
  });
});

describe("fetchIndex", () => {
  it("stores the listing on success", async () => {
    pluginFetchIndex.mockResolvedValueOnce([entry()]);

    await useMarketplaceStore.getState().fetchIndex();

    expect(useMarketplaceStore.getState().entries).toHaveLength(1);
    expect(useMarketplaceStore.getState().loaded).toBe(true);
    expect(useMarketplaceStore.getState().error).toBeNull();
  });

  it("surfaces the error when the index fetch fails", async () => {
    pluginFetchIndex.mockRejectedValueOnce(new Error("offline"));

    await useMarketplaceStore.getState().fetchIndex();

    expect(useMarketplaceStore.getState().error).toContain("offline");
    expect(useMarketplaceStore.getState().loaded).toBe(true);
  });

  it("loads the featured list after the index (one index fetch, not two)", async () => {
    const order: string[] = [];
    pluginFetchIndex.mockImplementationOnce(async () => {
      order.push("index");
      return [entry()];
    });
    pluginFetchFeatured.mockImplementationOnce(async (force) => {
      order.push("featured");
      expect(force).toBe(true); // 手动刷新要把精选一起刷掉，否则轮播会停在旧文案
      return [{ id: "react-doctor", tagline: "一句话", note: null, image: null }];
    });

    await useMarketplaceStore.getState().fetchIndex(true);

    // 顺序有意义：featured 的 id 校验读的是刚写好的索引缓存，并行会多拉一遍索引
    expect(order).toEqual(["index", "featured"]);
    expect(useMarketplaceStore.getState().featured).toHaveLength(1);
  });

  it("keeps the table usable when the featured file is unavailable", async () => {
    pluginFetchIndex.mockResolvedValueOnce([entry()]);
    pluginFetchFeatured.mockRejectedValueOnce(new Error("404"));

    await useMarketplaceStore.getState().fetchIndex();

    expect(useMarketplaceStore.getState().error).toBeNull();
    expect(useMarketplaceStore.getState().entries).toHaveLength(1);
    expect(useMarketplaceStore.getState().featured).toEqual([]);
  });

  it("keeps the last featured list when the index refresh fails (offline tolerance)", async () => {
    useMarketplaceStore.setState({
      featured: [{ id: "react-doctor", tagline: "旧文案", note: null, image: null }],
    });
    pluginFetchIndex.mockRejectedValueOnce(new Error("offline"));

    await useMarketplaceStore.getState().fetchIndex();

    // 与 entries 同一取舍：刷新失败时表格继续显示上一次的数据，精选也不清空
    expect(pluginFetchFeatured).not.toHaveBeenCalled();
    expect(useMarketplaceStore.getState().featured).toHaveLength(1);
  });
});

describe("checkUpdates", () => {
  it("keeps the previous list when the check fails (offline tolerance)", async () => {
    useMarketplaceStore.setState({
      updates: [{ id: "react-doctor", currentVersion: "0.1.0", latestVersion: "0.2.0" }],
    });
    pluginCheckUpdates.mockRejectedValueOnce(new Error("offline"));

    await useMarketplaceStore.getState().checkUpdates();

    expect(useMarketplaceStore.getState().updates).toHaveLength(1);
    expect(useMarketplaceStore.getState().error).toBeNull();
  });
});

describe("install", () => {
  it("hot-reloads an enabled plugin and refreshes installed state and updates", async () => {
    pluginInstallFromMarketplace.mockResolvedValue(installedInfo());

    await useMarketplaceStore.getState().install("react-doctor");

    expect(pluginInstallFromMarketplace).toHaveBeenCalledWith("react-doctor");
    expect(reloadPlugin).toHaveBeenCalledOnce();
    expect(refreshInstalled).toHaveBeenCalledOnce();
    expect(pluginCheckUpdates).toHaveBeenCalled();
    expect(useMarketplaceStore.getState().installing).toBeNull();
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it("does not activate a plugin the user had disabled (update keeps the flag)", async () => {
    pluginInstallFromMarketplace.mockResolvedValue(installedInfo({ enabled: false }));

    await useMarketplaceStore.getState().install("react-doctor");

    expect(reloadPlugin).not.toHaveBeenCalled();
  });

  it("re-activates the already-running instance instead of no-op loading (update hot swap)", async () => {
    // Regression: loadPlugin early-returns for an already-active id, so an
    // update stayed on the old bytes until a manual disable/enable or app
    // restart. The update path must reload the running instance.
    pluginInstallFromMarketplace.mockResolvedValue(installedInfo({ version: "0.3.0" }));

    await useMarketplaceStore.getState().install("react-doctor");

    expect(reloadPlugin).toHaveBeenCalledWith({ info: installedInfo({ version: "0.3.0" }) });
    expect(loadPlugin).not.toHaveBeenCalled();
  });

  it("tracks progress events against the installing entry", async () => {
    const gate = Promise.withResolvers<PluginInfo>();
    pluginInstallFromMarketplace.mockReturnValue(gate.promise);

    const pending = useMarketplaceStore.getState().install("react-doctor");
    await vi.waitFor(() => expect(progressCb).not.toBeNull());
    progressCb!({ done: 5, total: 10, finished: false });
    expect(useMarketplaceStore.getState().installing).toEqual({ id: "react-doctor", done: 5, total: 10 });

    gate.resolve(installedInfo());
    await pending;
    expect(useMarketplaceStore.getState().installing).toBeNull();
  });

  it("refuses a second concurrent install (single progress channel)", async () => {
    const gate = Promise.withResolvers<PluginInfo>();
    pluginInstallFromMarketplace.mockReturnValue(gate.promise);

    const first = useMarketplaceStore.getState().install("react-doctor");
    await vi.waitFor(() => expect(useMarketplaceStore.getState().installing).not.toBeNull());
    await useMarketplaceStore.getState().install("other-plugin");

    expect(pluginInstallFromMarketplace).toHaveBeenCalledTimes(1);

    gate.resolve(installedInfo());
    await first;
  });

  it("clears installing and surfaces the error on failure (bad hash etc.)", async () => {
    pluginInstallFromMarketplace.mockRejectedValue(new Error("SHA-256 mismatch"));

    await useMarketplaceStore.getState().install("react-doctor");

    expect(useMarketplaceStore.getState().installing).toBeNull();
    expect(useMarketplaceStore.getState().error).toContain("SHA-256 mismatch");
    expect(reloadPlugin).not.toHaveBeenCalled();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
