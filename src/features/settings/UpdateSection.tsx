import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { getAppVersion } from "@/lib/platform";

/** Update page on the self-built line: app identity + version only. In-app
 *  updates are disabled outright — the auto check, the manual entry points
 *  and the updater endpoint are all gone (见 update/store.ts 的
 *  UPDATES_DISABLED)——so the row states that instead of offering an action
 *  that could overwrite the custom build. */
export function UpdateSection() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppVersion()
      .then((v) => {
        if (!cancelled && v) setVersion(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* App identity + version */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>{t("settings.selfBuilt")}</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow
            anchor="appVersion"
            label={t("settings.selfBuiltName")}
            description={t("settings.selfBuiltDesc")}
          >
            <span className="text-body-regular text-text-secondary">
              {version ? `v${version}` : "…"}
            </span>
          </SettingsRow>
        </SettingsCard>
      </div>
    </div>
  );
}
