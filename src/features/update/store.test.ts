import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

const checkMock = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@/lib/transport", () => ({ isWeb: false }));
vi.mock("@/lib/platform", () => ({ getAppVersion: async () => "1.0.5" }));

// vi.mock calls above are hoisted, so this static import sees the mocks.
import { useReleaseNotesTabStore } from "./notes-tab";
import { useUpdateStore } from "./store";

function reset() {
  useUpdateStore.setState({
    stage: "idle",
    version: undefined,
    notesRelease: undefined,
    latestVersion: undefined,
    latestPubDate: undefined,
    error: undefined,
    downloadedBytes: 0,
    totalBytes: undefined,
  });
  useReleaseNotesTabStore.setState({ open: false, active: false, unreadVersion: undefined });
  invokeMock.mockReset();
  checkMock.mockReset();
}

describe("update checks are disabled on the self-built line", () => {
  beforeEach(reset);

  it("checkForUpdates never reaches the updater plugin", async () => {
    await useUpdateStore.getState().checkForUpdates({ interactive: true });
    await useUpdateStore.getState().checkForUpdates();

    // 自建线：入口已全部移除，短路兜底保证任何漏网调用也不触网。
    expect(checkMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().stage).toBe("idle");
  });

  it("startUpdate without a pending update stays a no-op too", async () => {
    await useUpdateStore.getState().startUpdate();

    expect(checkMock).not.toHaveBeenCalled();
    expect(useUpdateStore.getState().stage).toBe("idle");
  });
});

describe("release-notes tab", () => {
  beforeEach(reset);

  it("keeps the notes snapshot after the user defers the update", () => {
    useUpdateStore.setState({
      stage: "available",
      version: "1.0.9",
      notesRelease: { version: "1.0.9", date: undefined, body: "notes" },
    });

    useUpdateStore.getState().dismiss();

    // 「稍后」只收起待更新状态与浮层；已打开的说明页签还能继续读。
    expect(useUpdateStore.getState().stage).toBe("idle");
    expect(useUpdateStore.getState().version).toBeUndefined();
    expect(useUpdateStore.getState().notesRelease).toEqual({ version: "1.0.9", date: undefined, body: "notes" });
  });

  it("closing the tab clears the upgrade announcement's unread marker", () => {
    useReleaseNotesTabStore.getState().announceNewVersion("1.0.9");
    expect(useReleaseNotesTabStore.getState()).toMatchObject({
      open: true,
      active: true,
      unreadVersion: "1.0.9",
    });

    useReleaseNotesTabStore.getState().close();

    // 关掉页签 = 看过了：页签圆点与页头「新版本」一起消失。
    expect(useReleaseNotesTabStore.getState()).toMatchObject({
      open: false,
      active: false,
      unreadVersion: undefined,
    });
  });
});
