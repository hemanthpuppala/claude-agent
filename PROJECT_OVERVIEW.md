# Claude Code Web — Technical Overview

## Project Summary

Claude Code Web is a **persistent, remote Claude Code terminal** accessible via web browser on desktop and mobile devices. It decouples the Claude SDK runtime from the interface, allowing sessions to survive browser disconnects and enabling autonomous execution with runtime-configurable permissions.

The core innovation: **A tmux for Claude Code**. Start a session on your laptop, close the browser, check progress from your phone hours later with full message history replayed.

---

## Architecture

### High-Level Diagram

```
Browser (WebSocket + REST)
    ↓
FastAPI Server (9282)
    ├── SessionManager (singleton)
    │   └── ManagedSession[] (wraps ClaudeSDKClient)
    │       ├── message_log (in-memory buffer)
    │       ├── attached_ws (set of browser connections)
    │       ├── query_queue (async prompt queue)
    │       └── permission futures (bridge to human approval)
    │
    ├── NotificationManager (singleton)
    │   ├── VAPID keys (for Web Push)
    │   └── Push subscriptions (desktop + mobile)
    │
    └── SQLite (aiosqlite)
        ├── sessions (metadata, config, cost tracking)
        ├── messages (durable message log)
        ├── projects (saved directories)
        ├── push_subscriptions (notification endpoints)
        └── vapid_keys (encryption for Web Push)
```

### Request Flow: User Query → Claude → Persistence

1. **Browser sends query** via WebSocket `/ws/claude`
2. **SessionManager.send_query()** 
   - Stores user message in DB (for replay)
   - Appends to in-memory buffer
   - Queues prompt for processing
3. **SessionManager._process_queries()** (async loop)
   - Dequeues prompt, calls `session.client.query(prompt)`
4. **SessionManager._read_messages()** (async loop)
   - Reads from `session.client.receive_messages()`
   - Serializes each message
   - Persists to DB
   - Broadcasts to all attached browsers
5. **Permission handling**
   - If tool requires approval: ask browser OR send push notification
   - Permission future resolves → SDK continues
6. **Result message**
   - Cost + turn count extracted
   - Session metadata updated (total_cost_usd, total_turns)
   - Push notification sent if no browser attached

### Browser Reconnect (Persistence)

1. **Browser disconnects** (close, network loss, tab refresh)
2. **Session continues running** in background (SDK client alive, message reader/processor still running)
3. **New browser connects** with same session ID
4. **Replay flow:**
   - Fetch all messages from DB where `seq > after_seq`
   - Send `replay_start` event
   - Stream each message to browser
   - Send `replay_end` event
5. **Browser now has full history** and continues real-time updates

---

## Tech Stack

| Component | Technology | Version | Why |
|-----------|-----------|---------|-----|
| **Backend Framework** | FastAPI | ≥0.135.2 | Async-native, WebSocket support, ASGI |
| **Web Server** | Uvicorn | ≥0.42.0 | ASGI server, hot reload, performant |
| **Database** | SQLite | 3 | Zero-ops, single file, async via aiosqlite |
| **Database Driver** | aiosqlite | ≥0.21.0 | Async SQLite (important for non-blocking I/O) |
| **Claude Integration** | claude-agent-sdk | ≥0.1.50 | ClaudeSDKClient for persistent sessions |
| **Terminal PTY** | ptyprocess | ≥0.7.0 | Spawn shell + PTY handling |
| **File Watching** | watchfiles | ≥1.1.1 | Cross-platform file system events (Rust notify backend) |
| **Web Push** | pywebpush | ≥2.0.0 | VAPID-signed push to browsers |
| **Cryptography** | cryptography | ≥44.0 | VAPID key generation + signing |
| **Discord** | discord-py | ≥2.0 | Discord bot commands + message handling |
| **Frontend Framework** | React | 19.2.4 | UI rendering, hooks |
| **Frontend Builder** | Vite | 8.0.3 | Fast dev/build, ESM-first |
| **Frontend Styling** | Tailwind CSS | 4.2.2 | Utility-first CSS |
| **Terminal Emulator** | xterm.js | 6.0.0 | Web terminal rendering |
| **State Management** | Zustand | 5.0.12 | Lightweight stores (sessionStore, tabStore, uiStore) |
| **Markdown** | react-markdown + remark-gfm | 10.1.0, 4.0.1 | Render Claude responses as Markdown |
| **Syntax Highlighting** | rehype-highlight | 7.0.2 | Highlight code blocks |
| **Icons** | lucide-react | 1.7.0 | Consistent icon set |
| **HTTP Client** | ws (WebSocket), fetch (REST) | 8.20.0 | Browser native + WebSocket library |

