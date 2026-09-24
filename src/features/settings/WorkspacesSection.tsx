import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Key } from "react";
import { useShallow } from "zustand/react/shallow";
import Plus from "lucide-react/dist/esm/icons/plus";
import {
  SettingsCard,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { WorkspaceSortableList } from "@/components/application/ai-chat/workspace-sortable-list";
import { Button } from "@/components/base/buttons/button";
import { ConfirmDialog } from "@/components/dialogs";
import type { WorkspaceGroup } from "@/lib/ipc";
import { useChatStore, sortedWorkspaceGroups } from "@/features/chat/store";
import { ROW } from "./CliChannelRow";
import { GrantedRootsCard } from "./GrantedRootsCard";
import { GroupNameEditor, GroupRow } from "./WorkspaceGroupRow";
import { WorkspaceProjectsCard } from "./WorkspaceProjectsCard";

/**
 * 工作区二级分类 settings: group CRUD (create / rename / drag-reorder /
 * delete) plus per-project group assignment. State lives in the chat store
 * so the sidebar tree reflects edits immediately. Rows reuse the CLI config
 * page's chrome: drag grip (WorkspaceSortableList), inline name editing,
 * ghost icon actions. Row/card rendering lives in WorkspaceGroupRow,
 * WorkspaceProjectsCard, and GrantedRootsCard.
 */
export function WorkspacesSection() {
  const { t } = useTranslation();
  const { workspaces, workspaceGroups } = useChatStore(
    useShallow((s) => ({
      workspaces: s.workspaces,
      workspaceGroups: s.workspaceGroups,
    })),
  );
  const {
    createWorkspaceGroup,
    renameWorkspaceGroup,
    reorderWorkspaceGroups,
    deleteWorkspaceGroup,
    assignWorkspaceGroup,
  } = useChatStore(
    useShallow((s) => ({
      createWorkspaceGroup: s.createWorkspaceGroup,
      renameWorkspaceGroup: s.renameWorkspaceGroup,
      reorderWorkspaceGroups: s.reorderWorkspaceGroups,
      deleteWorkspaceGroup: s.deleteWorkspaceGroup,
      assignWorkspaceGroup: s.assignWorkspaceGroup,
    })),
  );

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<WorkspaceGroup | null>(null);

  const orderedGroups = sortedWorkspaceGroups(workspaceGroups);
  const memberCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of workspaces) {
      if (w.groupId) counts[w.groupId] = (counts[w.groupId] ?? 0) + 1;
    }
    return counts;
  }, [workspaces]);

  /** Localized pre-validation; the store re-checks as the source of truth. */
  const validateName = (name: string, excludeId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return t("settings.groupNameRequired");
    if (orderedGroups.some((g) => g.id !== excludeId && g.name === trimmed)) {
      return t("settings.groupNameDuplicate");
    }
    return null;
  };

  // Stable identities: GrantedRootsCard's load effect depends on these.
  const reportFailure = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    [],
  );
  const clearError = useCallback(() => setError(null), []);

  const commitCreate = (name: string): string | null => {
    const invalid = validateName(name);
    if (invalid) return invalid;
    setAdding(false);
    setError(null);
    void createWorkspaceGroup(name).catch(reportFailure);
    return null;
  };

  const commitRename = (id: string, name: string): string | null => {
    const invalid = validateName(name, id);
    if (invalid) return invalid;
    setRenamingId(null);
    setError(null);
    const group = orderedGroups.find((g) => g.id === id);
    if (group && name.trim() !== group.name) {
      void renameWorkspaceGroup(id, name).catch(reportFailure);
    }
    return null;
  };

  const handleAssign = (workspaceId: string, key: Key | null) => {
    if (key == null) return;
    const groupId = String(key);
    setError(null);
    void assignWorkspaceGroup(workspaceId, groupId || null).catch(reportFailure);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {error && (
        <p role="alert" className="text-body-regular text-text-error-primary">
          {t("common.error")}: {error}
        </p>
      )}

      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <SettingsSectionLabel anchor="workspaceGroups">
            {t("settings.workspaceGroups")}
            <span className="ml-2 text-body-2-regular font-normal text-text-tertiary">
              {t("settings.workspaceGroupsDesc")}
            </span>
          </SettingsSectionLabel>
          <Button
            size="small"
            leadingIcon={Plus}
            disabled={adding}
            onClick={() => {
              setRenamingId(null);
              setAdding(true);
            }}
            className="shrink-0"
          >
            {t("settings.addGroup")}
          </Button>
        </div>

        {orderedGroups.length === 0 && !adding ? (
          <div className="rounded-2xl border border-dashed border-border-button-default px-4 py-6 text-center">
            <p className="text-body-medium text-text-primary">{t("settings.noGroupsYet")}</p>
            <p className="mt-1 text-body-2-regular text-text-secondary">
              {t("settings.noGroupsDesc")}
            </p>
          </div>
        ) : (
          <SettingsCard>
            <WorkspaceSortableList
              items={orderedGroups}
              onReorder={(ids) => {
                setError(null);
                void reorderWorkspaceGroups(ids).catch(reportFailure);
              }}
              renderItem={(group, drag) => (
                <GroupRow
                  group={group}
                  drag={drag}
                  renaming={renamingId === group.id}
                  memberCount={memberCount[group.id] ?? 0}
                  onRenameStart={() => setRenamingId(group.id)}
                  onRenameCancel={() => setRenamingId(null)}
                  onCommitRename={(name) => commitRename(group.id, name)}
                  onDelete={() => setDeleting(group)}
                />
              )}
            />
            {adding && (
              <div className={ROW}>
                <GroupNameEditor
                  placeholder={t("settings.newGroupPlaceholder")}
                  submitLabel={t("common.create")}
                  onCommit={commitCreate}
                  onCancel={() => setAdding(false)}
                />
              </div>
            )}
          </SettingsCard>
        )}
      </div>

      <WorkspaceProjectsCard
        workspaces={workspaces}
        groups={orderedGroups}
        onAssign={handleAssign}
      />

      {deleting && (
        <ConfirmDialog
          danger
          message={t("settings.deleteGroupConfirm", { name: deleting.name })}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            setDeleting(null);
            setRenamingId((current) => (current === id ? null : current));
            setError(null);
            void deleteWorkspaceGroup(id).catch(reportFailure);
          }}
        />
      )}

      <GrantedRootsCard onError={reportFailure} onClearError={clearError} />
    </div>
  );
}
