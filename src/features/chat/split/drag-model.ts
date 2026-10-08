import { dropZoneAt } from "./tree";
import type { SplitDropTarget } from "./drag";

/**
 * Pure pointer→落点 math for the split drag layer.
 *
 * Kept out of `drag.tsx` (non-component exports there break Fast Refresh) and
 * free of React, so the hit-testing can be reasoned about on its own.
 */

/** 落点提示与目标格子之间的内缩，避免贴住分隔线。 */
const HINT_PAD = 4;

function paneElementAt(x: number, y: number): HTMLElement | null {
  const element = document.elementFromPoint(x, y);
  return element instanceof HTMLElement
    ? element.closest<HTMLElement>("[data-split-pane]")
    : null;
}

export function dropTargetAt(x: number, y: number): SplitDropTarget | null {
  const element = paneElementAt(x, y);
  const paneId = element?.dataset.splitPane;
  if (!element || !paneId) return null;
  const box = element.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return null;
  return {
    paneId,
    zone: dropZoneAt({ x: box.left, y: box.top, w: box.width, h: box.height }, x, y),
    rect: { left: box.left, top: box.top, width: box.width, height: box.height },
  };
}

/** 落点提示矩形：中心是整格内缩，边是半格。 */
export function dropHintRect(target: SplitDropTarget) {
  const { left, top, width, height } = target.rect;
  const inner = {
    left: left + HINT_PAD,
    top: top + HINT_PAD,
    width: Math.max(0, width - HINT_PAD * 2),
    height: Math.max(0, height - HINT_PAD * 2),
  };
  const halfW = Math.max(0, width / 2 - HINT_PAD * 2);
  const halfH = Math.max(0, height / 2 - HINT_PAD * 2);
  switch (target.zone) {
    case "left":
      return { left: inner.left, top: inner.top, width: halfW, height: inner.height };
    case "right":
      return {
        left: left + width / 2 + HINT_PAD,
        top: inner.top,
        width: halfW,
        height: inner.height,
      };
    case "top":
      return { left: inner.left, top: inner.top, width: inner.width, height: halfH };
    case "bottom":
      return {
        left: inner.left,
        top: top + height / 2 + HINT_PAD,
        width: inner.width,
        height: halfH,
      };
    default:
      return inner;
  }
}