---

## File Structure

```
my-agent/
├── server.py                          # Entry point: uvicorn runner
├── pyproject.toml                     # Dependencies (uv)
├── .env                               # Config overrides (HOST, PORT, etc.)
│
├── app/
│   ├── __init__.py                    # FastAPI app factory + lifespan
│   ├── config.py                      # All env vars, constants, defaults
│   │
│   ├── core/
│   │   ├── session_manager.py         # ⭐ Core: persistent sessions, SDK client wrapping
│   │   ├── notifications.py           # Web Push + ntfy.sh
│   │   └── serializers.py             # SDK message → JSON serialization
│   │
│   ├── database/
│   │   ├── schema.py                  # SQLite CREATE TABLE statements
│   │   ├── connection.py              # aiosqlite init/close
│   │   └── queries/
│   │       ├── sessions.py            # CRUD: sessions table
│   │       ├── messages.py            # CRUD: messages table (append-only)
│   │       ├── projects.py            # CRUD: projects table
│   │       └── push.py                # CRUD: push subscriptions + VAPID keys
│   │
│   ├── routes/
│   │   ├── __init__.py                # mount_routes() dispatcher
│   │   ├── sessions.py                # /api/sessions — session CRUD, config
│   │   ├── projects.py                # /api/projects, /api/projects/discover
│   │   ├── commands.py                # /api/commands (execute one-shot CLI commands)
│   │   ├── notifications.py           # /api/notifications (push subscription)
│   │   ├── claude_ws.py               # /ws/claude — main interaction WebSocket
│   │   ├── terminal_ws.py             # /ws/terminal — PTY shell + tmux
│   │   └── watcher_ws.py              # /ws/watch — filesystem change events
│   │
│   ├── discord/
│   │   └── bot.py                     # Discord bot: /ask, /list, /approve commands
│   │
│   └── utils/
│       └── files.py                   # File tree builder, file reader
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # Vite entry, root React render
│   │   ├── App.tsx                    # Main app: responsive layout (desktop/mobile)
│   │   ├── index.css                  # Global styles
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts        # WebSocket connection + message handling
│   │   │   ├── useMediaQuery.ts       # Responsive breakpoints
│   │   │   ├── useRouteSync.ts        # URL ↔ state sync
│   │   │   ├── useOpenTab.ts          # Tab management
│   │   │   └── useMobile.ts           # Mobile detection
│   │   │
│   │   ├── stores/
│   │   │   ├── sessionStore.ts        # Zustand: active sessions, messages, status
│   │   │   ├── tabStore.ts            # Zustand: open tabs (chat, terminal, file, dashboard)
│   │   │   └── uiStore.ts             # Zustand: UI state (sidebar open, reconnecting, etc.)
│   │   │
│   │   ├── lib/
│   │   │   ├── types.ts               # TypeScript interfaces (Message, Session, etc.)
│   │   │   ├── api.ts                 # REST API client functions
│   │   │   └── utils.ts               # formatCost(), formatTimeAgo(), etc.
│   │   │
│   │   └── components/
│   │       ├── layout/
│   │       │   ├── ActivityBar.tsx    # Left icon bar (Sessions, Terminal, Files, Settings)
│   │       │   ├── Sidebar.tsx        # Left panel: project tree, sessions, recent files
│   │       │   ├── SidebarHome.tsx    # Home panel
│   │       │   ├── SidebarProjects.tsx # Project list + discovery
│   │       │   ├── SidebarFiles.tsx   # File browser
│   │       │   ├── SidebarTerminals.tsx # Active tmux sessions
│   │       │   ├── SidebarSettings.tsx # Session config panel
│   │       │   ├── TabBar.tsx         # Horizontal tabs (visible tabs)
│   │       │   ├── WorkspaceBar.tsx   # Session name + config overlay
│   │       │   ├── StatusBar.tsx      # Bottom: cost, turns, rate limits
│   │       │   ├── MobileHeader.tsx   # Mobile top header
│   │       │   ├── MobileNav.tsx      # Mobile bottom nav
│   │       │   └── MobileSidebar.tsx  # Mobile drawer menu
│   │       │
│   │       ├── chat/
│   │       │   ├── ChatView.tsx       # Main chat container (scroll, drag-drop)
│   │       │   ├── ChatInput.tsx      # User input + file dropzone
│   │       │   ├── MessageUser.tsx    # Render user message
│   │       │   ├── MessageClaude.tsx  # Render assistant response (Markdown)
│   │       │   ├── ToolCard.tsx       # Display tool use + input/result
│   │       │   ├── ThinkingBlock.tsx  # Extended thinking display
│   │       │   ├── ToolResult.tsx     # Tool result expandable
│   │       │   ├── ResultBar.tsx      # Final result summary (cost, tokens, time)
│   │       │   ├── PermissionCard.tsx # Ask permission for tool execution
│   │       │   ├── AskUserQuestion.tsx # Render user question UI (checkboxes, radio, etc.)
│   │       │   ├── TypingIndicator.tsx # "Claude is thinking..." animation
│   │       │   ├── SessionConfig.tsx  # Configure model, tools, permissions
│   │       │   └── CommandPalette.tsx # Quick command search
│   │       │
│   │       ├── terminal/
│   │       │   ├── TerminalView.tsx   # xterm.js container
│   │       │   └── TerminalNamePrompt.tsx # Rename tmux session dialog
│   │       │
│   │       ├── fileviewer/
│   │       │   └── FileViewer.tsx     # Display file with syntax highlighting
│   │       │
│   │       ├── dashboard/
│   │       │   └── DashboardView.tsx  # Home: active sessions, recent, projects, create new
│   │       │
│   │       ├── ui/
│   │       │   ├── Toggle.tsx         # On/off switch
│   │       │   ├── Checkbox.tsx       # ☑️
│   │       │   ├── RadioGroup.tsx     # ◯ single select
│   │       │   ├── Select.tsx         # Dropdown
│   │       │   ├── NumberInput.tsx    # Number field
│   │       │   ├── TextArea.tsx       # Multiline text
│   │       │   ├── CheckboxGrid.tsx   # Grid of checkboxes (tool selection)
│   │       │   ├── SectionLabel.tsx   # Labeled section header
│   │       │   └── BottomSheet.tsx    # Mobile drawer
│   │       │
│   │       └── notifications/
│   │           ├── ReconnectionBanner.tsx # "Reconnecting..." bar
│   │           └── PushOnboarding.tsx    # "Enable notifications" prompt
│   │
│   ├── vite.config.ts                 # Vite config (HMR, proxy)
│   ├── tailwind.config.js             # Tailwind customization
│   ├── tsconfig.json                  # TypeScript config
│   └── package.json
│
├── discord_bot.py                     # Entry: uv run discord_bot.py
│
├── docs/
│   ├── BACKEND_PLAN.md                # Architecture + design decisions
│   └── DESIGN-SYSTEM.md               # UI/color system documentation
│
└── data/                              # Created at runtime
    └── claude-code-web.db             # SQLite database (sessions, messages, projects)
```

