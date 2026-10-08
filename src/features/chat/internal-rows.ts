import { en } from "@/i18n/en";
import { zh } from "@/i18n/zh";
import type { Message } from "@/lib/ipc";

/** The user row the host writes to run its own compaction. The timeline turns
 *  it into the grey curtain line instead of a bubble. */
export const COMPACT_COMMAND_TEXT = "/compact";

/** Nudge the footer sends after a threshold compaction. Identity for the
 *  renderer, so every shipped locale counts; the `Messages` type keeps the
 *  keys honest (a rename breaks the build, not the filter). */
const RESUME_TEXTS: readonly string[] = [
  zh.chat.autoCompactResume,
  en.chat.autoCompactResume,
];

/** True for the compaction command row. It stays visible — as one grey line —
 *  so a compaction remains traceable after it finished; the bubble it used to
 *  render as is what users flagged. */
export function isCompactCommandRow(
  message: Pick<Message, "role" | "text">,
): boolean {
  return message.role === "user" && message.text.trim() === COMPACT_COMMAND_TEXT;
}

/** True for the post-compaction nudge, which never renders: the reply it
 *  triggers is the visible part. History pages reload from the engine's
 *  transcript, where these rows carry no marker, so the texts are the
 *  identity; a re-sent nudge may carry a frozen agent block, hence the prefix
 *  test. */
export function isResumeNudgeRow(
  message: Pick<Message, "role" | "text">,
): boolean {
  if (message.role !== "user") return false;
  const text = message.text.trim();
  return RESUME_TEXTS.some((prefix) => text.startsWith(prefix));
}
