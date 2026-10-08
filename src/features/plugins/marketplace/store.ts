import { create } from "zustand";
import { ipc, type FeaturedPlugin, type MarketPlugin, type PluginUpdate } from "@/lib/ipc";
import { listenPluginInstallProgress } from "@/lib/events";
import { reloadPlugin } from "../runtime/loader";
import { usePluginsStore } from "../manager/usePlugins";

/**
 * Marketplace state (plan §6.3): the GitHub index listing, the update check
 * result, and the one-at-a-time install/update flow. Installed-state merging
 * happens in the components against usePluginsStore — this store only owns
 * market-side data, so the two never drift on who wins a field.
 */
interface MarketplaceStore {
  entries: MarketPlugin[];
  /** 编辑精选（方案 A 轮播）。软依赖：拉不到就是空数组，轮播区整体不渲染。
   *  与 entries 同一次刷新一起变；列表长度由后端封顶。 */
  featured: FeaturedPlugin[];
  loaded: boolean;
  error: string | null;
  /** Installed marketplace plugins with a newer indexed version. */
  updates: PluginUpdate[];
  /** Non-null while a marketplace install/update runs; done/total are bytes. */
  installing: { id: string; done: number; total: number } | null;
  fetchIndex: (force?: boolean) => Promise<void>;
  checkUpdates: () => Promise<void>;
  /** Install a new plugin or update an installed one — same backend command:
   *  the transaction swaps the directory and revives the enabled flag. */
  install: (id: string) => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceStore>((set, get) => ({
  entries: [],
  featured: [],
  loaded: false,
  error: null,
  updates: [],
  installing: null,

  fetchIndex: async (force = false) => {
    try {
      set({ entries: await ipc.pluginFetchIndex(force), loaded: true, error: null });
    } catch (error) {
      set({ error: String(error), loaded: true });
      return;
    }
    // 精选后取，且与索引串行：featured 的 id 校验读的是刚写好的索引缓存，
    // 并行会多拉一遍 18 条详情。失败只清空轮播，不动 error（表格已经画好了，
    // 一份拿不到的装饰数据不应该弹出错误横幅）。
    try {
      set({ featured: await ipc.pluginFetchFeatured(force) });
    } catch {
      set({ featured: [] });
    }
  },

  checkUpdates: async () => {
    try {
      set({ updates: await ipc.pluginCheckUpdates() });
    } catch {
      // Offline / index hiccup: stale (or empty) update hints are fine, the
      // market page surfaces fetch errors through fetchIndex instead.
    }
  },

  install: async (id) => {
    if (get().installing) return; // one at a time: progress is a single channel
    set({ installing: { id, done: 0, total: 0 }, error: null });
    const unlisten = await listenPluginInstallProgress((p) => {
      set((state) =>
        state.installing ? { installing: { ...state.installing, done: p.done, total: p.total } } : state,
      );
    });
    try {
      const info = await ipc.pluginInstallFromMarketplace(id);
      // Fresh installs default to enabled; a re-install (update) keeps the
      // user's flag — either way an enabled plugin activates immediately.
      // reloadPlugin (not loadPlugin): an update targets an id that is very
      // likely already active, and loadPlugin early-returns for those, so the
      // new bytes only took effect after a manual disable/enable or app
      // restart. Reload unloads the running instance first, then activates
      // the freshly read bundle — registries are built for that overwrite.
      if (info.enabled) await reloadPlugin({ info });
      await usePluginsStore.getState().refresh();
      await get().checkUpdates();
    } catch (error) {
      set({ error: String(error) });
    } finally {
      unlisten();
      set({ installing: null });
    }
  },
}));