---

## Core Features

### 1. Persistent Sessions

**What:** Sessions survive browser close/refresh. Claude keeps running in background.

**Implementation:**
- `ManagedSession` class in `session_manager.py` wraps a `ClaudeSDKClient`
- Each session has a `reader_task` (reads from SDK) and `query_processor` (processes queue) running as async tasks
- Message buffer held in-memory + persisted to SQLite
- On reconnect, browser fetches missed messages from DB

**Lifecycle:**
```python
# Create session
session = await manager.create(cwd="/home/user/project", permission_mode="acceptEdits")

# Browser connects
manager.attach(session, websocket)
await manager.replay(session, websocket)  # Replay old messages

# User sends query
await manager.send_query(session, "Fix the bug in main.py")

# SDK processes in background
# Browser can close — SDK client keeps running

# Browser reconnects hours later
await manager.replay(session, websocket)  # Full history replays
```

**Code:** `app/core/session_manager.py:ManagedSession`, `_read_messages()`, `_process_queries()`

### 2. Permission Handling (Runtime-Configurable)

**What:** Control which tools Claude can use. Three modes + per-tool filtering.

**Modes:**
- `bypassPermissions` — All tools auto-approved (dangerous, for automation)
- `acceptEdits` — Only "safe" tools approved (Read, Glob, Grep, Edit, Write, WebSearch, WebFetch)
- `plan` — No tool execution allowed (planning only)
- `default` — Require approval for each tool

**Implementation:**
- `_handle_permission()` checks mode
- If approval needed: ask browser OR send push notification
- Uses `asyncio.Future` as permission gate
- Deduplication: same tool+args asked only once per query

**Code:** `session_manager.py:_handle_permission()`, `resolve_permission()`

### 3. Multi-Project with Isolated Permissions

**What:** Run multiple Claude sessions on different projects, each with different access levels.

**Example:**
```
Project A (cwd=/repo/frontend): acceptEdits (allow edits)
Project B (cwd=/repo/backend):  plan (no execution, just planning)
Project C (cwd=/repo/infra):    bypassPermissions (full autonomy)
```

