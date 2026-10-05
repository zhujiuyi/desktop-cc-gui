import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import FolderInput from "lucide-react/dist/esm/icons/folder-input";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { CenteredSpinner } from "@/components/base/empty-state";
import { PluginInstalledRow } from "./PluginInstalledRow";
import {
  filterInstalledPlugins,
  INSTALLED_FILTERS,
  type InstalledFilter,
} from "./installed-filter";
import { usePluginsStore } from "../manager/usePlugins";
import { useMarketplaceStore } from "../marketplace/store";

/** 已安装 tab: the manager half of the hub — search + per-plugin controls. */
export function PluginInstalledView({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const { t } = useTranslation();
  const { installed, loaded, error, installing, refresh, installFromDirectory } =
    usePluginsStore();
  const fetchIndex = useMarketplaceStore((s) => s.fetchIndex);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InstalledFilter>("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 图标与效果图只存在市场索引里（安装记录不带 repo 与素材路径），所以
  // 直接打开「已安装」也要拉一次索引，否则本地装的插件永远只有首字母瓷砖、
  // 详情页也拿不到图集。非强制：backend 侧有 1h 缓存，市场页的刷新按钮
  // 负责强制更新。
  useEffect(() => {
    void fetchIndex();
  }, [fetchIndex]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const searched = !needle
      ? installed
      : installed.filter((plugin) =>
          [plugin.id, plugin.name, plugin.description, plugin.author]
            .join("\n")
            .toLowerCase()
            .includes(needle),
        );
    return filterInstalledPlugins(searched, filter);
  }, [installed, query, filter]);
  const filtering = query.trim().length > 0 || filter !== "all";

  return (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <div className="rounded-xl bg-background-secondary-default px-4 py-2 text-body-medium text-text-error-primary">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="px-1 text-body-medium text-text-primary">
            {t("plugins.hub.sectionInstalled")}
          </h3>
          <Select
            aria-label={t("plugins.hub.installedFilter.label")}
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(String(key) as InstalledFilter)}
            triggerClassName="min-w-32"
          >
            {INSTALLED_FILTERS.map((option) => (
              <SelectItem key={option} id={option}>
                {t(`plugins.hub.installedFilter.${option}`)}
              </SelectItem>
            ))}
          </Select>
        </div>
        <Input
          value={query}
          onChange={setQuery}
          placeholder={t("plugins.hub.searchPlaceholder")}
          className="w-60 max-w-full"
        />
      </div>
      <div className="flex flex-col divide-y divide-separator-border rounded-2xl border border-separator-border bg-background-primary-default">
        {!loaded ? (
          <CenteredSpinner className="py-16" />
        ) : filtered.length > 0 ? (
          filtered.map((plugin) => (
            <PluginInstalledRow key={plugin.id} plugin={plugin} onOpenDetail={onOpenDetail} />
          ))
        ) : installed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12">
            <p className="text-body-regular text-text-tertiary">
              {t("plugins.hub.emptyInstalled")}
            </p>
            <button
              type="button"
              disabled={!!installing}
              onClick={() => void installFromDirectory()}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-background-secondary-default px-3 py-1.5 text-body-medium text-text-primary transition-colors hover:bg-background-secondary-hover disabled:cursor-wait disabled:opacity-70"
            >
              {installing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FolderInput className="size-4" aria-hidden />
              )}
              {t("plugins.hub.installLocal")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-12">
            <p className="text-body-regular text-text-tertiary">{t("plugins.hub.noMatch")}</p>
            {filtering && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="cursor-pointer rounded-lg bg-background-secondary-default px-3 py-1.5 text-body-2-medium text-text-primary transition-colors hover:bg-background-secondary-hover"
              >
                {t("plugins.hub.clearFilters")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
