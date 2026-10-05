import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeTitleTooltip } from "./native-title-tooltip";

// React's act() environment flag — a well-known global the runtime can't
// validate, so a named cast with no narrowing is the right boundary.
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

// Mirrors SHOW_DELAY in the component (kept private there on purpose).
const SHOW_DELAY_MS = 500;

let container: HTMLDivElement;
let root: Root;

// MutationObserver callbacks deliver at a microtask checkpoint; awaiting an
// async act() flushes them. Fake timers never gate observer delivery.
const flushObserver = () => act(async () => {});

function titledButton(title: string) {
  const button = document.createElement("button");
  button.setAttribute("title", title);
  document.body.appendChild(button);
  return button;
}

function pointerOver(element: HTMLElement, relatedTarget: EventTarget | null = null) {
  element.dispatchEvent(new MouseEvent("pointerover", { bubbles: true, relatedTarget }));
}

beforeEach(async () => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<NativeTitleTooltip />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.querySelectorAll("[data-native-tooltip]").forEach((el) => el.remove());
  vi.useRealTimers();
});

describe("NativeTitleTooltip interception", () => {
  it("intercepts titles on nodes appended directly to document.body (portaled overlays)", async () => {
    const button = titledButton("保存文件");
    await flushObserver();

    expect(button.getAttribute("title")).toBe("");
    expect(button.dataset.nativeTooltip).toBe("保存文件");
    // The accessible description survives the title being cleared.
    expect(button.getAttribute("aria-description")).toBe("保存文件");
  });

  it("keeps the intercepted copy when the node is moved (keyed list reorder)", async () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    const button = titledButton("Save file");
    await flushObserver();
    expect(button.dataset.nativeTooltip).toBe("Save file");

    // React reorders keyed children by moving the same DOM node.
    document.body.insertBefore(button, anchor);
    await flushObserver();

    expect(button.dataset.nativeTooltip).toBe("Save file");
    expect(button.getAttribute("aria-description")).toBe("Save file");
  });

  it("releases the copy only when the title attribute is fully removed", async () => {
    const button = titledButton("Save file");
    await flushObserver();
    expect(button.dataset.nativeTooltip).toBe("Save file");

    button.removeAttribute("title");
    await flushObserver();

    expect(button.dataset.nativeTooltip).toBeUndefined();
    expect(button.getAttribute("aria-description")).toBeNull();
  });

  it("does not clobber a pre-existing aria-description", async () => {
    const button = document.createElement("button");
    button.setAttribute("title", "Extra hint");
    button.setAttribute("aria-description", "Author's own description");
    document.body.appendChild(button);
    await flushObserver();

    expect(button.dataset.nativeTooltip).toBe("Extra hint");
    expect(button.getAttribute("aria-description")).toBe("Author's own description");

    button.removeAttribute("title");
    await flushObserver();
    expect(button.getAttribute("aria-description")).toBe("Author's own description");
    button.remove();
  });
  it("updates our aria-description copy when the title text changes", async () => {
    const button = titledButton("Old hint");
    await flushObserver();
    expect(button.getAttribute("aria-description")).toBe("Old hint");

    button.setAttribute("title", "New hint");
    await flushObserver();

    expect(button.dataset.nativeTooltip).toBe("New hint");
    expect(button.getAttribute("aria-description")).toBe("New hint");
  });
});

describe("NativeTitleTooltip display", () => {
  it("shows the themed tooltip after the delay", async () => {
    const button = titledButton("Hint text");
    await flushObserver();

    act(() => pointerOver(button));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));

    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain("Hint text");
  });

  it("hides the tooltip when the hovered target is removed from the DOM", async () => {
    const button = titledButton("Hint text");
    await flushObserver();
    act(() => pointerOver(button));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();

    button.remove();
    await flushObserver();

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("hides the tooltip on pointerdown", async () => {
    const button = titledButton("Hint text");
    await flushObserver();
    act(() => pointerOver(button));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));
    expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });

    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("swaps the tooltip when moving between nested titled elements", async () => {
    const outer = document.createElement("div");
    outer.setAttribute("title", "Outer hint");
    const inner = document.createElement("button");
    inner.setAttribute("title", "Inner hint");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    await flushObserver();

    act(() => pointerOver(outer));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("Outer hint");

    // Moving from the titled parent into its titled child must retarget.
    act(() => pointerOver(inner, outer));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("Inner hint");
    outer.remove();
    await flushObserver();
  });

  it("keeps the pending tooltip when moving within the same target", async () => {
    const button = titledButton("Hint text");
    const child = document.createElement("span");
    button.appendChild(child);
    await flushObserver();

    act(() => pointerOver(button));
    // Crossing an inner boundary must not cancel the pending show.
    act(() => pointerOver(child, button));
    act(() => vi.advanceTimersByTime(SHOW_DELAY_MS));

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("Hint text");
  });
});
