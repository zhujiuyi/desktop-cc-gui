import { defaultGeneratedAvatar } from "@/features/bots/bot-avatar-model";
import { type SelectedBot } from "@/features/bots/selected-bot";
import { type BotConfig } from "@/lib/ipc";

/**
 * `#`-picker row model.
 *
 * Kept out of `bot-menu.tsx` (non-component exports break Fast Refresh): the
 * row union and the "row → persisted pick" mapping, with no React inside.
 */

/** A menu row: a bot, or a built-in catalog entry (no stored prompt — it
 *  resolves at send time — but a description and a division badge). */
export type BotMenuEntry =
  | { kind: "bot"; key: string; bot: BotConfig }
  | {
      kind: "builtin";
      key: string;
      name: string;
      description: string;
      icon: string | null;
      divisionLabel?: string;
    }
  | { kind: "create"; key: string; name: string };

/** Menu entry → the persisted per-thread pick. The pick keeps only what the
 *  chip and the send path need; the prompt block itself is assembled on the
 *  first send and frozen there (see features/bots/selected-bot.ts). */
export function toSelectedBot(entry: BotMenuEntry): SelectedBot {
  if (entry.kind === "bot") {
    return {
      id: entry.bot.id,
      name: entry.bot.name,
      title: entry.bot.title ?? undefined,
      slug: entry.bot.slug,
      avatar: entry.bot.avatar,
      source: "custom",
    };
  }
  return {
    id: entry.kind === "builtin" ? entry.key.replace(/^builtin:/, "") : entry.key,
    name: entry.kind === "builtin" ? entry.name : "",
    title: undefined,
    avatar: entry.kind === "builtin" && entry.icon
      ? { type: "emoji", value: entry.icon }
      : defaultGeneratedAvatar(entry.key),
    source: "builtIn",
  };
}
