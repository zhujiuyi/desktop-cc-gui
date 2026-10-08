import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AgentAvatar } from "@/components/application/agent-avatar/agent-avatar";
import type { BotAvatar } from "@/lib/ipc";
import { cx } from "@/utils/cx";
import { avatarConfig, avatarLabel, normalizeAvatar } from "./bot-avatar-model";

/**
 * Bot avatars — the React view.
 *
 * The stored-avatar adapter (presets, defaults, legacy folding, engine config)
 * lives in `bot-avatar-model.ts`: this module exports only a component, so Fast
 * Refresh can preserve state instead of full-reloading.
 *
 * The generated ("paper") look is BoardUI's agent-avatar engine — nine fold
 * silhouettes, sixteen expressions, an HSL colour — rendered to a canvas, not
 * a hand-rolled SVG: it brings the fold shading, grain, blink, gaze wander and
 * shape morph that make one bot recognisable from another at 16px.
 */

/**
 * One bot avatar at a square size. Every generated avatar animates — the
 * `#` menu's 16px rows blink and glance around exactly like the editor's
 * preview, so a bot reads as the same character wherever it shows up (the
 * engine shares one requestAnimationFrame across instances and skips
 * off-screen canvases, so a long list is not a list of timers). Emoji and
 * image avatars are unchanged from v1.
 */
export function BotAvatarView({
  avatar,
  seed,
  size = 24,
  className,
  title,
}: {
  avatar?: BotAvatar | null;
  /** Identity the fallback and the engine's rhythm derive from. */
  seed?: string;
  size?: number;
  className?: string;
  /** Overrides the derived label (list rows pass the bot's name). */
  title?: string;
}) {
  const { t } = useTranslation();
  const resolved = normalizeAvatar(avatar, seed);
  const label = title ?? (avatarLabel(resolved) || t("settings.botAvatarAlt"));
  const config = useMemo(
    () => (resolved.type === "generated" ? avatarConfig(resolved, seed) : null),
    // The engine compares config by reference; rebuild only when a field moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      resolved.type,
      resolved.foldShape,
      resolved.eyes,
      resolved.hue,
      resolved.saturation,
      resolved.lightness,
      seed,
    ],
  );

  if (resolved.type === "emoji") {
    return (
      <span
        className={cx("inline-flex shrink-0 items-center justify-center", className)}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
        title={label}
        data-testid="bot-avatar"
        data-avatar-type="emoji"
      >
        <span className="leading-none" style={{ fontSize: Math.round(size * 0.78) }} aria-hidden>
          {resolved.value}
        </span>
      </span>
    );
  }

  if (resolved.type === "image") {
    return (
      <span
        className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
        title={label}
        data-testid="bot-avatar"
        data-avatar-type="image"
      >
        <img alt="" src={resolved.value} className="size-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center", className)}
      data-testid="bot-avatar"
      data-avatar-type="generated"
    >
      <AgentAvatar config={config!} size={size} label={label} />
    </span>
  );
}
