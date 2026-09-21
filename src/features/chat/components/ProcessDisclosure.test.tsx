import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { ProcessDisclosure } from "./ProcessDisclosure";
import type { ProcessItem } from "./timeline-rows";

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const ITEMS: ProcessItem[] = [
  { type: "thinking", text: "先读文件" },
  {
    type: "tool",
    text: "Read",
    path: "src/a.ts",
    args: { file_path: "src/a.ts", offset: 1, limit: 40 },
  },
  { type: "tool", text: "Grep", path: null },
];


async function render(
  items: ProcessItem[] = ITEMS,
  props: { autoExpand?: boolean; turnLive?: boolean; thinkingAutoCollapse?: boolean } = {},
) {
  await act(async () => {
    root.render(
      <ProcessDisclosure
        items={items}
        autoExpand={props.autoExpand ?? true}
        turnLive={props.turnLive}
        thinkingAutoCollapse={props.thinkingAutoCollapse}
        processId={1}
        seenTools={new Set()}
      />,
    );
  });
}

function headerExpanded(): boolean {
  return container.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded") === "true";
}

describe("ProcessDisclosure tool args", () => {
  it("hides args until the tool row is expanded", async () => {
    await render();
    expect(container.textContent).toContain("Read");
    expect(container.textContent).toContain("参数");
    expect(container.querySelector("pre")).toBeNull();

    const toggle = [...container.querySelectorAll("button")].find((el) =>
      el.getAttribute("aria-label")?.includes("展开工具参数"),
    );
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("pre")?.textContent).toContain("file_path");
    expect(container.querySelector("pre")?.textContent).toContain("src/a.ts");
  });

  it("omits the args toggle when a tool has no payload", async () => {
    await render();
    const toggles = [...container.querySelectorAll("button")].filter((el) =>
      el.getAttribute("aria-label")?.includes("工具参数"),
    );
    expect(toggles).toHaveLength(1);
  });

  it("renders git diff style comparison for Edit tool calls", async () => {
    const editItem: ProcessItem = {
      type: "tool",
      text: "Edit",
      path: "src/utils.ts",
      args: {
        file_path: "src/utils.ts",
        old_string: "const a = 1;",
        new_string: "const a = 2;\nconst b = 3;",
      },
    };
    await render([editItem]);

    const toggle = [...container.querySelectorAll("button")].find((el) =>
      el.getAttribute("aria-label")?.includes("展开工具参数"),
    );
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("src/utils.ts");
    expect(container.textContent).toContain("-");
    expect(container.textContent).toContain("const a = 1;");
    expect(container.textContent).toContain("+");
    expect(container.textContent).toContain("const a = 2;");
    expect(container.textContent).toContain("const b = 3;");
  });

  it("renders bash command, tool name and execution result", async () => {
    const bashItem: ProcessItem = {
      type: "tool",
      text: "Bash",
      args: {
        command: "git status",
        description: "Check working tree",
      },
      result: {
        stdout: "On branch main\nnothing to commit",
        stderr: "",
      },
    };
    await render([bashItem]);

    const toggle = [...container.querySelectorAll("button")].find((el) =>
      el.getAttribute("aria-label")?.includes("展开工具参数"),
    );
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Bash");
    expect(container.textContent).toContain("Check working tree");
    expect(container.textContent).toContain("git status");
    expect(container.textContent).toContain("执行结果");

    expect(container.textContent).toContain("On branch main");
  });
});