**Implementation:**
- Each session has its own `permission_mode`, `cwd`, `allowed_tools`, `disallowed_tools`
- Messages and metadata isolated by `session_id`
- Dashboard shows all sessions with cost tracking per project

**Code:** `routes/sessions.py:CreateSessionRequest`, `session_manager.py:ManagedSession`

### 4. Rate Limit Visibility

**What:** Real-time display of 5-hour and 7-day rate limit utilization.

**Implementation:**
- `StatusBar.tsx` queries session metadata every 500ms
- Displays: `$ spent / $ limit` + `% utilization`
- Shows both 5-hour and 7-day buckets
- Updates on every query completion

**Code:** `frontend/src/components/layout/StatusBar.tsx`

### 5. Cost Tracking & Metrics

**What:** Per-session cost + turn metrics. Track spending by project.

**Data collected:**
- `total_cost_usd` — Cumulative spend per session
- `total_turns` — Number of queries executed
- `cost_per_turn` — Derived metric
- Stored in DB on every result message

**Implementation:**
```python
# When result message arrives
cost = getattr(msg, "total_cost_usd", 0) or 0
turns = getattr(msg, "num_turns", 0) or 0
session.total_cost += cost
session.total_turns += turns
await db_update_session(self._db, session.id, 
    total_cost_usd=session.total_cost,
    total_turns=session.total_turns)
```

**Code:** `session_manager.py:_read_messages()` line 325-337

### 6. Autonomous Execution (Headless)

**What:** Run Claude without a browser. Send results via push notification.

**Workflow:**
1. Create session with `permission_mode=bypassPermissions`
2. Send query via REST API (no WebSocket needed)
3. Session runs in background
4. When done: push notification to mobile
5. Click notification → browser opens, full history replayed

**Implementation:**
- Push notifications sent when no browser attached
- Discord bot can also trigger sessions headlessly

**Code:** `session_manager.py:_read_messages()` line 340-349

### 7. Message Persistence & Replay

**What:** Full conversation history survives disconnect. No data loss.

**Schema:**
```sql
CREATE TABLE messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    seq         INTEGER NOT NULL,        -- Order within session
    type        TEXT NOT NULL,           -- assistant | result | user_echo | etc.
    data        TEXT NOT NULL,           -- Full JSON blob
    created_at  TEXT NOT NULL,
    UNIQUE(session_id, seq)
);
```

**Storage:**
- Every message stored immediately (before broadcast)
- Deduplication: if assistant message already exists with same content, replace instead of append
- Older messages stay in DB; recent ones in in-memory buffer (MESSAGE_BUFFER_SIZE=1000)

**Replay:**
```python
# When browser reconnects
messages = [m for m in session.message_log if m.get("seq", 0) > after_seq]
await ws.send_json({"type": "replay_start", "total": len(messages)})
for msg in messages:
    await ws.send_json(msg)
await ws.send_json({"type": "replay_end"})
```

**Code:** `session_manager.py:replay()`, `_read_messages()`

### 8. Mobile Push Notifications

**What:** Notify on desktop + mobile when task completes or permission needed.

**Technologies:**
- **Web Push (VAPID)** — Desktop browsers + iOS 16+ with Web App installed
- **ntfy.sh** — Mobile fallback, simple HTTP POST

**Implementation:**
- Generate VAPID keypair on first startup (stored in DB)
- Browser subscribes to push via Service Worker
- Server sends signed push payload
- ntfy.sh sends simple link click URL

**Code:** `notifications.py`, `routes/notifications.py`

### 9. Discord Integration

**What:** Manage Claude sessions from Discord. Receive task updates in threads.

**Features:**
- `/ask "prompt"` — Create headless session, return link
- `/list` — Show active sessions
- `/approve <request_id>` — Approve pending permission from notification
- Threads auto-created per session
- Task updates posted to thread in real-time

**Implementation:**
- Thin HTTP client (no SDK integration)
- Discord bot calls FastAPI REST endpoints
- Keeps single source of truth on server

**Code:** `app/discord/bot.py`

### 10. Terminal Access (PTY + tmux)

**What:** Full shell access with tmux persistence.

**Workflow:**
1. Create tmux session (named by app)
2. WebSocket streams PTY output
3. Browser input → PTY input
4. Multiple browsers can attach to same tmux session
5. Sessions survive server restart (tmux leaves them running)

**Implementation:**
- `ptyprocess` spawns shell in PTY
- `watchfiles` monitors cwd for changes
- xterm.js renders terminal in browser
- Real-time output streaming via WebSocket

**Code:** `routes/terminal_ws.py`

### 11. File Exploration

**What:** Browse project files, view with syntax highlighting.

