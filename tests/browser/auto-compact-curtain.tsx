// Open /tests/browser/auto-compact-curtain.html with the Vite dev server
// running. Static acceptance for the compaction "curtain": the host's own
// scheduling rows must never render as bubbles — the "/compact" row becomes
// one grey right-aligned line that survives the compaction ending, and the
// resume nudge disappears entirely (the reply it triggers is the visible
// part). An engine-reported mid-turn compaction has no row behind it and
// mounts the same line at the tail. The buttons switch the session state; the
// readout reports what the DOM actually shows, so a leaked bubble or a
// missing/lost line reads as FAIL. No model, no IPC, no saved conversation.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import i18n from "../../src/lib/i18n";
import type { Message } from "../../src/lib/ipc";
import { EMPTY_SESSION, type SessionState } from "../../src/features/chat/store/stream";
import { MessageTimeline } from "../../src/features/chat/components/MessageTimeline";

const RESUME = i18n.t("chat.autoCompactResume");

/** One settled turn, then the two host rows the auto-compaction writes:
 *  the command it runs and the nudge it sends to pick the task back up. */
const MESSAGES: Message[] = [
  { seq: 1, role: "user", text: "把那个文件读一下", ts: null },
  { seq: 2, role: "assistant", text: "读完了：文件里是一份配置说明。", ts: null },
  { seq: 3, role: "user", text: "/compact", ts: null },
  { seq: 4, role: "user", text: RESUME, ts: null },
  { seq: 5, role: "assistant", text: "继续之前没做完的部分。", ts: null },
];

type Mode = "idle" | "host" | "engine" | "resume";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "idle", label: "空闲（无压缩）" },
  { mode: "host", label: "宿主压缩中" },
  { mode: "engine", label: "引擎压缩中" },
  { mode: "resume", label: "续接轮" },
];

function stateFor(mode: Mode): SessionState {
  return {
    ...EMPTY_SESSION,
    messages: MESSAGES,
    streaming: mode !== "idle",
    turnStartedAt: Date.now() - 3_000,
    compaction:
      mode === "host"
        ? { automatic: false, startedAt: Date.now(), trigger: "threshold" }
        : mode === "engine"
          ? { automatic: true, startedAt: Date.now() }
          : null,
  };
}

interface Readout {
  storedRows: number;
  bubbles: string[];
  lines: number;
  lineColor: string | null;
  lineAlign: string | null;
  leakedCompact: boolean;
  leakedResume: boolean;
  thinking: boolean;
  pass: boolean;
}

/** Expected grey lines: the stored /compact row always; the engine's own
 *  mid-turn compaction adds a second one at the tail. */
const EXPECTED_LINES: Record<Mode, number> = { idle: 1, host: 1, engine: 2, resume: 1 };

function Harness() {
  const [mode, setMode] = useState<Mode>("host");
  const [readout, setReadout] = useState<Readout | null>(null);
  const session = stateFor(mode);

  useEffect(() => {
    const read = () => {
      const root = document.getElementById("fixture")!;
      const bubbles = [...root.querySelectorAll(".bg-bubble-user")].map(
        (el) => (el.textContent ?? "").trim(),
      );
      const lines = [...root.querySelectorAll('[data-testid="compaction-curtain"]')];
      const leakedCompact = bubbles.some((text) => text.startsWith("/compact"));
      const leakedResume = bubbles.some((text) => text.includes(RESUME));
      const next: Readout = {
        storedRows: MESSAGES.length,
        bubbles,
        lines: lines.length,
        lineColor: lines[0] ? getComputedStyle(lines[0].querySelector("span")!).color : null,
        lineAlign: lines[0] ? getComputedStyle(lines[0]).justifyContent : null,
        leakedCompact,
        leakedResume,
        thinking: (root.textContent ?? "").includes(i18n.t("chat.thinking")),
        pass: lines.length === EXPECTED_LINES[mode] && !leakedCompact && !leakedResume,
      };
      // The virtualizer mounts its rows a frame or two after the first paint,
      // so a once-per-mode read would sample an empty timeline.
      setReadout((current) =>
        current && JSON.stringify(current) === JSON.stringify(next) ? current : next,
      );
    };
    read();
    const timer = window.setInterval(read, 250);
    return () => window.clearInterval(timer);
  }, [mode]);

  return (
    <div className="flex h-[900px] flex-col bg-background-primary-default text-text-primary">
      <div className="flex items-center gap-2 border-b border-border-button-default px-3 py-2">
        <span className="text-caption-1-medium text-text-secondary">
          组件夹具（只渲染消息幕布，不是完整 GUI）
        </span>
        {MODES.map(({ mode: value, label }) => (
          <button
            key={value}
            type="button"
            data-testid={`mode-${value}`}
            onClick={() => setMode(value)}
            className={`rounded-md border border-border-button-default px-2 py-1 text-caption-1-medium ${
              mode === value ? "bg-background-tertiary-default" : "cursor-pointer"
            }`}
          >
            {label}
          </button>
        ))}
        <span data-testid="verdict" className="ml-auto text-caption-1-medium">
          {readout ? (readout.pass ? "PASS" : "FAIL") : "…"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageTimeline
          session={session}
          streaming={session.streaming}
          onLoadEarlier={() => {}}
          workspacePath="/ws"
        />
      </div>
      <pre
        data-testid="readout"
        className="max-h-[220px] overflow-auto border-t border-border-button-default bg-background-tertiary-default px-3 py-2 text-caption-1-regular"
      >
        {JSON.stringify(readout, null, 2)}
      </pre>
    </div>
  );
}

// The app's canvas colour, so the preview does not read as a blank page.
document.body.className = "bg-background-primary-default text-text-primary";
createRoot(document.getElementById("fixture")!).render(<Harness />);