describe("ProcessDisclosure inner thinking sections", () => {
  const sectionHeaders = () =>
    [...container.querySelectorAll("button")].filter((el) =>
      el.textContent?.includes("思考过程"),
    );

  it("lets each thinking section inside a mixed body fold independently", async () => {
    await render([
      { type: "thinking", text: "先读文件" },
      { type: "tool", text: "Read", path: "src/a.ts" },
      { type: "thinking", text: "再检查依赖" },
    ]);
    // Two titled thinking sections, both expanded by default.
    expect(sectionHeaders()).toHaveLength(2);
    expect(sectionHeaders()[0].getAttribute("aria-expanded")).toBe("true");
    expect(sectionHeaders()[1].getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      sectionHeaders()[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Only the first section folds; the second and the tool row stay.
    expect(sectionHeaders()[0].getAttribute("aria-expanded")).toBe("false");
    expect(sectionHeaders()[1].getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("再检查依赖");
    expect(container.textContent).toContain("Read");
  });

  it("keeps a folded inner thinking section folded as live thinking grows", async () => {
    await render([
      { type: "thinking", text: "第一段" },
      { type: "tool", text: "Read", path: "src/a.ts" },
      { type: "thinking", text: "第二段", live: true },
    ]);
    expect(sectionHeaders()).toHaveLength(2);

    await act(async () => {
      sectionHeaders()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(sectionHeaders()[1].getAttribute("aria-expanded")).toBe("false");

    await render([
      { type: "thinking", text: "第一段" },
      { type: "tool", text: "Read", path: "src/a.ts" },
      { type: "thinking", text: "第二段，继续增长", live: true },
    ]);
    expect(sectionHeaders()[1].getAttribute("aria-expanded")).toBe("false");
  });
});

describe("ProcessDisclosure thinking expansion", () => {
  it("folds thinking when the stream settles by default", async () => {
    await render([{ type: "thinking", text: "先分析需求", live: true }], { turnLive: true });
    expect(headerExpanded()).toBe(true);
    expect(container.textContent).toContain("先分析需求");

    await render([{ type: "thinking", text: "先分析需求" }], { turnLive: true });
    expect(headerExpanded()).toBe(false);
  });

  it("keeps thinking expanded after the stream settles when auto-collapse is off", async () => {
    await render([{ type: "thinking", text: "先分析需求", live: true }], {
      turnLive: true,
      thinkingAutoCollapse: false,
    });
    expect(headerExpanded()).toBe(true);
    expect(container.textContent).toContain("先分析需求");

    await render([{ type: "thinking", text: "先分析需求" }], {
      turnLive: true,
      thinkingAutoCollapse: false,
    });
    expect(headerExpanded()).toBe(true);
    expect(container.textContent).toContain("先分析需求");
  });

  it("clips height when folding instead of fading a scaled ghost", async () => {
    await render([{ type: "thinking", text: "先分析需求" }], { autoExpand: true });
    expect(headerExpanded()).toBe(true);

    const header = container.querySelector("button[aria-expanded]");
    await act(async () => {
      header!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const panel = [...container.querySelectorAll<HTMLElement>("[aria-hidden]")].find((el) =>
      (el.getAttribute("class") ?? "").includes("grid-rows-"),
    );
    expect(panel).toBeTruthy();
    expect(panel!.className).toContain("grid-rows-[0fr]");
    expect(panel!.className).not.toMatch(/opacity-0/);
    expect(panel!.style.transform).toBe("");
    expect(container.textContent).toContain("先分析需求");
  });

  it("keeps live thinking folded after the user folds it mid-stream", async () => {
    await render([{ type: "thinking", text: "先分析", live: true }], { turnLive: true });
    expect(headerExpanded()).toBe(true);

    const header = container.querySelector("button[aria-expanded]");
    await act(async () => {
      header!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(headerExpanded()).toBe(false);

    // A stream flush grows the same live thinking row; the fold must stick.
    await render([{ type: "thinking", text: "先分析，再深入", live: true }], { turnLive: true });
    expect(headerExpanded()).toBe(false);

    // Thinking settles mid-turn; the fold still sticks.
    await render([{ type: "thinking", text: "先分析，再深入" }], { turnLive: true });
    expect(headerExpanded()).toBe(false);
  });

  it("still lets the user collapse thinking after it settles", async () => {
    await render([{ type: "thinking", text: "先分析需求", live: true }], {
      turnLive: true,
      thinkingAutoCollapse: false,
    });
    await render([{ type: "thinking", text: "先分析需求" }], {
      turnLive: true,
      thinkingAutoCollapse: false,
    });

    const header = container.querySelector("button[aria-expanded]");
    expect(header).toBeTruthy();
    await act(async () => {
      header!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(headerExpanded()).toBe(false);
  });
});
