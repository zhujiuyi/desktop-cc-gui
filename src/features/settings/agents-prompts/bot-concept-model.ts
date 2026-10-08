/**
 * 「即将支持」分区的清单与文案。
 *
 * Non-component data for `bot-concept-diagram.tsx`, kept in its own module so
 * the diagram file exports only components (Fast Refresh). The tab list is
 * also the "not built yet" list; the copy is shared with the tab labels, so
 * the same thing is never written twice.
 */

/** 概念图能画的分区：也是「还没做完」的页签清单。文案与页签标签共用同一份，
 *  避免同一个东西写两遍。记忆已上线（真实面板在 memory-section.tsx），不再
 *  属于这里。 */
export const PLANNED_TABS = ["runtime", "routines", "collab"] as const;
export type PlannedTabId = (typeof PLANNED_TABS)[number];

/** 这个页签是否属于「即将支持」的四个分区。 */
export function isPlannedTab(id: string): id is PlannedTabId {
  return (PLANNED_TABS as readonly string[]).includes(id);
}

/** 页签与分区标题的文案（页签标签本身就是分区标题）。 */
export const PLANNED_TAB_COPY: Record<
  PlannedTabId,
  { titleKey: string; descKey: string }
> = {
  runtime: { titleKey: "settings.botTabRuntime", descKey: "settings.botRuntimeDesc" },
  routines: { titleKey: "settings.botTabRoutines", descKey: "settings.botRoutinesDesc" },
  collab: { titleKey: "settings.botTabCollab", descKey: "settings.botCollabDesc" },
};
