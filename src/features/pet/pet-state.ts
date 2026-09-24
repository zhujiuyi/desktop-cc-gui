import type { ChatStore } from "@/features/chat/store/types";
import type { SessionState } from "@/features/chat/store/stream";
import { sessionKey } from "@/features/chat/store/persistence";
import type { MissionRun } from "@/features/mission/types";
import { runStatus } from "@/features/mission/types";
import type { PetStatus } from "./pet-atlas";

export type PetActivity =
  | "idle"
  | "thinking"
  | "tool"
  | "command"
  | "waiting"
  | "failed"
  | "completed";

export interface PetStateSnapshot {
  /** Stable identity used by the runtime when several sessions are active. */
  sessionKey: string | null;
  /** customTitle first, then the generated/session title; null for unnamed workbench runs. */
  sessionName: string | null;
  status: PetStatus;
  lookDirection: number;
  activity: PetActivity;
}

/** Optional signals added by PR #1266. Keep the pet feature buildable against
 * the v1.0.8 baseline while still consuming those signals when that PR lands. */
interface PetTaskSignal {
  status?: string;
  taskType?: string;
  description?: string;
  progress?: string;
  lastTool?: string;
  ambient?: boolean;
  updatedAt?: number;
}

interface PetSessionCompatibility {
  backgroundActive?: boolean;
  awaitingTasks?: boolean;
  tasks?: PetTaskSignal[];
  notificationTurnStartedAt?: number | null;
}

type PetChatState = Pick<ChatStore, "bySession"> &
  Partial<Pick<ChatStore, "sessions">>;

const COMMAND_SIGNAL = /\b(command|shell|terminal|powershell|bash|cmd|exec|run)\b/i;

function petSignals(session: SessionState): PetSessionCompatibility {
  return session as SessionState & PetSessionCompatibility;
}

function isCommandTask(task: PetTaskSignal): boolean {
  return [task.taskType, task.description, task.progress, task.lastTool]
    .filter((value): value is string => Boolean(value))
    .some((value) => COMMAND_SIGNAL.test(value));
}

function runningActivity(sessions: SessionState[]): PetActivity {
  const runningTasks = sessions.flatMap((session) =>
    (petSignals(session).tasks ?? []).filter((task) => task.status === "running"),
  );
  if (runningTasks.some(isCommandTask)) return "command";

  const hasLiveThinking = sessions.some((session) =>
    session.messages.some((message) => message.role === "thinking" && message.live),
  );
  if (hasLiveThinking) return "thinking";

  const hasToolMessage = sessions.some((session) => {
    const last = session.messages[session.messages.length - 1];
    return last?.role === "tool";
  });
  if (hasToolMessage || runningTasks.length > 0) return "tool";
  return "thinking";
}

/** Only active runs drive the pet (same idiom as runtime.ts / CanvasPane).
 * Persisted history — finished, cancelled, or interrupted runs — must not
 * pin the pet on a stale failed/review state forever; an interrupted run
 * converges to cancelled on reload and is not a failure the user caused.
 * Completion feedback is transient by design: when the last working run
 * leaves the active set, PetRuntime shows its short "completed" snapshot. */
function missionPetStatus(runs: Record<string, MissionRun>): PetStatus | null {
  for (const run of Object.values(runs)) {
    if (run.endedAt !== undefined || run.cancelled) continue;
    // An active run is never read as failed: live work or a pending human
    // decision outranks a failed sibling (same rule as the session side).
    // `cancelled` tasks are deliberate cancellations, not failures.
    if (run.tasks.some((task) => task.status === "waiting_human")) return "waiting";
    if (run.tasks.some((task) => task.status === "running")) return "running";
    if (run.tasks.some((task) => task.status === "failed")) return "failed";
    const status = runStatus(run);
    if (status === "attention") return "waiting";
    if (status === "running") return "running";
    if (status === "waiting") return "waiting";
  }
  return null;
}

/** 失败暂显时长：与 PetRuntime 的「已完成」暂显（5.4s）同节奏。 */
const FAILURE_FLASH_MS = 5400;

function taskTime(task: PetTaskSignal): number {
  return typeof task.updatedAt === "number" ? task.updatedAt : Number.NEGATIVE_INFINITY;
}

/** Newest non-ambient task by last update time (array order breaks ties).
 *  Ambient monitors never drive the session-facing state. */
function newestNonAmbientTask(tasks: PetTaskSignal[]): PetTaskSignal | null {
  let newest: PetTaskSignal | null = null;
  for (const task of tasks) {
    if (task.ambient) continue;
    if (!newest || taskTime(task) >= taskTime(newest)) newest = task;
  }
  return newest;
}

/** Parsed timestamp of the conversation's latest dated message that counts as
 *  real activity after `failedAt`; null when there is none (engine-dependent:
 *  some rows carry no ts). ts is RFC3339 or epoch millis as a string.
 *
 *  Messages produced by the CLI's own notification/completion turn — the
 *  segment reopened after the reply settled (`notificationTurnStartedAt`)
 *  when no user message intervened — are CLI bookkeeping, not a new round:
 *  the model's receipt of a task notification must not clear a failure at
 *  rest. User messages are never excluded. */
