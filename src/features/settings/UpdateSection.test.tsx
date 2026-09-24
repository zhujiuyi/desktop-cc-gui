import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@/lib/transport", () => ({ isWeb: false }));
vi.mock("@/lib/platform", () => ({
  getAppVersion: async () => "1.0.5",
  openExternal: vi.fn(),
}));

import "@/lib/i18n";
import { useUpdateStore } from "@/features/update/store";
import { UpdateSection } from "./UpdateSection";

// React 18's act() requires this flag to be set by the test environment.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const startUpdateSpy = vi.fn();
const checkForUpdatesSpy = vi.fn();

describe("UpdateSection self-built identity", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    startUpdateSpy.mockReset();
    checkForUpdatesSpy.mockReset();
    useUpdateStore.setState({
      stage: "idle",
      version: undefined,
      latestVersion: undefined,
      latestPubDate: undefined,
      downloadedBytes: 0,
      totalBytes: undefined,
      error: undefined,
      startUpdate: startUpdateSpy,
      checkForUpdates: checkForUpdatesSpy,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(async () => {
    if (root) {
      const current = root;
      await act(async () => current.unmount());
    }
    container.remove();
  });

  async function render() {
    const nextRoot = createRoot(container);
    root = nextRoot;
    await act(async () => {
      nextRoot.render(<UpdateSection />);
    });
  }

  it("shows the self-built label and version with no update controls", async () => {
    await render();

    expect(container.textContent).toContain("CC GUI 自建版");
    expect(container.textContent).toContain("v1.0.5");
    // 自建线：检查/立即更新入口整体下线，页面上没有可点的更新动作。
    expect(container.textContent).not.toContain("检查更新");
    expect(container.textContent).not.toContain("立即更新");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("explains that in-app updates are disabled", async () => {
    await render();

    expect(container.textContent).toContain("应用内更新已关闭");
  });
});
