import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { ConfirmDialog } from "@/components/dialogs";
import { ipc } from "@/lib/ipc";
import { isWeb } from "@/lib/transport";
import { ROW_ACTION } from "./WorkspaceGroupRow";

/**
 * On-demand directory grants (lib/grant.ts flow); desktop-only commands, so
 * the card stays hidden for web-access clients. Loads the granted roots
  * itself and reports load/revoke failures through `onError`. */
export function GrantedRootsCard({
  onError,
  onClearError,
}: {
  onError: (e: unknown) => void;
  onClearError: () => void;
}) {
  const { t } = useTranslation();
  const [grantedRoots, setGrantedRoots] = useState<string[] | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (isWeb) return;
    let cancelled = false;
    ipc
      .listGrantedRoots()
      .then((roots) => {
        if (!cancelled) setGrantedRoots(roots);
      })
      // A load failure here must not block group editing; same surface.
      .catch(onError);
    return () => {
      cancelled = true;
    };
  }, [onError]);

  return (
    <>
      {!isWeb && grantedRoots && grantedRoots.length > 0 && (
        <div className="flex w-full flex-col gap-2">
          <SettingsSectionLabel anchor="grantedRoots">
            {t("settings.grantedRoots")}
            <span className="ml-2 text-body-2-regular font-normal text-text-tertiary">
              {t("settings.grantedRootsDesc")}
            </span>
          </SettingsSectionLabel>
          <SettingsCard>
            {grantedRoots.map((dir) => (
              <SettingsRow key={dir} label={dir}>
                <button
                  type="button"
                  aria-label={t("settings.revokeAccess")}
                  title={t("settings.revokeAccess")}
                  onClick={() => setRevoking(dir)}
                  className={`${ROW_ACTION} hover:text-text-error-primary`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </SettingsRow>
            ))}
          </SettingsCard>
        </div>
      )}

      {revoking && (
        <ConfirmDialog
          danger
          message={t("settings.revokeAccessConfirm", { dir: revoking })}
          onCancel={() => setRevoking(null)}
          onConfirm={() => {
            const dir = revoking;
            setRevoking(null);
            onClearError();
            void ipc
              .revokeGrantedRoot(dir)
              .then(() =>
                setGrantedRoots((roots) => roots?.filter((r) => r !== dir) ?? roots),
              )
              .catch(onError);
          }}
        />
      )}
    </>
  );
}
