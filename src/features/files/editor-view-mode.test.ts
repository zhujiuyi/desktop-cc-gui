import { describe, expect, it } from "vitest";
import { isHtmlFile, isMarkdownFile, opensInPreview } from "./editor-view-mode";

describe("editor view mode", () => {
  it("opens Markdown in preview on every platform", () => {
    expect(opensInPreview("README.md", true)).toBe(true);
    expect(opensInPreview("README.md", false)).toBe(true);
    expect(isMarkdownFile("notes.markdown")).toBe(true);
  });

  it("opens HTML in preview only where file URLs serve real paths", () => {
    expect(opensInPreview("index.html", true)).toBe(true);
    expect(opensInPreview("index.htm", true)).toBe(true);
    expect(opensInPreview("index.xhtml", true)).toBe(true);
    // Web-access mode: the /file route cannot keep relative draft.css working.
    expect(opensInPreview("index.html", false)).toBe(false);
    expect(isHtmlFile("index.html")).toBe(true);
  });

  it("leaves other files in the code view", () => {
    for (const name of ["styles.css", "main.tsx", "data.json", "Makefile", "index"]) {
      expect(opensInPreview(name, true)).toBe(false);
    }
  });

  it("does not treat lookalike extensions as previewable", () => {
    for (const name of ["index.htmlish", "index.html.bak", "report.html.txt", "notes.md.bak"]) {
      expect(opensInPreview(name, true)).toBe(false);
    }
  });

  it("matches extensions case-insensitively", () => {
    expect(opensInPreview("INDEX.HTML", true)).toBe(true);
    expect(opensInPreview("README.MD", true)).toBe(true);
  });
});
