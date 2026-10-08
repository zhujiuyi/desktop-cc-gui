import {
  EYES,
  FOLD_CONFIG,
  FOLD_SHAPES,
  type AvatarConfig,
} from "@/components/application/agent-avatar/model";
import {
  GLOSS_GRADIENTS,
  type GlossHue,
} from "@/components/application/theme/accent-gloss-model";
import type { BotAvatar } from "@/lib/ipc";

/**
 * Bot avatar model.
 *
 * This module is the single adapter between our stored `BotAvatar` and the
 * engine's `AvatarConfig`: everything that renders a bot (list, editor, `#`
 * picker, chat badge) goes through `BotAvatarView` in `bot-avatar.tsx`, so
 * they can never drift. The React component lives in the `.tsx` file; keeping
 * the helpers here leaves that module exporting only a component, which is
 * what Fast Refresh needs.
 */

export const BOT_FOLD_SHAPES = FOLD_SHAPES;
export const BOT_EYES = EYES;

/** The nine colour presets from the BoardUI editor: HSL for the engine plus
 *  the gloss hue whose artwork matches, so the swatch and the avatar agree. */
export const BOT_COLOR_PRESETS: Array<{
  hue: number;
  saturation: number;
  gloss: GlossHue;
}> = [
  { hue: 220, saturation: 85, gloss: "blue" },
  { hue: 181, saturation: 49, gloss: "teal" },
  { hue: 259, saturation: 75, gloss: "violet" },
  { hue: 321, saturation: 74, gloss: "pink" },
  { hue: 0, saturation: 78, gloss: "red" },
  { hue: 31, saturation: 89, gloss: "orange" },
  { hue: 193, saturation: 78, gloss: "cyan" },
  { hue: 78, saturation: 72, gloss: "lime" },
  { hue: 145, saturation: 51, gloss: "green" },
];

export const GLOSS_HUES = Object.keys(GLOSS_GRADIENTS) as GlossHue[];

/** Stable per-bot number for the engine's idle rhythm (blink timing, wander):
 *  derived from the id so a bot blinks the same way across renders and
 *  launches without storing anything. */
export function avatarSeed(seed: string): number {
  let hash = 7;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003;
  }
  return hash;
}

/** Deterministic paper avatar for a bot that has none (a v1 entry whose icon
 *  was an ASCII preset id, or a freshly created bot before the user picks). */
export function defaultGeneratedAvatar(seed: string): BotAvatar {
  const hash = avatarSeed(seed);
  const preset = BOT_COLOR_PRESETS[hash % BOT_COLOR_PRESETS.length];
  return {
    type: "generated",
    foldShape: FOLD_SHAPES[hash % FOLD_SHAPES.length],
    eyes: EYES[Math.floor(hash / 13) % EYES.length],
    hue: preset.hue,
    saturation: preset.saturation,
  };
}

/** A fresh paper avatar: a random silhouette, expression and palette colour.
 *  The colour stays inside the designed presets so a shuffle can never land
 *  on a muddy hue the swatch row cannot represent. */
export function randomAvatar(): BotAvatar {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
  const preset = pick(BOT_COLOR_PRESETS);
  return {
    type: "generated",
    foldShape: pick(FOLD_SHAPES),
    eyes: pick(EYES),
    hue: preset.hue,
    saturation: preset.saturation,
  };
}

/** v1 icon string → avatar. Non-ASCII icons are emoji (unchanged look); the
 *  legacy ASCII preset ids have no counterpart here, so they become the
 *  deterministic paper avatar instead of leaking a preset id into prompts. */
export function avatarFromLegacyIcon(icon?: string | null, seed = "legacy"): BotAvatar {
  const value = icon?.trim();
  if (value && /[^\x00-\x7F]/.test(value)) {
    return { type: "emoji", value };
  }
  return defaultGeneratedAvatar(seed || value || "legacy");
}

/** First-pass generated avatars stored `shape` / `color` / `face`. Fold them
 *  into the current fields rather than dropping the user's choice. */