function lastMessageTime(session: SessionState, failedAt: number): number | null {
  const signals = petSignals(session);
  const stamp = signals.notificationTurnStartedAt;
  const excludeFrom =
    Number.isFinite(failedAt) && typeof stamp === "number" && stamp > failedAt
      ? stamp
      : Number.POSITIVE_INFINITY;
  const messages = session.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const ts = message?.ts;
    if (!ts) continue;
    const ms = /^\d+$/.test(ts) ? Number(ts) : Date.parse(ts);
    if (!Number.isFinite(ms)) continue;
    if (message.role !== "user" && ms >= excludeFrom) continue;
    return ms;
  }
  return null;
}

function sessionNameFromState(session: SessionState): string | null {
  const firstUser = session.messages?.find(
    (message) => message.role === "user" && message.text.trim(),
  );
  const title = firstUser?.text.replace(/\s+/g, " ").trim().slice(0, 40);
  return title || null;
}

function stateForSession(
  key: string,
  session: SessionState,
  sessionName: string | null,
  now: number,
): PetStateSnapshot | null {
  const base = {
    sessionKey: key,
    sessionName,
    lookDirection: 0,
  } as const;
  const signals = petSignals(session);
  const newest = newestNonAmbientTask(signals.tasks ?? []);
  const failedAt =
    newest && newest.status === "failed" ? taskTime(newest) : Number.NEGATIVE_INFINITY;

  if (session.error) {
    return { ...base, status: "failed", activity: "failed" };
  }
  // ① 失败即显示：刚结算的失败先置顶暂显——即便本轮仍在进行也先露脸；
  // ② 暂显过后让位给该会话的实时状态（后续任务/思考/等待），失败不锁屏。
  if (Number.isFinite(failedAt) && now >= failedAt && now - failedAt <= FAILURE_FLASH_MS) {
    return { ...base, status: "failed", activity: "failed" };
  }
  if (session.streaming || signals.backgroundActive === true) {
    return { ...base, status: "running", activity: runningActivity([session]) };
  }
  // A session still waiting on background work is active, not failed: a
  // sibling task's stale failure must not outrank the wait (2026-09-23 rule).
  if (signals.awaitingTasks === true) {
    return { ...base, status: "waiting", activity: "waiting" };
  }
  // ③ 收尾持续：会话已结束，且失败之后该会话再无任何活动（没有更新的任务
  // 结算——newest 已是失败；也没有更晚的消息）时，失败作为本轮的最后一个
  // 状态持续显示；此后任何新一轮活动都会把它清掉。`interrupted`/`stopped`
  // 不算失败：用户主动停止不是失败。
  if (newest && newest.status === "failed") {
    const lastAt = lastMessageTime(session, failedAt);
    // 完全没有时间戳时（旧引擎/夹具）＝没有"后续活动"的证据，保守地按
    // 持续失败处理（与引入时间戳前的行为一致）。
    if (lastAt === null || !Number.isFinite(failedAt) || lastAt <= failedAt) {
      return { ...base, status: "failed", activity: "failed" };
    }
  }
  return null;
}

/** Derive one status per active session so the overlay can distinguish them.
 *  `now` exists for tests: the failure flash window is time-based. */
export function derivePetStates(
  chat: PetChatState,
  mission: { runs: Record<string, MissionRun> },
  now: number = Date.now(),
): PetStateSnapshot[] {
  const metadataByKey = new Map(
    (chat.sessions ?? []).map((meta) => [
      sessionKey(meta.engine, meta.sessionId, meta.workspacePath),
      meta,
    ]),
  );
  const keys = [
    ...(chat.sessions ?? []).map((meta) =>
      sessionKey(meta.engine, meta.sessionId, meta.workspacePath),
    ),
    ...Object.keys(chat.bySession),
  ].filter((key, index, all) => all.indexOf(key) === index);

  const states: PetStateSnapshot[] = [];
  for (const key of keys) {
    const session = chat.bySession[key];
    if (!session) continue;
    const meta = metadataByKey.get(key);
    const sessionName =
      meta?.customTitle?.trim() || meta?.title?.trim() || sessionNameFromState(session);
    const state = stateForSession(key, session, sessionName || null, now);
    if (state) states.push(state);
  }

  const missionStatus = missionPetStatus(mission.runs);
  if (missionStatus) {
    states.push({
      sessionKey: "__mission__",
      sessionName: null,
      status: missionStatus,
      lookDirection: 0,
      activity:
        missionStatus === "failed"
          ? "failed"
          : missionStatus === "waiting"
            ? "waiting"
            : missionStatus === "running"
              ? "tool"
              : "completed",
    });
  }
  return states;
}
