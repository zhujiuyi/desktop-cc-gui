import { memo, useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import Plus from "lucide-react/dist/esm/icons/plus";
import Minus from "lucide-react/dist/esm/icons/minus";
import Undo2 from "lucide-react/dist/esm/icons/undo-2";
import Folder from "lucide-react/dist/esm/icons/folder";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { Focusable } from "react-aria-components";
import { Tooltip, TooltipContent } from "@/components/base/tooltip/tooltip";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import type { GitFileEntry } from "@/lib/ipc";
import { getFileTreeIconSvg } from "@/features/files/fileIcons";
import type { GitTreeDirNode } from "./git-tree";
import { FILE_NAME_COLOR, STATUS_COLOR } from "./git-tree-colors";

export interface FileRowProps {
  entry: GitFileEntry;
  style?: CSSProperties;
  indent?: number;
  isSelected?: boolean;
  onToggleSelect?: (path: string) => void;
  actionLabel: string;
  actionKind: "stage" | "unstage";
  /** Untracked group: show the "New" badge like the template panel. */
  isNew?: boolean;
  /** Present only on worktree-side rows; opens the discard confirmation. */
  discardLabel?: string;
  onDiscard?: (path: string) => void;
  onAction: (path: string) => void;
  onOpen: (path: string) => void;
  actionBusy: boolean;
  displayName?: string;
}

/** File name cell: icon, left-truncated directory + filename, full path in
 *  the tooltip. Split out of FileRow so the row keeps only its layout. */
function FileNameCell({
  path,
  displayName,
  nameColor,
  isNew,
  onOpen,
}: {
  path: string;
  displayName?: string;
  nameColor: string;
  isNew: boolean;
  onOpen: (path: string) => void;
}) {
  const { t } = useTranslation();
  const sepIdx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dirPart = sepIdx > 0 ? path.slice(0, sepIdx + 1) : "";
  const filePart = sepIdx >= 0 ? path.slice(sepIdx + 1) : path;
  const iconSvg = useMemo(
    () => getFileTreeIconSvg(displayName ?? filePart, false),
    [displayName, filePart],
  );
  return (
    <>
      <span
        className="size-4 shrink-0 flex items-center justify-center [&>svg]:size-4"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: iconSvg }}
      />
      <Tooltip>
        <Focusable>
          <button
            type="button"
            onClick={() => onOpen(path)}
            aria-label={isNew ? `${path} (${t("git.newFile")})` : undefined}
            className="flex min-w-0 flex-1 items-baseline overflow-hidden text-left font-mono text-xs"
          >
            {displayName ? (
              <span className={cx("min-w-0 truncate font-medium", nameColor)}>{displayName}</span>
            ) : (
              <>
                {/* Directory truncates from the left (…/foo/bar) so the filename
                    — the most important part — stays visible as long as possible;
                    it right-truncates only when it alone overflows. The tooltip
                    below shows the full path on hover. */}
                {dirPart && (
                  <span dir="rtl" className="min-w-0 truncate text-left text-text-tertiary">
                    <bdo dir="ltr">{dirPart}</bdo>
                  </span>
                )}
                <span className={cx("min-w-0 truncate font-medium", nameColor)}>{filePart}</span>
              </>
            )}
          </button>
        </Focusable>
        <TooltipContent className="break-all font-mono">{path}</TooltipContent>
      </Tooltip>
    </>
  );
}

/** Trailing +/− line stats and the untracked "new" dot. */
function FileStats({ entry, isNew }: { entry: GitFileEntry; isNew: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 items-center justify-end gap-1 font-mono text-xs tabular-nums">
      {isNew && (
        <Tooltip>
          <Focusable>
            <span
              role="img"
              aria-label={t("git.newFile")}
              className="size-1.5 shrink-0 rounded-full bg-notification-success-foreground"
            />
          </Focusable>
          <TooltipContent>{t("git.newFile")}</TooltipContent>
        </Tooltip>
      )}
      {entry.additions !== undefined && (
        <span className="truncate text-state-success-text">+{entry.additions}</span>
      )}
      {entry.deletions !== undefined && entry.deletions > 0 && (
        <span className="truncate text-text-error-primary">−{entry.deletions}</span>
      )}
    </span>
  );
}

