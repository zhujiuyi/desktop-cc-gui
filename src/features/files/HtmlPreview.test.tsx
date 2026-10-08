import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/preview-url", () => ({
  previewFileUrl: (path: string) => `ccgui-preview://localhost${path}`,
}));

import { HtmlPreview } from "./HtmlPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("HtmlPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const frame = () => container.querySelector("iframe");
  const render = (reloadKey: number, active = true) =>
    act(() =>
      root.render(
        <HtmlPreview
          path="/ws/draft/index.html"
          name="index.html"
          reloadKey={reloadKey}
          active={active}
        />,
      ),
    );

  it("renders the file through the app's preview protocol with the sandbox", () => {
    render(0);
    const iframe = frame();
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe("ccgui-preview://localhost/ws/draft/index.html");
    // Keeps its own asset origin (module scripts / sibling fetches stay
    // same-origin) but not the app's; no top-level navigation, no popups.
    expect(iframe!.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-forms allow-modals",
    );
    expect(iframe!.getAttribute("title")).toBe("index.html");
  });

  it("remounts the frame when the reload key changes", () => {
    render(0);
    const before = frame();
    render(1);
    const after = frame();
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect(after!.getAttribute("src")).toBe(before!.getAttribute("src"));
  });

  it("unmounts the frame while the tab is hidden and reloads it on return", () => {
    render(0);
    const before = frame();
    render(0, false);
    expect(frame()).toBeNull();
    render(0);
    const after = frame();
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });
});
