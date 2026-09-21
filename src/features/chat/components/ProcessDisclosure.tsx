import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useReducedMotion } from "motion/react";
import Brain from "lucide-react/dist/esm/icons/brain";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import { cx } from "@/utils/cx";
import { StepRow, type TaskListChip } from "@/components/application/task-list/task-list";
import { getFileTreeIconSvg } from "@/features/files/fileIcons";
import { markToolKeys, toolEntranceKey, type ProcessItem } from "./timeline-rows";
import { ToolPayloadViewer } from "./ToolPayloadViewer";

/** Classify a tool-call label (tool name or shell command) into a type chip. */
function toolTypeKey(text: string): string {
  const tokens = text.toLowerCase().split(/[^a-z_]+/).filter(Boolean);
  const tokenSet = new Set(tokens);
  const has = (...names: string[]) => names.some((name) => tokenSet.has(name));
  if (has("web_search", "websearch", "web", "fetch", "browse")) return "toolTypeWeb";
  if (has("bash", "sh", "shell", "zsh", "terminal", "run_command")) return "toolTypeShell";
  if (has("read", "cat", "view", "read_file", "open_file")) return "toolTypeRead";
  if (has("write", "edit", "write_file", "edit_file", "apply_patch", "patch", "sed")) return "toolTypeEdit";
  if (has("grep", "glob", "rg", "find", "ls", "search", "search_files")) return "toolTypeSearch";
  if (has("task", "agent", "spawn")) return "toolTypeTask";
  // Multi-word labels are shell commands surfaced by engines like codex.
  if (tokens.length > 1 || text.includes(" ")) return "toolTypeShell";
  return "toolTypeTool";
}

/** File chip for a tool call's target path. Glob patterns, URLs, and
 * path-less calls get no chip — a pattern is not a file you can open, and a
 * URL's last segment (search targets like `artifact://0` → "0") would render
 * as a meaningless folder chip. */
function fileChipFor(path: string | null | undefined): TaskListChip | null {
  if (!path || /[*?{}[\]]/.test(path) || path.includes("://")) return null;
  // Read selectors (`file.ts:301-591:raw`, `img.svg:img`) are read modifiers,
  // not part of the file name — strip trailing `:` segments that are line
  // ranges or selector keywords. (Windows drive `C:` survives: its segment
  // starts with a backslash path, not a digit/keyword.)
  const segments = path.split(":");
  while (segments.length > 1) {
    const last = segments[segments.length - 1];
    if (/^\d/.test(last) || last === "raw" || last === "img" || last === "conflicts") {
      segments.pop();
    } else break;
  }
  const name = segments.join(":").split(/[\\/]/).pop() ?? "";
  if (!name || name === "." || name === "..") return null;
  // Same heuristic as the composer file tags: extension-less = folder.
  const isDir = !name.includes(".");
  return {
    label: name,
    icon: (
      <span
        aria-hidden
        className="text-foreground-icon-tertiary [&>svg]:size-3.5"
        dangerouslySetInnerHTML={{ __html: getFileTreeIconSvg(name, isDir) }}
      />
    ),
  };
}

type ProcessSection =
  | { type: "thinking"; text: string; live?: boolean; firstIndex: number }
  | {
      type: "tools";
      calls: {
        text: string;
        path: string | null;
        args?: unknown;
        result?: unknown;
        index: number;
      }[];
      firstIndex: number;
    };

function groupProcessSections(items: ProcessItem[]): ProcessSection[] {
  const sections: ProcessSection[] = [];
  items.forEach((item, index) => {
    if (item.type === "thinking") {
      sections.push({ type: "thinking", text: item.text, live: item.live, firstIndex: index });
    } else {
      const last = sections[sections.length - 1];
      const call = {
        text: item.text,
        path: item.path ?? null,
        args: item.args,
        result: item.result,
        index,
      };
      if (last?.type === "tools") last.calls.push(call);
      else sections.push({ type: "tools", calls: [call], firstIndex: index });
    }
  });
  return sections;
}

/** Freeze LogRow's `reduce` on first paint so a later parent render cannot
 * flip it mid-entrance (initial only runs on mount). */
