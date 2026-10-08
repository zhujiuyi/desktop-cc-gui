"use client";

/**
 * Vendored from BoardUI Pro (`boardui add agent-creator` →
 * `components/application/theme/accent-gloss.tsx`) and trimmed to the swatch
 * art the agent editor uses: the hue table, the gloss layer stack, one
 * selectable swatch and the rainbow well bitmap. The accent-engine grid and
 * the site-accent helpers are gone (this app colours a bot, not the theme),
 * as is `next/image` — this is a Vite app.
 */

import { GlossLayers } from "@/components/application/theme/custom-color-picker";
import { cx } from "@/utils/cx";
import { GLOSS_GRADIENTS, type GlossHue } from "./accent-gloss-model";

export type { GlossHue, GlossHueName } from "./accent-gloss-model";

/**
 * Glossy accent swatches — the lit-sphere cells from Figma node 4341:16265,
 * shared by the landing dock and the Color page's accent card. Each cell is
 * a radial base under the GlossLayers reflection stack, sized by className;
 * the active cell carries a 2px inner ring at 30% black.
 *
 * The rainbow well wraps the same art around AccentColorPickerWell, so any
 * surface can offer the custom picker as "one more cell".
 */

/* Figma cell fills moved to `accent-gloss-model.ts` (non-component export),
 * along with the hue vocabulary. */

/** Selection marker: a 2px inner ring at 30% black, over the gloss. */
export function ActiveRing() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_rgb(0_0_0/0.30)]"
    />
  );
}

export interface GlossSwatchProps {
  label?: string;
  hue: GlossHue;
  /** Cell diameter classes (default the comp's size-[26px]). */
  cellClassName?: string;
  active?: boolean;
  onSelect: () => void;
}

/** One glossy hue cell: reports the pick, inner ring when active. */
export function GlossSwatch({ hue, cellClassName = "size-[26px]", active, onSelect, label }: GlossSwatchProps) {
  const [center, edge] = GLOSS_GRADIENTS[hue];
  return (
    <button
      type="button"
      aria-label={label ?? `${hue} accent`}
      aria-pressed={active}
      title={hue}
      onClick={onSelect}
      className={cx(
        "relative shrink-0 cursor-pointer overflow-hidden rounded-full transition-transform duration-150 ease-out hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2",
        cellClassName,
      )}
      style={{
        background: `radial-gradient(closest-side circle at 50% 50%, ${center} 0%, ${edge} 100%)`,
      }}
    >
      <GlossLayers />
      {active ? <ActiveRing /> : null}
    </button>
  );
}

export function RainbowGlossArt() {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full">
      {/* The vendored block used next/image with `fill`; a plain absolutely
          positioned img is the same box in a Vite app. */}
      <img
        src="/accent-rainbow-well-light.png"
        alt=""
        className="theme-asset-light absolute inset-0 size-full object-cover"
      />
      <img
        src="/accent-rainbow-well-dark.png"
        alt=""
        className="theme-asset-dark absolute inset-0 size-full object-cover"
      />
    </span>
  );
}

/** The rainbow disc: the comp's PNG wheels (public/accent-rainbow-well-light
 * / -dark.png; drop higher-res exports over those files to upgrade, no code
 * change), matte at full opacity. Opens the picker. */