const LEGACY_FACE_TO_EYES: Record<string, string> = {
  neutral: "neutral",
  smile: "happy",
  curious: "curious",
  focused: "focused",
  sleepy: "sleepy",
  wink: "wink",
};

/** Avatar fields with defaults filled in and legacy keys folded — the one
 *  place a stored avatar becomes something renderable. */
export function normalizeAvatar(avatar?: BotAvatar | null, seed = "bot"): BotAvatar {
  const fallback = defaultGeneratedAvatar(seed);
  if (!avatar) return fallback;
  if (avatar.type === "emoji") {
    return avatar.value?.trim() ? { type: "emoji", value: avatar.value } : fallback;
  }
  if (avatar.type === "image") {
    return avatar.value?.trim() ? avatar : fallback;
  }
  const legacyAppearance = avatar.color ? hexToAppearance(avatar.color) : null;
  const foldShape = avatar.foldShape ?? avatar.shape;
  return {
    type: "generated",
    foldShape: foldShape && FOLD_SHAPES.includes(foldShape as never)
      ? foldShape
      : fallback.foldShape,
    eyes:
      avatar.eyes && EYES.includes(avatar.eyes as never)
        ? avatar.eyes
        : (avatar.face ? LEGACY_FACE_TO_EYES[avatar.face] : undefined) ?? fallback.eyes,
    hue: avatar.hue ?? legacyAppearance?.hue ?? fallback.hue,
    saturation: avatar.saturation ?? legacyAppearance?.saturation ?? fallback.saturation,
    lightness: avatar.lightness,
  };
}

/** Stored avatar → engine config. Only the picked fields are overridden; the
 *  engine's own fold defaults supply eye size, gaze, grain, motion and so on. */
export function avatarConfig(avatar?: BotAvatar | null, seed = "bot"): AvatarConfig {
  const resolved = normalizeAvatar(avatar, seed);
  return {
    ...FOLD_CONFIG,
    foldShape: (resolved.foldShape ?? FOLD_CONFIG.foldShape) as AvatarConfig["foldShape"],
    eyes: (resolved.eyes ?? FOLD_CONFIG.eyes) as AvatarConfig["eyes"],
    hue: resolved.hue ?? FOLD_CONFIG.hue,
    saturation: resolved.saturation ?? FOLD_CONFIG.saturation,
    lightness: resolved.lightness,
    seed: avatarSeed(seed),
  };
}

/**
 * HSL → `#rrggbb` for the picker's controlled value. Ported from the BoardUI
 * editor's own `avatarHex`, so the wheel opens on exactly the colour the
 * avatar is wearing.
 */
export function avatarHex(avatar?: BotAvatar | null, seed = "bot"): string {
  const config = avatarConfig(avatar, seed);
  const light = (config.lightness ?? 76) / 100;
  const a = (config.saturation / 100) * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + config.hue / 30) % 12;
    return Math.round(255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Hex → the stored appearance fields (hue/saturation/lightness). The BoardUI
 *  editor's `hexAppearance`, kept verbatim so a picked colour round-trips. */
export function hexToAppearance(hex: string): Pick<BotAvatar, "hue" | "saturation" | "lightness"> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const light = (max + min) / 2;
  let hue = 0;
  if (delta) {
    hue =
      max === r
        ? ((g - b) / delta + 6) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  }
  return {
    hue: Math.round(hue * 60),
    saturation: delta ? Math.round((delta / (1 - Math.abs(2 * light - 1))) * 100) : 0,
    lightness: Math.round(light * 100),
  };
}

/**
 * How the avatar reads to a screen reader. Emoji and image avatars carry
 * their own text; a generated one has no name of its own — the surrounding row
 * always shows the bot's name — so callers that want a spoken description pass
 * a formatter, and everyone else falls back to the generic "bot avatar".
 */
export function avatarLabel(
  avatar: BotAvatar,
  label?: (shape: string, eyes: string) => string,
): string {
  if (avatar.type === "emoji") return avatar.value ?? "";
  if (avatar.type === "image") return avatar.value ?? "";
  return label ? label(avatar.foldShape ?? "", avatar.eyes ?? "") : "";
}
