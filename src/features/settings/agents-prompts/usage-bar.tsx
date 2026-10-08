import { cx } from "@/utils/cx";

/**
 * 用量条：与「人格 + 工作规则」同一种读法，超过 80% 变黄、超限变红。
 * Shared by the prose budget (bot-editor-sections) and the memory ledgers
 * (memory-section) so the two readouts cannot drift apart.
 */
export function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const ratio = limit > 0 ? used / limit : 0;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-caption-1-regular">
        <span className="text-text-tertiary">{label}</span>
        <span
          className={cx(
            "font-mono",
            ratio > 1
              ? "text-text-error-primary"
              : ratio > 0.8
                ? "text-text-warning-primary"
                : "text-text-secondary",
          )}
        >
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
        <div
          className={cx(
            "h-full rounded-full",
            ratio > 1 ? "bg-text-error-primary" : ratio > 0.8 ? "bg-text-warning-primary" : "bg-accent-500",
          )}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}
