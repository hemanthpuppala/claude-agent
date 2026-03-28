/* ===== Session & Config ===== */

export interface SessionConfig {
  permission_mode: string;
  model: string | null;
  allowed_tools: string[] | null;
  disallowed_tools: string[] | null;
  system_prompt: string | null;
  max_turns: number | null;
  max_budget_usd: number | null;
  mcp_servers: Record<string, unknown> | null;
}

export interface Session {
  id: string;
  sdk_session_id: string | null;
  cwd: string;
  name: string;
  status: SessionStatus;
  total_cost_usd: number;
  total_turns: number;
  message_count: number;
  permission_mode: string;
  model: string | null;
  created_at: string;
  updated_at: string;
  last_prompt: string | null;
}

export type SessionStatus =
  | "idle"
  | "thinking"
  | "waiting_permission"
  | "error"
  | "dead";

/* ===== Messages ===== */

export interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "unknown";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
  data?: string;
}

export interface AssistantMsg {
  type: "assistant";
  seq?: number;
  content: ContentBlock[];
  model?: string;
}

export interface ResultMsg {
  type: "result";
  seq?: number;
  session_id?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  is_error?: boolean;
  stop_reason?: string;
  subtype?: string;
  result?: string;
}

export interface UserEchoMsg {
  type: "user_echo";
  seq?: number;
  content: string;
}

export interface SystemMsg {
  type: "system";
  seq?: number;
  subtype: string;
  session_id?: string;
  data?: string;
}

export interface StreamMsg {
  type: "stream";
  event: Record<string, unknown>;
}

export interface StatusMsg {
  type: "status";
  status: SessionStatus | "connected" | "interrupted";
}

export interface SessionInfoMsg {
  type: "session_info";
  session_id: string;
  sdk_session_id: string | null;
  cwd: string;
  status: SessionStatus;
  total_cost: number;
  total_turns: number;
  message_count: number;
  config: SessionConfig;
}

export interface PermissionRequestMsg {
  type: "permission_request";
  request_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  seq?: number;
}

export interface ErrorMsg {
  type: "error";
  message: string;
}

export interface ReplayStartMsg {
  type: "replay_start";
  total: number;
  from_seq: number;
}

export interface ReplayEndMsg {
  type: "replay_end";
}

export interface ConfigUpdatedMsg {
  type: "config_updated";
  config: SessionConfig;
}

export type ServerMessage =
  | AssistantMsg
  | ResultMsg
  | UserEchoMsg
  | SystemMsg
  | StreamMsg
  | StatusMsg
  | SessionInfoMsg
  | PermissionRequestMsg
  | ErrorMsg
  | ReplayStartMsg
  | ReplayEndMsg
  | ConfigUpdatedMsg;

/* ===== Tabs ===== */

export type TabType = "dashboard" | "session" | "terminal" | "file";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  icon?: string;
  // Session tabs
  sessionId?: string;
  project?: string;
  // Terminal tabs
  cwd?: string;
  // File tabs
  projectPath?: string;
  filePath?: string;
  pinned?: boolean;
}

/* ===== Projects ===== */

export interface Project {
  path: string;
  name: string;
  pinned: number;
  last_used: string;
}

/* ===== File Tree ===== */

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  extension?: string;
  children?: FileNode[];
}

export interface FileContent {
  path: string;
  size: number;
  extension: string;
  file_type: "text" | "image" | "markdown" | "binary";
  mime: string;
  content?: string;
  data_uri?: string;
  lines?: number;
  error?: string;
}