**Features:**
- Auto-discover projects in `~/Project`
- File tree browser (ignore node_modules, .venv, .git, etc.)
- Drag-drop files into chat
- Syntax highlighting for code/markdown/config files
- File size limits for safety

**Implementation:**
- `get_file_tree()` recursively lists files (respects IGNORE_DIRS/EXTENSIONS)
- `read_file()` returns content with size check
- Frontend renders tree, shows preview on hover

**Code:** `utils/files.py`, `routes/projects.py`

### 12. Session Resume & Fork

**What:** Resume a previous Claude session OR fork it (branch from checkpoint).

**Resume:**
```python
# Resume from session_id
session = await manager.create(
    cwd="/path",
    resume_sdk_session="<sdk_session_id>"
)
```

**Fork:**
```python
# Fork from existing session_id
session = await manager.create(
    cwd="/path",
    fork_from="<session_id>"
)
```

**Implementation:**
- ClaudeSDKClient supports `resume=` and `fork_session=` parameters
- Allows branching explorations (try A, fail, fork and try B)

**Code:** `session_manager.py:create()`, `routes/sessions.py`

### 13. Runtime Configuration Changes

**What:** Change model, system prompt, tools, budget without restarting.

**Mutable settings:**
- `model` — Switch Claude 3.5 Sonnet ↔ Opus
- `system_prompt` — Custom instruction override
- `allowed_tools` / `disallowed_tools` — Filter tools
- `max_turns` — Limit queries per session
- `max_budget_usd` — Cost limit per session
- `permission_mode` — Change approval strategy

**Implementation:**
```python
await manager.update_config(session, 
    model="claude-3-5-sonnet-20241022",
    permission_mode="bypassPermissions"
)
```

**Code:** `session_manager.py:update_config()`, `routes/sessions.py`

### 14. MCP Server Support

**What:** Extend Claude with custom tools via Model Context Protocol.

**Configuration:**
```python
session = await manager.create(
    cwd="/path",
    mcp_servers={
        "sqlite": {"command": "sqlite3", "args": ["/path/to/db.sqlite"]},
        "web": {"command": "python", "args": ["-m", "mcp_server"]}
    }
)
```

**Implementation:**
- Passed directly to `ClaudeAgentOptions(mcp_servers=...)`
- SDK handles MCP connection + tool discovery

**Code:** `session_manager.py:_start_client()`, `routes/sessions.py`

---

## Database Schema

### `sessions` Table
```sql
id              TEXT PRIMARY KEY                 -- uuid
sdk_session_id  TEXT                             -- Claude SDK's internal session ID
cwd             TEXT NOT NULL                    -- Working directory
name            TEXT NOT NULL DEFAULT ''         -- Display name
status          TEXT DEFAULT 'idle'              -- idle | thinking | waiting_permission | error | dead
permission_mode TEXT DEFAULT 'acceptEdits'      -- Permission strategy
model           TEXT DEFAULT NULL                -- null = SDK default
allowed_tools   TEXT DEFAULT NULL                -- JSON array or null
disallowed_tools TEXT DEFAULT NULL               -- JSON array or null
system_prompt   TEXT DEFAULT NULL                -- Custom system instruction
max_turns       INTEGER DEFAULT NULL             -- Turn limit
max_budget_usd  REAL DEFAULT NULL                -- Cost limit
total_cost_usd  REAL DEFAULT 0.0                 -- Cumulative spend
total_turns     INTEGER DEFAULT 0                -- Query count
message_count   INTEGER DEFAULT 0                -- Message count
created_at      TEXT NOT NULL                    -- ISO 8601 timestamp
updated_at      TEXT NOT NULL                    -- ISO 8601 timestamp
last_prompt     TEXT DEFAULT NULL                -- First 200 chars of last query
```

### `messages` Table
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
session_id  TEXT NOT NULL REFERENCES sessions(id)
seq         INTEGER NOT NULL                     -- Message order (0, 1, 2, ...)
type        TEXT NOT NULL                        -- assistant | result | user_echo | system | permission_request | error | stream
data        TEXT NOT NULL                        -- Full message JSON
created_at  TEXT NOT NULL                        -- ISO 8601 timestamp
UNIQUE(session_id, seq)
```

### `projects` Table
```sql
path        TEXT PRIMARY KEY                     -- Absolute path
name        TEXT NOT NULL                        -- Display name
pinned      INTEGER DEFAULT 0                    -- User favorite
last_used   TEXT NOT NULL                        -- ISO 8601 timestamp
```

### `push_subscriptions` Table
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
endpoint    TEXT NOT NULL UNIQUE                 -- Browser push endpoint
p256dh      TEXT NOT NULL                        -- Diffie-Hellman public key
auth        TEXT NOT NULL                        -- Authentication secret
user_agent  TEXT DEFAULT NULL                    -- For debugging (browser type)
created_at  TEXT NOT NULL                        -- ISO 8601 timestamp
```

