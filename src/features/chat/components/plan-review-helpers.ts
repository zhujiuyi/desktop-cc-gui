/**
 * Pure formatters shared by the plan card and the plan dock.
 *
 * Kept in their own module so `PlanReviewCard.tsx` exports only components
 * (Fast Refresh) and both call sites stay in sync.
 */

/** Localized execution-permission label; unknown values pass through raw. */
export function execPermissionLabel(
  t: (key: string) => string,
  permission: string,
): string {
  const keys: Record<string, string> = {
    auto: "chat.permissionAuto",
    manual: "chat.permissionManual",
    plan: "chat.permissionPlan",
    bypass: "chat.permissionBypass",
  };
  const key = keys[permission];
  return key ? t(key) : permission;
}

/** Whitespace-collapsed excerpt for the card body. */
export function planSummary(content: string, max = 240): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
