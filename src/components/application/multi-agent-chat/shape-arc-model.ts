import { FOLD_SHAPES } from "@/components/application/agent-avatar/model";

/** Unbounded index → position on the fold-shape ring. */
export const wrapShape = (index: number) =>
  ((index % FOLD_SHAPES.length) + FOLD_SHAPES.length) % FOLD_SHAPES.length;

/** Slot distance → point on the circular arc the shapes sit on. */
export function shapeArcPoint(distance: number) {
  const angle = distance * 0.34;
  return { x: Math.sin(angle) * 210, y: Math.cos(angle) * 210 - 176 };
}