const FrozenStepRow = memo(function FrozenStepRow({
  play,
  text,
  path,
  args,
  result,
  first,
  last,
}: {
  play: boolean;
  text: string;
  path: string | null;
  args?: unknown;
  result?: unknown;
  first: boolean;
  last: boolean;
}) {
  const reduceRef = useRef(!play);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasPayload = args != null || result != null;
  const fileChip = fileChipFor(path);
  const step = {
    label: text,
    chips: [
      ...(fileChip ? [fileChip] : []),
      { label: t(`chat.${toolTypeKey(text)}`) },
    ],
  };
  return (
    <StepRow
      step={step}
      active={false}
      first={first}
      last={last}
      reduce={reduceRef.current}
    >
      {hasPayload ? (
        <div className="-mt-0.5 mb-1">
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? t("chat.toolCallCollapse") : t("chat.toolCallExpand")}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex cursor-pointer items-center gap-0.5 text-caption-1-regular text-text-tertiary transition-colors hover:text-text-secondary"
          >
            <ChevronRight
              className={cx("size-3 transition-transform duration-150", open && "rotate-90")}
              aria-hidden
            />
            <span>{t("chat.toolCallArgs")}</span>
          </button>
          {open ? (
            <ToolPayloadViewer
              toolName={text}
              path={path}
              args={args}
              result={result}
            />
          ) : null}
        </div>
      ) : null}
    </StepRow>
  );
});

/** Live thinking window: the last ~2000 chars, cut at a LINE boundary so a
 *  row slides out as a whole instead of dissolving character by character.
 *  `truncated` tells the surface to fade its top edge, hinting at the
 *  content above the window. */
function liveThinkingWindow(text: string): { body: string; truncated: boolean } {
  const WINDOW_CHARS = 2000;
  if (text.length <= WINDOW_CHARS) return { body: text, truncated: false };
  const cut = text.length - WINDOW_CHARS;
  const newline = text.indexOf("\n", cut);
  // No newline inside the window (one enormous line): keep the char cut —
  // there is no line boundary to honor.
  const start = newline === -1 ? cut : newline + 1;
  return { body: text.slice(start), truncated: true };
}

/** Thinking body: brain header + left-railed gray content, mirroring the
 * reference chat UI. Plain pre-wrapped text — never markdown-reparsed per
 * delta. The live view is windowed to the last 2000 chars; the cut lands on
 * a line boundary and the top edge fades out, so overflow leaves as whole
 * dissolving rows rather than a hard char-by-char wipe. Titled sections
 * (mixed bodies) fold individually from their own header — live growth must
 * not re-open a section the user folded; the lone-thinking variant has no
 * inner header and leaves folding to the row header. */
function ThinkingSurface({
  text,
  title,
  live,
}: {
  text: string;
  title?: string;
  live?: boolean;
}) {
  const { body, truncated } = live ? liveThinkingWindow(text) : { body: text, truncated: false };
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-1">
      {title && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-fit cursor-pointer items-center gap-1.5 text-body-regular text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <Brain className="size-3.5" aria-hidden />
          <span>{title}</span>
          <ChevronRight
            className={cx("size-3 transition-transform duration-150", open && "rotate-90")}
            aria-hidden
          />
        </button>
      )}
      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cx(
              "ml-2 whitespace-pre-wrap break-words border-l border-foreground-icon-quaternary pl-4 text-[12px] leading-[1.65] text-text-tertiary",
              truncated &&
                "[mask-image:linear-gradient(to_bottom,transparent_0,#000_36px)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0,#000_36px)]",
            )}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

type ExpansionProps = { auto: boolean; live: boolean; thinking: boolean };


/** Pure transition table for the expanded-state machine: given the previous
 *  and current prop snapshot plus the user's override flag, decide the next
 *  expanded/overridden pair. Automation opens a row while its thinking is
 *  streaming and folds it the moment that thinking settles — unless
 *  `thinkingAutoCollapse` is off (设置 → 通用 → 行为), in which case the row
 *  stays open so the timeline does not jump shut. A superseded or
 *  turn-settled row folds either way, until the user's own click takes
 *  over. */
