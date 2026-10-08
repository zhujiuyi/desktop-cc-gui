/**
 * Git status colours matching IntelliJ IDEA's changes view.
 *
 * Non-component data for `GitTreeRow.tsx`, kept in its own module so that
 * module exports only components (Fast Refresh).
 */

/**
 * Git status letter badge color matching IntelliJ IDEA style.
 */
export const STATUS_COLOR: Record<string, string> = {
  M: "text-[#0088D2] dark:text-[#589DF6]",
  A: "text-[#208A3C] dark:text-[#59A869]",
  D: "text-text-tertiary",
  R: "text-[#0088D2] dark:text-[#389FD6]",
  C: "text-[#0088D2] dark:text-[#589DF6]",
  "?": "text-[#B00020] dark:text-[#E05555]",
  U: "text-[#E5534B] dark:text-[#E5534B]",
};

/**
 * File name colors matching IntelliJ IDEA Git changes style:
 * - Deleted (D): Gray + line-through
 * - Modified (M): Sky Blue
 * - Added (A): Forest Green
 * - Untracked (?): Crimson Red
 * - Renamed (R): Cyan
 */
export const FILE_NAME_COLOR: Record<string, string> = {
  M: "text-[#0088D2] dark:text-[#589DF6]",
  A: "text-[#208A3C] dark:text-[#59A869]",
  D: "text-text-tertiary line-through opacity-75",
  R: "text-[#0088D2] dark:text-[#389FD6]",
  C: "text-[#0088D2] dark:text-[#589DF6]",
  "?": "text-[#B00020] dark:text-[#E05555]",
  U: "text-[#E5534B] dark:text-[#E5534B]",
};