### `vapid_keys` Table
```sql
id          INTEGER PRIMARY KEY CHECK (id = 1)   -- Always 1 (singleton)
private_key TEXT NOT NULL                        -- Base64-encoded EC private key
public_key  TEXT NOT NULL                        -- Base64-encoded EC public key
```

---

## WebSocket APIs

### `/ws/claude` — Claude Chat

**Connection Query Parameters:**
- `session_id` — Required. ID of session to attach to.
- `cwd` — Optional. Working directory (for new sessions).

**Server → Browser Messages:**

```json
{
  "type": "session_info",
  "session_id": "...",
  "sdk_session_id": "...",
  "cwd": "/path",
  "status": "idle",
  "total_cost": 0.42,
  "total_turns": 5,
  "message_count": 12,
  "config": { "permission_mode": "acceptEdits", ... }
}
```

```json
{
  "type": "replay_start",
  "total": 15,
  "from_seq": 0
}
```

```json
{
  "type": "assistant",
  "seq": 2,
  "content": [
    { "type": "text", "text": "Here's the fix..." },
    { "type": "tool_use", "id": "tool_123", "name": "Read", "input": { "file_path": "/app/main.py" } }
  ]
}
```

```json
{
  "type": "tool_result",
  "seq": 3,
  "tool_use_id": "tool_123",
  "content": "import os\n..."
}
```

```json
{
  "type": "result",
  "seq": 4,
  "stop_reason": "end_turn",
  "total_cost_usd": 0.10,
  "num_turns": 1,
  "is_error": false
}
```

```json
{
  "type": "permission_request",
  "request_id": "...",
  "tool_name": "Edit",
  "tool_input": { "file_path": "/app/main.py", "old_string": "...", "new_string": "..." }
}
```

```json
{
  "type": "status",
  "status": "thinking|idle|waiting_permission|error"
}
```

```json
{
  "type": "stream",
  "seq": 2,
  "delta": "Hello"
}
```

**Browser → Server Messages:**

```json
{
  "type": "query",
  "prompt": "Fix the bug in main.py"
}
```

```json
{
  "type": "permission_response",
  "request_id": "...",
  "decision": "allow|deny|allow_session|allow_always",
  "message": "Optional denial reason"
}
```

```json
{
  "type": "interrupt"
}
```

```json
{
  "type": "config",
  "permission_mode": "bypassPermissions",
  "model": "claude-3-5-sonnet-20241022",
  "system_prompt": "You are a ...",
  "allowed_tools": ["Read", "Write"],
  "max_turns": 10
}
```

```json
{
  "type": "attach",
  "session_id": "..."
}
```

### `/ws/terminal` — PTY Shell

**Connection Query Parameters:**
- `cwd` — Working directory for shell

**Server → Browser:**
```json
{
  "type": "data",
  "data": "$ "
}
```

**Browser → Server:**
```json
{
  "type": "input",
  "input": "ls -la\n"
}
```

### `/ws/watch` — File System Events

**Connection Query Parameters:**
- `cwd` — Working directory to watch

**Server → Browser:**
```json
{
  "type": "change",
  "event": "modified|created|deleted",
  "path": "src/main.py"
}
```

---

## REST APIs

### Session Management

**`POST /api/sessions`** — Create session
```json
{
  "cwd": "/home/user/project",
  "name": "Code review",
  "permission_mode": "acceptEdits",
  "model": "claude-3-5-sonnet-20241022",
  "allowed_tools": ["Read", "Glob", "Grep"],
  "system_prompt": "You are a code reviewer...",
  "max_budget_usd": 1.00
}
```

Response: `{ "session_id": "...", "sdk_session_id": "...", ... }`

**`GET /api/sessions`** — List sessions
Query params: `status`, `cwd`, `limit`
Response: Array of session objects

**`GET /api/sessions/{id}`** — Get session metadata
Response: Single session object

**`PATCH /api/sessions/{id}`** — Update config
```json
{
  "permission_mode": "bypassPermissions",
  "model": "claude-opus-4-1-20250805"
}
```

**`DELETE /api/sessions/{id}`** — Destroy session
Response: `{ "destroyed": true }`

**`POST /api/sessions/{id}/query`** — Headless query (no WebSocket)
```json
{
  "prompt": "Fix the bug in main.py"
}
```
Response: `{ "result": "..." }` (waits for completion)

### Projects