function expansionTransition(
  prev: ExpansionProps,
  next: ExpansionProps,
  expanded: boolean,
  overridden: boolean,
  thinkingAutoCollapse: boolean,
): { expanded: boolean; overridden: boolean } {
  if (next.auto && !prev.auto) {
    // Became the latest row: open it and hand control back to automation.
    return { expanded: true, overridden: false };
  }
  if (next.thinking && !prev.thinking && !overridden) {
    // Thinking resumed inside this row (extended thinking between tool
    // calls): show it again unless the user folded the row on purpose.
    return { expanded: true, overridden };
  }
  if (thinkingAutoCollapse && !next.thinking && prev.thinking && !overridden) {
    // The thinking settled: fold immediately — expanded-on-demand shows
    // the full text afterwards. A deliberate user click wins: it keeps
    // its chosen state and stays sticky across thinking resume cycles.
    return { expanded: false, overridden };
  }
  if (!next.auto && !next.live) {
    const superseded = prev.auto;
    const turnJustSettled = prev.live;
    if ((superseded || turnJustSettled) && !overridden) {
      return { expanded: false, overridden };
    }
  }
  return { expanded, overridden };
}


/** Expanded-state hook: holds the expanded flag and the user's override,
 *  delegating every prop-change decision to `expansionTransition`. */
function useProcessExpansion(
  autoExpand: boolean,
  turnLive: boolean,
  hasLiveThinking: boolean,
  thinkingAutoCollapse: boolean,
) {
  const [expanded, setExpanded] = useState(autoExpand);
  // Once the user clicks the header, their choice wins over the auto
  // expand/collapse driven by streaming state.
  const [overridden, setOverridden] = useState(false);
  // React-blessed adjust-during-render: previous prop values live in state,
  // so a prop change settles in the same commit that observed it — no
  // one-frame paint of the stale expanded value.
  const [prev, setPrev] = useState({ auto: autoExpand, live: turnLive, thinking: hasLiveThinking });
  const next = { auto: autoExpand, live: turnLive, thinking: hasLiveThinking };
  if (prev.auto !== next.auto || prev.live !== next.live || prev.thinking !== next.thinking) {
    setPrev(next);
    const settled = expansionTransition(prev, next, expanded, overridden, thinkingAutoCollapse);
    // Setting state to its current value bails out without a re-render, so
    // the no-op transitions are free.
    setOverridden(settled.overridden);
    setExpanded(settled.expanded);
  }
  const toggleExpanded = () => {
    setOverridden(true);
    setExpanded((v) => !v);
  };
  return { expanded, toggleExpanded };
}

/** Collapsed summary line: a lone thinking block is titled by the header
 * itself; mixed runs read "思考 N 次 工具调用 M 次". */
function processSummaryLabel(
  t: TFunction,
  singleThinking: boolean,
  thinkingCount: number,
  toolCount: number,
): string {
  return singleThinking
    ? t("chat.thinkingProcess")
    : thinkingCount > 0 && toolCount > 0
    ? t("chat.processSummary", { thinking: thinkingCount, tools: toolCount })
    : thinkingCount > 0
      ? t("chat.thinkingCount", { count: thinkingCount })
      : t("chat.toolCalls", { count: toolCount });
}

/** Expanded body: thinking runs as railed sections, tool sub-runs as tree
 * rows with file/type chips and a one-time blur-in per new tool call. */
function ProcessDisclosureBody({
  sections,
  expanded,
  reduceMotion,
  singleThinking,
  processId,
  seenTools,
}: {
  sections: ProcessSection[];
  expanded: boolean;
  reduceMotion: boolean;
  singleThinking: boolean;
  processId: number;
  seenTools: Set<string>;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex flex-col gap-3">
      {sections.map((section) =>
        section.type === "thinking" ? (
          <ThinkingSurface key={section.firstIndex} text={section.text} title={singleThinking ? undefined : t("chat.thinkingProcess")} live={section.live} />
        ) : (
          <ul key={section.firstIndex} className="ml-2 flex flex-col">
            {section.calls.map((call, j) => {
              const play =
                expanded &&
                !reduceMotion &&
                !seenTools.has(toolEntranceKey(processId, call.index));
              return (
                <FrozenStepRow
                  key={call.index}
                  play={play}
                  text={call.text}
                  path={call.path}
                  args={call.args}
                  result={call.result}
                  first={j === 0}
                  last={j === section.calls.length - 1}
                />
              );
            })}
          </ul>
        ),
      )}
    </div>
  );
}

