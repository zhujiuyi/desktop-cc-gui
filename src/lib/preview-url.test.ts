import { describe, expect, it, vi } from "vitest";
import { previewFileUrl } from "./preview-url";

describe("previewFileUrl", () => {
  it("keeps the directory structure so siblings resolve", () => {
    expect(previewFileUrl("/Users/a/index.html")).toBe(
      "ccgui-preview://localhost/Users/a/index.html",
    );
    expect(previewFileUrl("/Users/a/design/draft.css")).toBe(
      "ccgui-preview://localhost/Users/a/design/draft.css",
    );
  });

  it("encodes per segment instead of per path", () => {
    expect(previewFileUrl("/Users/a b/中文 稿/index.html")).toBe(
      "ccgui-preview://localhost/Users/a%20b/%E4%B8%AD%E6%96%87%20%E7%A8%BF/index.html",
    );
  });

  it("ignores a query-looking suffix in the name like any other segment", () => {
    expect(previewFileUrl("/Users/a/index.v2.html")).toBe(
      "ccgui-preview://localhost/Users/a/index.v2.html",
    );
  });

  it("uses the http-over-localhost form on Windows and normalizes backslashes", async () => {
    vi.resetModules();
    vi.doMock("@/lib/platform", () => ({ IS_WINDOWS: true }));
    const windowsUrl = await import("./preview-url");
    expect(windowsUrl.previewFileUrl("C:\\x\\y\\index.html")).toBe(
      "http://ccgui-preview.localhost/C%3A/x/y/index.html",
    );
    vi.doUnmock("@/lib/platform");
  });
});
