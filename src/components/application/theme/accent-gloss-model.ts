/**
 * Glossy accent hue table.
 *
 * Non-component data for `accent-gloss.tsx`: the hue vocabulary and the
 * Figma cell fills. Kept out of the component module so Fast Refresh can
 * preserve state there.
 */

/** The BoardUI hue vocabulary; spelled out because this file no longer
 *  depends on the accent engine's `TAILWIND_RAMPS`. */
export type GlossHueName =
  | "red" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald"
  | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple"
  | "fuchsia" | "pink" | "rose";

/* Figma cell fills: radial gradient, center → edge. The first six are raw
 * fills from the comp (no token yet). The rest are derived from the comp's
 * measured pattern relative to each hue's Tailwind 500 in oklch — center at
 * −0.7% lightness / 84% chroma, edge at −12% lightness / 97% chroma / −4°
 * hue — so every Tailwind hue has a matching lit sphere. */
export const GLOSS_GRADIENTS = {
  red: ["#E74241", "#CF0100"],
  orange: ["#f47327", "#d83f00"],
  amber: ["#F09E38", "#E57F00"],
  yellow: ["#e7b021", "#cd8800"],
  lime: ["#88c81c", "#6aa400"],
  green: ["#36c15c", "#009f13"],
  emerald: ["#55BA82", "#009040"],
  teal: ["#27b5a2", "#00957c"],
  cyan: ["#1bb4ce", "#0093ad"],
  sky: ["#14a3e3", "#0082c6"],
  blue: ["#437EF7", "#004DE9"],
  indigo: ["#5e66ea", "#3a3bd4"],
  violet: ["#8554F6", "#3E00CD"],
  purple: ["#a257f2", "#811ade"],
  fuchsia: ["#d24bec", "#b000d8"],
  pink: ["#E34798", "#D3006D"],
  rose: ["#ee4262", "#cf0043"],
} satisfies Record<GlossHueName, [string, string]>;

export type GlossHue = GlossHueName;