const PROCESS_COLLAPSE_MS = 300;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A run of middle steps (thinking + tool calls) between chat bubbles: one
 * collapsed summary line ("思考 N 次 工具调用 M 次 >").
 * Expanding shows every step in order — thinking as railed sections, tool
 * sub-runs as tree rows. Height clips via grid-rows (no scaleY/opacity — those
 * leave a compositor ghost over the next bubble). Historical bodies unmount
 * after the close animation so the virtualizer does not keep every SVG tree. */

export const ProcessDisclosure = memo(function ProcessDisclosure({
  items,
  autoExpand = false,
  turnLive = false,
  thinkingAutoCollapse = true,
  processId,
  seenTools,
}: {
  items: ProcessItem[];
  autoExpand?: boolean;
  /** True while the turn is still streaming. The row folds when its own
   *  thinking settles even mid-turn; this only keeps pre-thinking content
   *  (early tool rows) mounted until the turn ends. */
  turnLive?: boolean;
  /** True (default): fold the row when its thinking settles. False (设置 →
   *  通用 → 行为): keep the settled thinking expanded so the timeline does
   *  not jump shut; the user can still fold it by hand. */
  thinkingAutoCollapse?: boolean;
  processId: number;
  seenTools: Set<string>;
}) {
  const { t } = useTranslation();
  const sections = useMemo(() => groupProcessSections(items), [items]);
  const hasLiveThinking = sections.some((s) => s.type === "thinking" && s.live);
  const { expanded, toggleExpanded } = useProcessExpansion(autoExpand, turnLive, hasLiveThinking, thinkingAutoCollapse);
  const reduceMotion = useReducedMotion() ?? false;
  // Mark after paint, not at animation complete: a virtualizer remount
  // mid-entrance must skip the replay. New keys still play on this first
  // paint because the set is read before this effect runs.
  useLayoutEffect(() => {
    markToolKeys(seenTools, processId, items);
  }, [items, processId, seenTools]);
  const thinkingCount = items.filter((item) => item.type === "thinking").length;
  const toolCount = items.length - thinkingCount;
  // A lone thinking block skips the "思考 1 次" summary: the header is the
  // "思考过程" title itself, and the expanded body drops the inner repeat.
  const singleThinking = items.length === 1 && items[0].type === "thinking";
  const label = processSummaryLabel(t, singleThinking, thinkingCount, toolCount);
  // Body stays mounted while expanded or while this row's own thinking is
  // streaming (the auto-open above makes both true then); once the thinking
  // settles the body stays mounted only through the close animation, so
  // expanding later re-renders the FULL settled text — the 2000-char live
  // window only ever applies live.
  const showBody = expanded || hasLiveThinking;
  const [bodyMounted, setBodyMounted] = useState(showBody);
  useLayoutEffect(() => {
    if (showBody) {
      setBodyMounted(true);
      return;
    }
    if (reduceMotion || prefersReducedMotion()) {
      setBodyMounted(false);
      return;
    }
    const timeout = window.setTimeout(() => setBodyMounted(false), PROCESS_COLLAPSE_MS);
    return () => window.clearTimeout(timeout);
  }, [showBody, reduceMotion]);
  return (
    <div className="mb-1.5 flex flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggleExpanded}
        className="flex w-full cursor-pointer flex-col text-left"
      >
        <span className="flex items-center gap-1 py-0.5 text-body-regular text-text-secondary transition-colors hover:text-text-primary">
          {singleThinking && <Brain className="size-3.5" aria-hidden />}
          {label}
          <ChevronRight
            className={cx("size-3.5 transition-transform duration-200", expanded && "rotate-90")}
            aria-hidden
          />
        </span>
      </button>
      {/* Height-only clip, not AnimatePresence / scaleY: a presence context
          with initial={false} silently cancels each StepRow's blur-in, and
          scaleY+opacity leaves a compositor ghost over the next bubble. */}
      <div
        aria-hidden={!expanded}
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {bodyMounted ? (
            <ProcessDisclosureBody
              sections={sections}
              expanded={expanded}
              reduceMotion={reduceMotion}
              singleThinking={singleThinking}
              processId={processId}
              seenTools={seenTools}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
});
