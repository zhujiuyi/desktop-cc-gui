import { useTranslation } from "react-i18next";
import Check from "lucide-react/dist/esm/icons/check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Button } from "@/components/base/buttons/button";
import { isWeb } from "@/lib/platform";
import type { MarketPlugin } from "@/lib/ipc";
import { usePluginsStore } from "../manager/usePlugins";
import { useMarketplaceStore } from "../marketplace/store";

/**
 * 安装中占位：形状跟着它替换掉的按钮走（same size / radius / height），
 * 行与精选卡的按钮不会在安装期间抖动。
 */
const INSTALLING = {
  small: "flex h-8 items-center gap-1.5 rounded-lg border border-border-button-default bg-background-primary-default px-2.5 text-body-2-medium whitespace-nowrap text-text-tertiary",
  medium:
    "flex h-9 items-center gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-body-medium whitespace-nowrap text-text-tertiary",
} as const;

/**
 * One action button per market state — installing shows the byte progress, an
 * indexed update wins over the plain installed state, an installed plugin
 * opens its details (settings / uninstall live there), anything else installs.
 *
 * Shared by the market table row and the featured carousel so the two can
 * never disagree about what "已安装" means.
 */
export function MarketActionButton({
  entry,
  onOpenDetail,
  size = "small",
  className,
}: {
  entry: MarketPlugin;
  onOpenDetail: (id: string) => void;
  /** `medium` is the carousel CTA; the table row keeps its `small` step. */
  size?: "small" | "medium";
  className?: string;
}) {
  const { t } = useTranslation();
  const installed = usePluginsStore((s) => s.installed.some((p) => p.id === entry.id));
  const update = useMarketplaceStore((s) => s.updates.find((u) => u.id === entry.id));
  const installing = useMarketplaceStore((s) =>
    s.installing?.id === entry.id ? s.installing : null,
  );
  const install = useMarketplaceStore((s) => s.install);

  if (installing) {
    const pct =
      installing.total > 0 ? Math.round((installing.done / installing.total) * 100) : null;
    return (
      <button type="button" disabled className={INSTALLING[size]}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {pct != null ? t("plugins.installingPct", { pct }) : t("plugins.installing")}
      </button>
    );
  }

  if (installed && update) {
    return (
      <Button
        variant="primary"
        size={size}
        className={className}
        disabled={isWeb}
        title={isWeb ? t("plugins.market.desktopOnly") : undefined}
        onClick={() => void install(entry.id)}
      >
        {t("plugins.hub.updateTo", { version: update.latestVersion })}
      </Button>
    );
  }

  // Installed and current (builtins included — they never update): the detail
  // page is where settings and uninstall live, so the button opens it.
  if (installed) {
    return (
      <Button
        variant="ghost"
        size={size}
        className={className}
        leadingIcon={Check}
        title={t("plugins.hub.installedHint")}
        onClick={() => onOpenDetail(entry.id)}
      >
        {t("plugins.hub.installed")}
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size={size}
      className={className}
      disabled={isWeb}
      title={isWeb ? t("plugins.market.desktopOnly") : t("plugins.hub.install")}
      onClick={() => void install(entry.id)}
    >
      {t("plugins.hub.install")}
    </Button>
  );
}
