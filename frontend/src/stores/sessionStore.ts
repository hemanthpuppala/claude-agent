import { create } from "zustand";
import type {
  SessionConfig, SessionStatus, ServerMessage,
} from "@/lib/types";

interface RateLimitInfo {
  utilization: number;    // 0-1 (e.g. 0.97 = 97%)
  resetsAt: number;       // Unix timestamp
  type: string;           // "five_hour" or "seven_day"
  status: string;         // "allowed", "allowed_warning"
}

interface RateLimits {
  session: RateLimitInfo | null;   // 5-hour window
  weekly: RateLimitInfo | null;    // 7-day window
}

interface SessionState {
  sessionId: string | null;
  sdkSessionId: string | null;
  cwd: string;
  status: SessionStatus;
  config: SessionConfig;
  totalCost: number;
  totalTurns: number;
  messages: ServerMessage[];
  streamingText: string;
  replaying: boolean;
}

interface SessionStore {
  /** Per-session state keyed by our session ID */
  sessions: Map<string, SessionState>;

  /** Global rate limits (account-wide, not per-session) */
  rateLimits: RateLimits;

  /** Initialize state for a session */
  initSession: (id: string, info: {
    sdk_session_id?: string | null;
    cwd: string;
    status: SessionStatus;
    config: SessionConfig;
    total_cost: number;
    total_turns: number;
  }) => void;

  /** Append a message to a session */
  addMessage: (id: string, msg: ServerMessage) => void;

  /** Update session status */
  setStatus: (id: string, status: SessionStatus) => void;

  /** Set streaming text */
  setStreamingText: (id: string, text: string) => void;

  /** Update config */
  setConfig: (id: string, config: SessionConfig) => void;

  /** Update cost/turns from result */
  updateCost: (id: string, cost: number, turns: number) => void;

  /** Set replaying state */
  setReplaying: (id: string, val: boolean) => void;

  /** Update rate limit info */
  setRateLimit: (id: string, info: RateLimitInfo) => void;

  /** Clear messages (for reconnect) */
  clearMessages: (id: string) => void;

  /** Remove session state */
  removeSession: (id: string) => void;

  /** Get session state */
  getSession: (id: string) => SessionState | undefined;
}

const defaultConfig: SessionConfig = {
  permission_mode: "acceptEdits",
  model: null,
  allowed_tools: null,
  disallowed_tools: null,
  system_prompt: null,
  max_turns: null,
  max_budget_usd: null,
  mcp_servers: null,
};

export const useSessionStore = create<SessionStore>()((set, get) => ({
  sessions: new Map(),
  rateLimits: { session: null, weekly: null },

  initSession: (id, info) => {
    const sessions = new Map(get().sessions);
    const existing = sessions.get(id);
    sessions.set(id, {
      sessionId: id,
      sdkSessionId: info.sdk_session_id ?? null,
      cwd: info.cwd,
      status: info.status,
      config: info.config ?? defaultConfig,
      totalCost: info.total_cost ?? 0,
      totalTurns: info.total_turns ?? 0,
      // Keep existing messages on reconnect — replay will update them via seq dedup
      messages: existing?.messages ?? [],
      streamingText: "",
      replaying: false,
    });
    set({ sessions });
  },

  addMessage: (id, msg) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;

    // Deduplicate by seq: if a message with the same seq already exists, replace it.
    // The SDK re-emits assistant messages after permission resolution.
    const seq = (msg as { seq?: number }).seq;
    let updated: ServerMessage[];
    if (seq !== undefined && seq !== null) {
      const existingIdx = state.messages.findIndex((m) => (m as { seq?: number }).seq === seq);
      if (existingIdx >= 0) {
        updated = [...state.messages];
        updated[existingIdx] = msg;
      } else {
        updated = [...state.messages, msg];
      }
    } else {
      updated = [...state.messages, msg];
    }

    sessions.set(id, { ...state, messages: updated });
    set({ sessions });
  },

  setStatus: (id, status) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    sessions.set(id, { ...state, status });
    set({ sessions });
  },

  setStreamingText: (id, text) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    sessions.set(id, { ...state, streamingText: text });
    set({ sessions });
  },

  setConfig: (id, config) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    sessions.set(id, { ...state, config });
    set({ sessions });
  },

  updateCost: (id, cost, turns) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    sessions.set(id, {
      ...state,
      totalCost: state.totalCost + cost,
      totalTurns: state.totalTurns + turns,
    });
    set({ sessions });
  },

  setReplaying: (id, val) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    // When replay starts, clear messages — server will send the full set
    if (val) {
      sessions.set(id, { ...state, replaying: true, messages: [] });
    } else {
      sessions.set(id, { ...state, replaying: false });
    }
    set({ sessions });
  },

  setRateLimit: (_id, info) => {
    const rateLimits = { ...get().rateLimits };
    if (info.type === "five_hour") {
      rateLimits.session = info;
    } else if (info.type === "seven_day") {
      rateLimits.weekly = info;
    } else {
      rateLimits.session = info;
    }
    set({ rateLimits });
  },

  clearMessages: (id) => {
    const sessions = new Map(get().sessions);
    const state = sessions.get(id);
    if (!state) return;
    sessions.set(id, { ...state, messages: [], streamingText: "" });
    set({ sessions });
  },

  removeSession: (id) => {
    const sessions = new Map(get().sessions);
    sessions.delete(id);
    set({ sessions });
  },

  getSession: (id) => get().sessions.get(id),
}));