/** Hover/focus overlay with the discard and stage/unstage row actions. */
function FileRowActions({
  path,
  actionLabel,
  actionKind,
  actionBusy,
  discardLabel,
  onDiscard,
  onAction,
}: {
  path: string;
  actionLabel: string;
  actionKind: "stage" | "unstage";
  actionBusy: boolean;
  discardLabel?: string;
  onDiscard?: (path: string) => void;
  onAction: (path: string) => void;
}) {
  return (
    <div
      // Row actions overlay the trailing edge instead of reserving
      // permanent columns, so path + stats use the full row width. The
      // solid background (matching the row's own bg in each state) hides
      // the text underneath; reveal happens on row hover or keyboard
      // focus within the row.
      className={cx(
        "absolute inset-y-0 right-1.5 flex items-center gap-0.5 pl-3",
        "bg-background-primary-default group-hover:bg-background-secondary-hover",
        "pointer-events-none opacity-0",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "focus-within:pointer-events-auto focus-within:opacity-100",
      )}
    >
      {discardLabel !== undefined && onDiscard !== undefined && (
        <Tooltip>
          <Focusable>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => onDiscard(path)}
              aria-label={discardLabel}
              className={cx(
                "rounded p-0.5 text-foreground-icon-secondary",
                "hover:bg-background-tertiary-hover disabled:text-foreground-icon-disabled",
              )}
            >
              <Undo2 aria-hidden className="size-4" />
            </button>
          </Focusable>
          <TooltipContent>{discardLabel}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <Focusable>
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => onAction(path)}
            aria-label={actionLabel}
            className={cx(
              "rounded p-0.5 text-foreground-icon-secondary",
              "hover:bg-background-tertiary-hover disabled:text-foreground-icon-disabled",
            )}
          >
            {actionKind === "stage" ? (
              <Plus aria-hidden className="size-4" />
            ) : (
              <Minus aria-hidden className="size-4" />
            )}
          </button>
        </Focusable>
        <TooltipContent>{actionLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export const FileRow = memo(function FileRow({
  entry,
  style,
  indent,
  isSelected,
  onToggleSelect,
  actionLabel,
  actionKind,
  isNew = false,
  discardLabel,
  onDiscard,
  onAction,
  onOpen,
  actionBusy,
  displayName,
}: FileRowProps) {
  const isUntracked = entry.status.includes("?") || isNew;
  const raw = entry.status.replace(/\?/g, "").trim().charAt(0).toUpperCase();
  const letter = isUntracked ? "?" : raw.length > 0 ? raw : "?";

  const statusColor = STATUS_COLOR[letter] ?? "text-text-tertiary";
  const nameColor = FILE_NAME_COLOR[letter] ?? "text-text-primary";

  return (
    <li
      style={{
        ...style,
        paddingLeft: indent !== undefined ? `${indent}px` : undefined,
      }}
      className="group relative flex h-8 items-center gap-1.5 px-3 hover:bg-background-secondary-hover"
    >
      {onToggleSelect !== undefined && (
        <div className="flex shrink-0 items-center justify-center">
          <Checkbox
            size="sm"
            isSelected={isSelected}
            onChange={() => onToggleSelect(entry.path)}
            aria-label={entry.path}
          />
        </div>
      )}
      <span
        className={cx(
          "w-4 shrink-0 text-center font-mono text-xs font-semibold",
          statusColor,
        )}
      >
        {letter}
      </span>
      <FileNameCell
        path={entry.path}
        displayName={displayName}
        nameColor={nameColor}
        isNew={isNew}
        onOpen={onOpen}
      />
      <FileStats entry={entry} isNew={isNew} />
      <FileRowActions
        path={entry.path}
        actionLabel={actionLabel}
        actionKind={actionKind}
        actionBusy={actionBusy}
        discardLabel={discardLabel}
        onDiscard={onDiscard}
        onAction={onAction}
      />
    </li>
  );
});


export interface DirectoryRowProps {
  node: GitTreeDirNode;
  style?: CSSProperties;
  indent?: number;
  isOpen: boolean;
  onToggleOpen: (id: string) => void;
  selectedState: "all" | "some" | "none";
  onToggleSelect: (paths: string[]) => void;
  actionLabel?: string;
  actionKind?: "stage" | "unstage";
  onAction?: (paths: string[]) => void;
  discardLabel?: string;
  onDiscard?: (paths: string[]) => void;
  actionBusy: boolean;
}

export const DirectoryRow = memo(function DirectoryRow({
  node,
  style,
  indent,
  isOpen,
  onToggleOpen,
  selectedState,
  onToggleSelect,
  actionLabel,
  actionKind,
  onAction,
  discardLabel,
  onDiscard,
  actionBusy,
}: DirectoryRowProps) {
  const { t } = useTranslation();

  return (
    <li
      style={{
        ...style,
        paddingLeft: indent !== undefined ? `${indent}px` : undefined,
      }}
      className="group relative flex h-8 items-center gap-1.5 px-3 hover:bg-background-secondary-hover"
    >
      <button
        type="button"
        onClick={() => onToggleOpen(node.id)}
        className="flex size-4 shrink-0 items-center justify-center text-foreground-icon-tertiary hover:text-foreground-icon-secondary"
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? t("git.collapseFolder", { name: node.name })
            : t("git.expandFolder", { name: node.name })
        }
      >
        {isOpen ? (
          <ChevronDown aria-hidden className="size-3.5" />
        ) : (
          <ChevronRight aria-hidden className="size-3.5" />
        )}
      </button>

      <div className="flex shrink-0 items-center justify-center">
        <Checkbox
          size="sm"
          isSelected={selectedState === "all"}
          isIndeterminate={selectedState === "some"}
          onChange={() => onToggleSelect(node.allPaths)}
          aria-label={node.path}
        />
      </div>

      <span className="shrink-0 text-amber-500/80 dark:text-amber-400/80">
        {isOpen ? (
          <FolderOpen aria-hidden className="size-4" />
        ) : (
          <Folder aria-hidden className="size-4" />
        )}
      </span>

      <button
        type="button"
        onClick={() => onToggleOpen(node.id)}
        className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden text-left font-mono text-xs"
      >
        <span className="truncate font-medium text-text-primary">{node.name}</span>
        <span className="shrink-0 text-text-tertiary">({node.allPaths.length})</span>
      </button>

      <div
        // Row actions overlay the trailing edge instead of reserving
        // permanent columns, so path + stats use the full row width. The
        // solid background (matching the row's own bg in each state) hides
        // the text underneath; reveal happens on row hover or keyboard
        // focus within the row.
        className={cx(
          "absolute inset-y-0 right-1.5 flex items-center gap-0.5 pl-3",
          "bg-background-primary-default group-hover:bg-background-secondary-hover",
          "pointer-events-none opacity-0",
          "group-hover:pointer-events-auto group-hover:opacity-100",
          "focus-within:pointer-events-auto focus-within:opacity-100",
        )}
      >
        {discardLabel !== undefined && onDiscard !== undefined && (
          <Tooltip>
            <Focusable>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onDiscard(node.allPaths)}
                aria-label={discardLabel}
                className={cx(
                  "rounded p-0.5 text-foreground-icon-secondary",
                  "hover:bg-background-tertiary-hover disabled:text-foreground-icon-disabled",
                )}
              >
                <Undo2 aria-hidden className="size-4" />
              </button>
            </Focusable>
            <TooltipContent>{discardLabel}</TooltipContent>
          </Tooltip>
        )}
        {actionLabel !== undefined && onAction !== undefined && (
          <Tooltip>
            <Focusable>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => onAction(node.allPaths)}
                aria-label={actionLabel}
                className={cx(
                  "rounded p-0.5 text-foreground-icon-secondary",
                  "hover:bg-background-tertiary-hover disabled:text-foreground-icon-disabled",
                )}
              >
                {actionKind === "stage" ? (
                  <Plus aria-hidden className="size-4" />
                ) : (
                  <Minus aria-hidden className="size-4" />
                )}
              </button>
            </Focusable>
            <TooltipContent>{actionLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </li>
  );
});