**`GET /api/projects/discover`** — Auto-discover projects
Response: `[{ "name": "project-a", "path": "/home/user/Project/project-a" }, ...]`

**`POST /api/projects`** — Save project
```json
{
  "path": "/home/user/Project/my-project",
  "name": "My Project",
  "pinned": true
}
```

**`GET /api/projects/{path:path}`** — Get file tree
Response: Nested structure of files + directories

**`POST /api/files/read`** — Read file content
```json
{
  "project_path": "/home/user/Project/my-project",
  "file_path": "src/main.py"
}
```
Response: `{ "content": "...", "size": 1024, "encoding": "utf-8" }`

### Notifications

**`POST /api/notifications/subscribe`** — Register push subscription
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "p256dh": "...",
  "auth": "..."
}
```

**`POST /api/notifications/unsubscribe`** — Unregister push subscription
```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

---

## Configuration

All configuration via environment variables or `.env` file:

```bash
# Server
HOST=0.0.0.0                                    # Bind address
PORT=9282                                       # Listen port

# Project discovery
PROJECT_DIR=~/Project                           # Default project root

# Permissions
DEFAULT_PERMISSION_MODE=acceptEdits             # Default mode
PERMISSION_TIMEOUT=300                          # Auto-allow after 5 min

# Notifications
NTFY_TOPIC=claude-code-web-hemanth              # ntfy.sh channel
NTFY_SERVER=https://ntfy.sh                     # ntfy.sh server
PUBLIC_URL=https://hemanth.tail50655e.ts.net    # Public URL (for notification links)

# Discord
DISCORD_BOT_TOKEN=...                           # Bot token
DISCORD_GUILD_ID=...                            # Server ID

# App metadata
DEFAULT_MAX_TURNS=None                          # Turn limit (None = no limit)
DEFAULT_MAX_BUDGET_USD=None                     # Cost limit (None = no limit)
```

---

## Message Types

### User Echo
```json
{
  "type": "user_echo",
  "content": "Fix the bug",
  "seq": 1
}
```

### Assistant Response
```json
{
  "type": "assistant",
  "content": [
    { "type": "text", "text": "..." },
    { "type": "tool_use", "id": "tool_123", "name": "Read", "input": {...} }
  ],
  "seq": 2
}
```

### Tool Result
```json
{
  "type": "tool_result",
  "tool_use_id": "tool_123",
  "content": "...",
  "seq": 3
}
```

### Result (Query Complete)
```json
{
  "type": "result",
  "stop_reason": "end_turn|max_turns|tool_use|stop_sequence",
  "total_cost_usd": 0.10,
  "num_turns": 1,
  "is_error": false,
  "result": "Task completed",
  "seq": 4
}
```

### Permission Request
```json
{
  "type": "permission_request",
  "request_id": "req_123",
  "tool_name": "Edit",
  "tool_input": {...},
  "seq": 5
}
```

### Stream (Partial Response)
```json
{
  "type": "stream",
  "delta": "Hello ",
  "seq": 2
}
```

### System
```json
{
  "type": "system",
  "subtype": "init|config",
  "seq": 0
}
```

### Status
```json
{
  "type": "status",
  "status": "thinking|idle|waiting_permission|error|interrupted"
}
```

### Error
```json
{
  "type": "error",
  "message": "Session not found"
}
```

---

## How It Works: End-to-End Example

### Scenario: Code Review with Push Notification

**Morning (9:00 AM):**
1. Open browser, go to dashboard
2. Create session for `~/Project/backend` with `permission_mode=acceptEdits`
3. Session ID: `abc-123`
4. Send query: "Review src/auth.py and suggest security improvements"

**System Flow:**
```
Browser sends query
  ↓
SessionManager.send_query() stores user message in DB
  ↓
Message appended to session.message_log + broadcast to browser
  ↓
SessionManager._process_queries() dequeues prompt
  ↓
session.client.query() calls Claude SDK
  ↓
SDK starts processing...
```

**Claude responds (10 sec):**
```
Assistant: "I found 3 security issues..."
Tool use: Read auth.py (tool_use_id: tool_001)

Permission request sent:
  - If browser attached: PermissionCard shown
  - If browser closed: Push notification sent
```

**Commute (9:05 AM):**
1. Browser closed on laptop
2. Phone gets push notification: "Claude needs permission: Read src/auth.py"
3. Click → Web app opens
4. PermissionCard shown with tool details
5. Tap "Allow" button
6. Permission future resolved → Claude continues

**Meanwhile (background):**
- Session.client.query() completes
- Final result message with cost + turns
- DB updated with session.total_cost, session.total_turns
- Since no browser attached: push notification sent with summary
- Phone notification: "Code review complete — $0.10 · 2 turns"

**Evening (5:00 PM):**
1. Open browser on laptop
2. Click to attach to same session (abc-123)
3. Full message history replayed (user query → Claude response → tool use → tool result → final result)
4. All cost metrics shown in StatusBar
5. Can continue from where it left off or fork for alternate review

---

## Running the Project

### Local Development

```bash
# Install dependencies
uv sync

# Start backend
uv run server.py
# Backend runs on http://localhost:9282

# In another terminal, start frontend dev server
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173 (hot reload)

# Vite proxies /api and /ws to backend
```

### Environment Variables

Create `.env`:
```
HOST=0.0.0.0
PORT=9282
PROJECT_DIR=~/Project
PERMISSION_TIMEOUT=300
```

### Discord Bot (Optional)

```bash
export DISCORD_BOT_TOKEN="your_token_here"
export DISCORD_GUILD_ID="your_server_id_here"
uv run discord_bot.py
```

### Expose Publicly (For Mobile)

Use **Tailscale VPN** (recommended):
```bash
tailscale up
# Accessible as https://<your-tailscale-name>.ts.net from any device on your network
```

Or **ngrok**:
```bash
ngrok http 9282
# Accessible as https://<random>.ngrok.io
```

Then update `.env`:
```
PUBLIC_URL=https://<your-tailscale-name>.ts.net
```

---

## Frontend Architecture

### State Management (Zustand)

**`sessionStore`** — Active sessions
```typescript
{
  sessions: Map<sessionId, Session>,
  addMessage(sessionId, message),
  addSession(session),
  setStatus(sessionId, status),
  getSession(sessionId)
}
```

**`tabStore`** — Open tabs
```typescript
{
  tabs: Tab[],  // {type: 'session'|'terminal'|'file'|'dashboard', sessionId?, cwd?, filePath?}
  activeTabId: string,
  openTab(tab),
  closeTab(tabId)
}
```

**`uiStore`** — UI state
```typescript
{
  sidebarOpen: boolean,
  reconnecting: boolean,
  toggleSidebar()
}
```

### Hooks

**`useWebSocket`** — WebSocket connection management
- Auto-reconnect with exponential backoff
- Handles message parsing + session store updates
- Manages permission responses
- Sends queries, interrupts

**`useRouteSync`** — Sync URL ↔ tab state
- URL changes update activeTab
- Tab changes update URL (enables back button)

**`useMediaQuery`** — Responsive breakpoints
- isMobile (< 768px)
- isTablet (768-1024px)

---

## Key Design Decisions

1. **Session is separate from WebSocket connection**
   - Allows browser disconnect without stopping execution
   - Browser is just a viewer; session is the runtime
   - Multiple browsers can attach to same session

2. **In-memory message buffer + DB**
   - Recent messages (1000) in memory for fast broadcast
   - Older messages in DB for replay
   - Tradeoff: fast updates vs. long-term persistence

3. **Async-first architecture**
   - All I/O non-blocking (aiosqlite, asyncio)
   - FastAPI + Uvicorn handles concurrent connections
   - Scales to many simultaneous sessions

4. **SQLite for simplicity**
   - Zero-ops single-file database
   - Sufficient for single-user (or small team)
   - Can upgrade to Postgres for multi-tenant

5. **WebSocket for real-time, REST for CRUD**
   - WebSocket for message streaming (low latency)
   - REST for session CRUD, config changes (stateless, simpler)

6. **Thin Discord bot**
   - No SDK integration in bot
   - Bot calls FastAPI REST endpoints as HTTP client
   - Server is single source of truth

---

## Limitations & Future Work

### Current Limitations
- Single-user by default (SQLite)
- No multi-tenant RBAC
- No persistent WebSocket reconnection (browser must be open)
- File size limits for safety
- No audit logging

### Future Enhancements
- PostgreSQL backend for multi-user/team
- Session sharing (readonly, edit, admin permissions)
- Scheduled queries (cron-like)
- Analytics dashboard (cost trends, rate limit forecasting)
- Slack/Teams integration
- API key for third-party integrations
- Batch operations (run same query on 10 projects)
- Session branching UI (visual fork explorer)

---

## Conclusion

Claude Code Web decouples the Claude SDK runtime from the browser interface, enabling:
- **Persistence**: Sessions survive browser disconnect
- **Mobile access**: Full Claude capabilities from phone
- **Autonomous execution**: Run tasks headless with push notifications
- **Multi-project isolation**: Different permission levels per project
- **Cost visibility**: Real-time rate limit + spending tracking

Built with FastAPI, React, and Claude Agent SDK. Fully async, production-ready, extensible.
