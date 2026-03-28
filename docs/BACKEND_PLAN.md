# Backend Implementation Plan — Claude Code Web Terminal

**Goal:** A remote, persistent Claude Code terminal accessible via web (desktop + mobile). Sessions survive browser close/refresh — like tmux for Claude Code. Fully autonomous execution with runtime-configurable permissions.

**Approach:** Clean rewrite. The current 1600-line backend has two conflicting session systems, raw inotify hacks, no persistence, and missing SDK features. A clean rewrite with proper architecture will be faster and more reliable than patching.

---

## Architecture Overview

```
Browser (WebSocket + REST + Push Notifications)
    |
    +-- Service Worker          Receives push events when browser is closed
    |                           Shows OS-level notification → click opens app
    |
FastAPI Server
    |
    +-- /ws/claude              WebSocket: persistent Claude sessions (tmux-like)
    +-- /ws/terminal            WebSocket: PTY shell access
    +-- /ws/watch               WebSocket: filesystem change events
    |
    +-- /api/sessions           REST: session CRUD, list, metadata
    +-- /api/projects           REST: project listing
    +-- /api/files              REST: file tree + file reader
    +-- /api/config             REST: global + per-session config (permissions, model, tools)
    +-- /api/notifications      REST: push subscription management
    |
SessionManager (singleton)
    |
    +-- ManagedSession[]        Each wraps a ClaudeSDKClient
    |       +-- message_log         In-memory buffer (fast broadcast)
    |       +-- attached_ws         Set of connected browsers
    |       +-- query_queue         Async queue for prompts
    |       +-- permission bridge
    |
NotificationManager (singleton)
    |   Sends Web Push when browser is closed + permission needed
    |   Uses VAPID keys + pywebpush
    |
SQLite (via aiosqlite)
    |
    +-- sessions                Metadata: id, cwd, name, created_at, status, cost, config
    +-- messages                Durable message log (replay on reconnect)
    +-- projects                Saved project directories
    +-- push_subscriptions      Web Push subscription endpoints
```

---

## Tech Stack

| Component | Choice | Why |
|---|---|---|
| Framework | **FastAPI** | Already using. Async, WebSocket native, Pydantic validation |
| Database | **SQLite + aiosqlite** | Zero ops, single file, async, sufficient for single-user internal tool |
| File watching | **watchfiles** | Already a dependency. Uses Rust notify under the hood, cross-platform |
| Terminal PTY | **ptyprocess** | Already a dependency. Cleaner than raw pty/fcntl |
| Claude SDK | **claude-agent-sdk** | `ClaudeSDKClient` for persistent sessions, `query()` for one-shots |
| Server | **uvicorn** | Already using |

### Dependencies to add
```
aiosqlite>=0.21.0    # async sqlite
pywebpush>=2.0.0     # Web Push notifications (VAPID)
cryptography>=44.0    # VAPID key generation (pywebpush peer dep)
```

### Dependencies to remove
```
uuid-utils           # stdlib uuid is fine
websockets           # fastapi handles websockets natively via starlette
```

---

## Module Structure (clean rewrite)

```
my-agent/
  server.py                 # FastAPI app, startup/shutdown, static mount
  db.py                     # SQLite schema, connection, queries
  session_manager.py        # Core: persistent Claude sessions (the brain)
  notifications.py          # Web Push notification manager (VAPID + pywebpush)
  serializers.py            # SDK message -> JSON (keep existing, it's solid)
  routes/
    __init__.py             # mount_routes()
    sessions.py             # /api/sessions — CRUD, metadata, config
    projects.py             # /api/projects, /api/files — project browser
    notifications.py        # /api/notifications — push subscription endpoints
    claude_ws.py            # /ws/claude — main Claude WebSocket
    terminal_ws.py          # /ws/terminal — PTY shell WebSocket
    watcher_ws.py           # /ws/watch — filesystem events WebSocket
```

**What gets deleted entirely:**
- `agent.py` — wiki agent with in-memory sessions, duplicate system prompt, `_scan_project`. All replaced by `session_manager.py` using `ClaudeSDKClient` directly.
- `utils/permissions.py` — folded into `session_manager.py`
- `utils/session_manager.py` — rewritten as top-level `session_manager.py`
- `utils/` directory — gone
- `routes/wiki.py` — merged into `routes/sessions.py`
- `routes/claude.py` — rewritten as `routes/claude_ws.py`
- `routes/watcher.py` — rewritten cleanly with `watchfiles` only (no raw inotify)
- `routes/files.py` — rewritten as `routes/projects.py`
- `hello.py`, `hello.ts`, `_test.tmp`, `_test_inotify.tmp`, `testdir/` — cleanup

---

## 1. Database Layer (`db.py`)

SQLite with 3 tables. All async via `aiosqlite`.

### Schema

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,           -- uuid
    sdk_session_id  TEXT,                       -- Claude SDK's session ID (for resume)
    cwd             TEXT NOT NULL,              -- working directory
    name            TEXT NOT NULL DEFAULT '',   -- user-given name or auto from first prompt
    status          TEXT NOT NULL DEFAULT 'idle', -- idle | thinking | waiting_permission | error | dead
    permission_mode TEXT NOT NULL DEFAULT 'acceptEdits',
    model           TEXT DEFAULT NULL,          -- null = SDK default
    allowed_tools   TEXT DEFAULT NULL,          -- JSON array or null (= all)
    disallowed_tools TEXT DEFAULT NULL,         -- JSON array or null
    system_prompt   TEXT DEFAULT NULL,          -- custom system prompt override
    max_turns       INTEGER DEFAULT NULL,       -- turn limit per query
    max_budget_usd  REAL DEFAULT NULL,          -- cost limit per query
    total_cost_usd  REAL NOT NULL DEFAULT 0.0,
    total_turns     INTEGER NOT NULL DEFAULT 0,
    message_count   INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,              -- ISO 8601
    updated_at      TEXT NOT NULL,              -- ISO 8601
    last_prompt     TEXT DEFAULT NULL           -- first 200 chars of last user prompt
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,               -- order within session
    type        TEXT NOT NULL,                   -- assistant | result | user_echo | system | permission_request | error | status
    data        TEXT NOT NULL,                   -- full JSON blob
    created_at  TEXT NOT NULL,
    UNIQUE(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, seq);

CREATE TABLE IF NOT EXISTS projects (
    path        TEXT PRIMARY KEY,               -- absolute path
    name        TEXT NOT NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,     -- 1 = pinned to top
    last_used   TEXT NOT NULL                   -- ISO 8601
);
```

### Key Functions

```python
async def init_db() -> aiosqlite.Connection
async def create_session(cwd, name, config) -> dict
async def get_session(session_id) -> dict | None
async def list_sessions(status=None, limit=50) -> list[dict]
async def update_session(session_id, **fields)
async def delete_session(session_id)

async def append_message(session_id, seq, msg_type, data) -> int
async def get_messages(session_id, after_seq=0, limit=500) -> list[dict]
async def get_message_count(session_id) -> int

async def upsert_project(path, name) -> dict
async def list_projects() -> list[dict]
async def delete_project(path)
```

---

## 2. Session Manager (`session_manager.py`)

The core of the system. Each `ManagedSession` wraps a `ClaudeSDKClient` that persists independently of browser connections.

### ManagedSession

```python
@dataclass
class ManagedSession:
    id: str                                     # our ID (matches DB)
    cwd: str
    client: ClaudeSDKClient | None = None
    reader_task: asyncio.Task | None = None     # reads SDK messages
    query_processor: asyncio.Task | None = None # processes query queue

    # State
    status: str = "idle"                        # idle | thinking | waiting_permission | error
    sdk_session_id: str | None = None
    total_cost: float = 0.0
    total_turns: int = 0

    # Config (mutable at runtime)
    permission_mode: str = "acceptEdits"
    model: str | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    system_prompt: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    mcp_servers: dict | None = None
    hooks: dict | None = None

    # Connections
    attached_ws: set[WebSocket] = field(default_factory=set)
    query_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    perm_futures: dict[str, asyncio.Future] = field(default_factory=dict)

    # In-memory message buffer (for fast replay without DB round-trip)
    message_log: list[dict] = field(default_factory=list)
    message_seq: int = 0
```

### SessionManager

```python
class SessionManager:
    def __init__(self, db, notifications: NotificationManager):
        self._sessions: dict[str, ManagedSession] = {}  # active sessions in memory
        self._db = db
        self._notifications = notifications

    # --- Lifecycle ---
    async def create(self, cwd, config=None) -> ManagedSession
    async def restore(self, session_id) -> ManagedSession       # restore from DB + resume SDK session
    async def destroy(self, session_id)                          # kill client, remove from memory (DB record stays)

    # --- Queries ---
    async def send_query(self, session: ManagedSession, prompt: str)
    async def interrupt(self, session: ManagedSession)

    # --- Runtime config ---
    async def update_config(self, session: ManagedSession, **changes)
        """
        Change permission_mode, model, allowed_tools, disallowed_tools,
        system_prompt, max_turns, max_budget_usd, mcp_servers at runtime.
        Updates both in-memory session and DB.
        Calls client.set_model() etc. where SDK supports it.
        """

    # --- Browser attach/detach (the tmux part) ---
    def attach(self, session, ws: WebSocket)
    def detach(self, session, ws: WebSocket)
    async def replay(self, session, ws: WebSocket, after_seq=0)  # send buffered messages to catch up

    # --- Permissions ---
    async def handle_permission(self, session, tool_name, tool_input) -> PermissionResult
    def resolve_permission(self, session, request_id, decision, message="")

    # --- Broadcasting ---
    async def broadcast(self, session, msg: dict)                # send to all attached browsers + persist to DB

    # --- Notifications (push when no browser) ---
    async def _notify_permission(self, session, request_id, tool_name, tool_input)
    async def _notify_status(self, session, title, body)

    # --- Startup ---
    async def restore_active_sessions(self)
        """
        On server startup, read sessions from DB where status != 'dead'.
        For sessions that were 'thinking' (server crashed mid-query), mark as 'idle'.
        Don't auto-reconnect SDK clients — let the user re-attach.
        """
```

### Permission Handler (detailed)

```python
async def handle_permission(self, session: ManagedSession, tool_name, tool_input):
    mode = session.permission_mode

    # 1. Bypass mode — allow everything
    if mode == "bypassPermissions":
        return PermissionResultAllow()

    # 2. Plan mode — deny all tools
    if mode == "plan":
        return PermissionResultDeny(message="Plan mode: no tool execution")

    # 3. acceptEdits mode — auto-allow safe tools
    safe_tools = {"Read", "Glob", "Grep", "Edit", "Write", "WebSearch", "WebFetch"}
    if mode == "acceptEdits" and tool_name in safe_tools:
        return PermissionResultAllow()

    # 4. Need human approval — try browser first, then push
    request_id = str(uuid4())
    future = asyncio.get_event_loop().create_future()
    session.perm_futures[request_id] = future

    perm_msg = {
        "type": "permission_request",
        "request_id": request_id,
        "tool_name": tool_name,
        "tool_input": tool_input if isinstance(tool_input, dict) else {"raw": str(tool_input)},
    }

    if session.attached_ws:
        # Browser is open — send via WebSocket
        session.message_log.append(perm_msg)
        await self.broadcast(session, perm_msg)
        await self.broadcast(session, {"type": "status", "status": "waiting_permission"})
    else:
        # No browser — send push notification
        await self._notify_permission(session, request_id, tool_name, tool_input)
        # Also persist the permission request to message_log so it shows on reconnect
        session.message_log.append(perm_msg)
        await self._db.append_message(session.id, session.message_seq, "permission_request", json.dumps(perm_msg))
        session.message_seq += 1

    try:
        return await asyncio.wait_for(future, timeout=300)  # 5 minute timeout
    except asyncio.TimeoutError:
        # Internal tool — auto-allow on timeout rather than blocking forever
        return PermissionResultAllow()
    finally:
        session.perm_futures.pop(request_id, None)


async def _notify_permission(self, session, request_id, tool_name, tool_input):
    """Send push notification for permission request."""
    session_row = await self._db.get_session(session.id)
    name = session_row["name"] if session_row else session.cwd.split("/")[-1]
    await self._notifications.send_permission_push(
        session_id=session.id,
        session_name=name,
        tool_name=tool_name,
        tool_input=tool_input if isinstance(tool_input, dict) else {},
        request_id=request_id,
    )


async def _notify_status(self, session, title, body):
    """Send push notification for status updates (task complete, error, etc.)."""
    if not session.attached_ws:  # only push when no browser is watching
        session_row = await self._db.get_session(session.id)
        name = session_row["name"] if session_row else session.cwd.split("/")[-1]
        await self._notifications.send_status_push(session.id, name, title, body)
```

### How a Query Flows

```
1. Browser sends: {"type": "query", "prompt": "Fix the bug in auth.py"}
2. claude_ws handler calls manager.send_query(session, prompt)
3. send_query() puts prompt on session.query_queue
4. _process_queries() loop picks it up:
   a. Sets status = "thinking", broadcasts status
   b. Calls session.client.query(prompt)
   c. _read_messages() loop picks up SDK messages:
      - Serializes each message
      - Appends to session.message_log (in-memory)
      - Persists to DB via append_message()
      - Broadcasts to all attached browsers
   d. On ResultMessage:
      - Updates cost, turns, sdk_session_id
      - Sets status = "idle"
      - Persists to DB
5. Browser closes? Session keeps running. Steps 4a-4d continue.
6. Browser reconnects:
   a. Attaches to session
   b. Gets replay of all messages since last seen (via after_seq)
   c. Sees current status
```

### How Permissions Flow

```
1. SDK calls can_use_tool(tool_name, tool_input, context)
2. session_manager.handle_permission() checks:
   a. permission_mode == "bypassPermissions" → allow immediately
   b. permission_mode == "acceptEdits" + safe tool → allow immediately
   c. permission_mode == "plan" → deny (no tool execution)
   d. Has attached browser?
      → send permission_request via WebSocket, await future (up to 5 min timeout)
   e. No browser attached (headless)?
      → send push notification, await future (up to 5 min timeout)
      → if push fails or no subscriptions exist:
          - acceptEdits mode → auto-allow
          - default mode + read-only tool → auto-allow
          - otherwise → auto-allow (internal tool, user chose autonomy)
3. Browser/notification receives permission_request
4. User approves via:
   Option A: WebSocket (browser is open) — permission_response message
   Option B: Notification action button (browser closed) — REST POST /api/sessions/:id/permission
   Option C: Opens browser from notification click — then uses WebSocket
5. resolve_permission() resolves the future → SDK continues
6. If timeout (5 min) with no response → auto-allow (internal tool, don't block)
```

### Permission Mode Behavior Summary

| Mode | Browser attached | Browser closed | No push subscription |
|---|---|---|---|
| `bypassPermissions` | Auto-allow all | Auto-allow all | Auto-allow all |
| `acceptEdits` | Auto-allow safe tools, ask browser for Bash/dangerous | Auto-allow safe tools, push notify for Bash/dangerous | Auto-allow all |
| `default` | Ask browser for everything | Push notify for everything | Auto-allow read-only, auto-allow rest (internal) |
| `plan` | Deny all tool execution | Deny all tool execution | Deny all tool execution |

**Key design decisions:**
- Default `permission_mode` is `acceptEdits` — autonomous for safe ops, asks for dangerous ones
- Push notifications are the bridge between "I want control" and "I want to close my browser"
- When no browser AND no push subscription → **auto-allow** (internal tool, user accepts the risk)
- 5-minute timeout on all permission requests → auto-allow on timeout (don't block forever)
- User can switch to `bypassPermissions` anytime for full no-ask autonomy
- Quick-approve from notification action buttons means user doesn't even need to open the browser

---

## 3. Claude WebSocket (`routes/claude_ws.py`)

The main interaction channel. Handles all Claude session communication.

### Protocol (browser -> server)

```json
// Send a prompt
{"type": "query", "prompt": "Fix the tests"}

// Respond to a permission request
{"type": "permission_response", "request_id": "uuid", "decision": "allow"}
// decision: "allow" | "deny" | "allow_always" (switches to bypassPermissions for session)

// Interrupt current query
{"type": "interrupt"}

// Update session config
{"type": "config", "permission_mode": "bypassPermissions"}
{"type": "config", "model": "claude-sonnet-4-6"}
{"type": "config", "allowed_tools": ["Read", "Edit", "Bash", "Glob", "Grep"]}
{"type": "config", "system_prompt": "You are a senior Go developer..."}
{"type": "config", "max_turns": 50}
{"type": "config", "max_budget_usd": 5.0}
{"type": "config", "mcp_servers": {"playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}}}

// Reconnect to specific session
{"type": "attach", "session_id": "uuid"}

// Request full replay (e.g. after reconnect)
{"type": "replay", "after_seq": 42}
```

### Protocol (server -> browser)

```json
// Session info (sent on connect/attach)
{"type": "session_info", "session_id": "uuid", "sdk_session_id": "...", "status": "idle", "config": {...}, "total_cost": 0.0, "total_turns": 0, "message_count": 0}

// Status changes
{"type": "status", "status": "thinking"}
{"type": "status", "status": "idle"}
{"type": "status", "status": "waiting_permission"}

// Claude messages (streamed as they arrive)
{"type": "assistant", "seq": 5, "content": [{"type": "text", "text": "..."}]}
{"type": "assistant", "seq": 6, "content": [{"type": "tool_use", "name": "Edit", "id": "...", "input": {...}}]}
{"type": "assistant", "seq": 7, "content": [{"type": "tool_result", "content": "...", "is_error": false}]}
{"type": "result", "seq": 8, "session_id": "...", "total_cost_usd": 0.03, "duration_ms": 4200}

// Permission request
{"type": "permission_request", "request_id": "uuid", "tool_name": "Bash", "tool_input": {"command": "rm -rf dist/"}}

// Errors
{"type": "error", "message": "SDK connection lost"}

// Replay markers
{"type": "replay_start", "total": 42, "from_seq": 0}
{"type": "replay_end"}
```

### Connection Flow

```
1. Browser connects: ws://host/ws/claude?session_id=uuid
   - If session_id provided and session exists in memory → attach
   - If session_id provided but not in memory → restore from DB, resume SDK session, attach
   - If no session_id → check for ?cwd= param, create new session

2. Server sends session_info with current state

3. Server replays buffered messages (message_log or from DB if buffer was trimmed)

4. Server sends current status

5. Main loop: read browser messages, dispatch to session_manager
```

---

## 4. Session REST API (`routes/sessions.py`)

For non-WebSocket operations — session management, metadata, config.

```
GET    /api/sessions                       List all sessions (with filters: ?status=idle&cwd=/path)
POST   /api/sessions                       Create session {"cwd": "/path", "name": "optional", "config": {...}}
GET    /api/sessions/:id                   Get session details + config
PATCH  /api/sessions/:id                   Update metadata (name) or config (permissions, model, tools)
DELETE /api/sessions/:id                   Delete session (kills client if running)
GET    /api/sessions/:id/messages          Get message history (paginated: ?after_seq=0&limit=100)
POST   /api/sessions/:id/query             Headless query {"prompt": "..."} (no WebSocket needed)
POST   /api/sessions/:id/permission        Quick-approve from push notification service worker
GET    /api/sessions/:id/cost              Get cost breakdown
```

---

## 5. Project Browser (`routes/projects.py`)

```
GET    /api/projects                   List saved/discovered projects
POST   /api/projects                   Save a project path {"path": "/home/user/myapp"}
DELETE /api/projects/:path             Remove a saved project
GET    /api/projects/tree?path=/x      File tree for a directory (max_depth configurable)
POST   /api/projects/file              Read a file {"project_path": "/x", "file_path": "src/main.py"}
```

File tree and file reader logic from current `agent.py` (`get_file_tree`, `read_file`, `classify_file`) is solid — keep as-is, move to a `file_utils.py` or inline in the route.

---

## 6. Terminal WebSocket (`routes/terminal_ws.py`)

Rewrite using `ptyprocess` instead of raw `pty` + `fcntl` + `select`.

```
ws://host/ws/terminal?cwd=/path/to/project

Browser -> Server:
  - Raw text input (keystrokes)
  - "\x1b[resize:COLS,ROWS" (resize signal)

Server -> Browser:
  - Raw terminal output (text)
```

The current implementation works but uses raw `pty.openpty()` + `fcntl` + `select` in a `run_in_executor`. Rewrite with `ptyprocess.PtyProcess` for cleaner code:

```python
proc = PtyProcess.spawn([shell, "--login"], cwd=cwd, env=env, dimensions=(rows, cols))
# proc.read() / proc.write() / proc.setwinsize() — much cleaner
```

---

## 7. File Watcher (`routes/watcher_ws.py`)

**Kill the raw inotify implementation entirely.** Use `watchfiles.awatch()` consistently.

```python
async def watch_project(project_dir: str, ws: WebSocket):
    async for changes in awatch(project_dir, watch_filter=ignore_filter):
        events = []
        for change_type, path in changes:
            rel = os.path.relpath(path, project_dir)
            events.append({"change": change_type.name, "path": rel})
        await ws.send_json({"type": "fs_change", "events": events})
```

That's it. ~20 lines instead of 150.

---

## 8. Push Notifications (`notifications.py`)

When the user sets a permission mode that requires approval (e.g. `default`) and then closes the browser, the agent would normally block forever waiting for a human. Push notifications solve this — the server sends an OS-level notification to the user's device even when the browser tab is closed. The user taps it, the browser opens, and they approve/deny.

### How Web Push Works

```
One-time setup:
1. Server generates VAPID key pair (stored in DB or .env)
2. Browser requests notification permission from OS
3. Browser subscribes to push via Push API → gets a subscription object (endpoint URL + keys)
4. Browser sends subscription to server → stored in DB

When permission is needed + no browser attached:
1. SDK calls can_use_tool() → session_manager sees no attached WebSocket
2. session_manager calls notification_manager.send_permission_push(session, tool_name, tool_input)
3. notification_manager uses pywebpush to POST to the subscription endpoint
4. Browser's service worker receives the push event (even if tab is closed)
5. Service worker shows OS notification: "Claude needs permission: Bash(rm -rf dist/)"
6. User clicks notification → browser opens to /session/:id with the permission dialog
7. User approves → WebSocket sends permission_response → future resolves → SDK continues
```

### VAPID Keys

Generated once on first server start, stored in DB (or a `.env` file).

```python
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

def generate_vapid_keys() -> tuple[str, str]:
    """Generate VAPID key pair. Returns (private_key_b64, public_key_b64)."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_bytes = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return (
        base64.urlsafe_b64encode(private_bytes).decode().rstrip("="),
        base64.urlsafe_b64encode(public_bytes).decode().rstrip("="),
    )
```

### DB Table

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint    TEXT NOT NULL UNIQUE,            -- push service URL
    p256dh      TEXT NOT NULL,                   -- client public key
    auth        TEXT NOT NULL,                   -- client auth secret
    user_agent  TEXT DEFAULT NULL,               -- for debugging
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vapid_keys (
    id          INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
    private_key TEXT NOT NULL,
    public_key  TEXT NOT NULL
);
```

### NotificationManager

```python
from pywebpush import webpush, WebPushException
import json

class NotificationManager:
    def __init__(self, db):
        self._db = db
        self._vapid_private: str | None = None
        self._vapid_public: str | None = None

    async def init(self):
        """Load or generate VAPID keys."""
        keys = await self._db.get_vapid_keys()
        if keys:
            self._vapid_private = keys["private_key"]
            self._vapid_public = keys["public_key"]
        else:
            self._vapid_private, self._vapid_public = generate_vapid_keys()
            await self._db.save_vapid_keys(self._vapid_private, self._vapid_public)

    @property
    def public_key(self) -> str:
        """VAPID public key — browser needs this to subscribe."""
        return self._vapid_public

    async def subscribe(self, subscription: dict):
        """Store a push subscription from the browser."""
        await self._db.save_push_subscription(
            endpoint=subscription["endpoint"],
            p256dh=subscription["keys"]["p256dh"],
            auth=subscription["keys"]["auth"],
            user_agent=subscription.get("user_agent"),
        )

    async def unsubscribe(self, endpoint: str):
        """Remove a push subscription."""
        await self._db.delete_push_subscription(endpoint)

    async def send_permission_push(self, session_id: str, session_name: str,
                                    tool_name: str, tool_input: dict,
                                    request_id: str):
        """Send push notification for a permission request."""
        # Build a human-readable summary of what the tool wants to do
        summary = self._summarize_tool(tool_name, tool_input)

        payload = json.dumps({
            "type": "permission_request",
            "title": f"Claude needs permission",
            "body": f"[{session_name}] {summary}",
            "session_id": session_id,
            "request_id": request_id,
            "tool_name": tool_name,
            "url": f"/session/{session_id}",  # deep link to the session
        })

        subscriptions = await self._db.get_all_push_subscriptions()
        dead_endpoints = []

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=self._vapid_private,
                    vapid_claims={"sub": "mailto:internal@localhost"},
                )
            except WebPushException as e:
                if e.response and e.response.status_code in (404, 410):
                    # Subscription expired or invalid — clean it up
                    dead_endpoints.append(sub["endpoint"])
                # Other errors: log but don't crash

        # Clean up dead subscriptions
        for endpoint in dead_endpoints:
            await self._db.delete_push_subscription(endpoint)

    async def send_status_push(self, session_id: str, session_name: str,
                                title: str, body: str):
        """Send a generic status notification (task complete, error, etc.)."""
        payload = json.dumps({
            "type": "status",
            "title": title,
            "body": body,
            "session_id": session_id,
            "url": f"/session/{session_id}",
        })

        subscriptions = await self._db.get_all_push_subscriptions()
        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=self._vapid_private,
                    vapid_claims={"sub": "mailto:internal@localhost"},
                )
            except WebPushException:
                pass

    def _summarize_tool(self, tool_name: str, tool_input: dict) -> str:
        """Human-readable summary for notification body."""
        if tool_name == "Bash":
            cmd = tool_input.get("command", "")
            return f"Run: {cmd[:80]}{'...' if len(cmd) > 80 else ''}"
        if tool_name in ("Write", "Edit"):
            path = tool_input.get("file_path", "unknown")
            return f"{tool_name}: {path}"
        if tool_name == "WebFetch":
            url = tool_input.get("url", "")
            return f"Fetch: {url[:60]}"
        return f"Use tool: {tool_name}"
```

### REST Endpoints (`routes/notifications.py`)

```python
router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/vapid-public-key")
async def get_vapid_key(request: Request):
    """Browser calls this to get the VAPID public key for subscription."""
    manager = request.app.state.notifications
    return {"public_key": manager.public_key}

@router.post("/subscribe")
async def subscribe(request: Request, body: PushSubscription):
    """Browser sends its push subscription after user grants permission."""
    manager = request.app.state.notifications
    await manager.subscribe(body.dict())
    return {"status": "subscribed"}

@router.post("/unsubscribe")
async def unsubscribe(request: Request, body: UnsubscribeRequest):
    """Remove a push subscription."""
    manager = request.app.state.notifications
    await manager.unsubscribe(body.endpoint)
    return {"status": "unsubscribed"}

@router.post("/test")
async def test_push(request: Request):
    """Send a test notification to verify push is working."""
    manager = request.app.state.notifications
    await manager.send_status_push("test", "Test", "Push works!", "Notifications are configured correctly.")
    return {"status": "sent"}
```

### Notification Types

| Trigger | When | Notification Content |
|---|---|---|
| **Permission request (no browser)** | Agent needs approval + no WebSocket attached | "Claude needs permission: Bash(npm install)" |
| **Permission request (timeout warning)** | 60s without response (browser open or not) | "Permission timing out in 4 min — approve/deny?" |
| **Task complete** | `ResultMessage` received + no browser attached | "Task complete: Fixed 3 bugs in auth.py ($0.04)" |
| **Task error** | Error + no browser attached | "Task failed: API rate limit hit" |
| **Budget warning** | Cost exceeds 80% of `max_budget_usd` | "Session nearing budget: $4.12 / $5.00" |

### Service Worker (frontend context — for backend understanding)

The service worker is a frontend file (`static/sw.js`) but the backend needs to understand what it does because it shapes the push payload format:

```javascript
// static/sw.js — receives push events even when browser tab is closed
self.addEventListener('push', (event) => {
    const data = event.data.json();

    const options = {
        body: data.body,
        icon: '/static/icon-192.png',
        badge: '/static/badge-72.png',
        tag: data.type === 'permission_request' ? `perm-${data.request_id}` : `status-${data.session_id}`,
        renotify: true,
        requireInteraction: data.type === 'permission_request',  // permission notifications stay until clicked
        data: { url: data.url, session_id: data.session_id, request_id: data.request_id },
        actions: data.type === 'permission_request'
            ? [{ action: 'allow', title: 'Allow' }, { action: 'deny', title: 'Deny' }]
            : [],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Quick-approve from notification action button (no need to open browser)
    if (event.action === 'allow' || event.action === 'deny') {
        // POST to /api/sessions/:id/permission to resolve without opening the browser
        event.waitUntil(
            fetch(`/api/sessions/${event.notification.data.session_id}/permission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_id: event.notification.data.request_id,
                    decision: event.action,
                }),
            })
        );
        return;
    }

    // Default click: open/focus the session page
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(event.notification.data.url)) {
                    return client.focus();
                }
            }
            return clients.openWindow(event.notification.data.url);
        })
    );
});
```

### Quick-Approve REST Endpoint (for service worker action buttons)

The service worker can't use WebSocket. It needs a REST endpoint to resolve permissions directly:

```
POST /api/sessions/:id/permission
Body: {"request_id": "uuid", "decision": "allow"}
```

This endpoint looks up the session in `SessionManager`, calls `resolve_permission()`, and returns `200`. This lets users approve/deny **directly from the notification** without opening the browser.

---

## 9. Server Setup (`server.py`)


```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import init_db, close_db
from session_manager import SessionManager
from notifications import NotificationManager
from routes import mount_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.db = await init_db()
    app.state.notifications = NotificationManager(app.state.db)
    await app.state.notifications.init()  # load/generate VAPID keys
    app.state.manager = SessionManager(app.state.db, app.state.notifications)
    await app.state.manager.restore_active_sessions()
    yield
    # Shutdown — sessions keep their SDK state via JSONL, we just update DB
    await close_db(app.state.db)


app = FastAPI(title="Claude Code Web", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")
mount_routes(app)

# SPA catch-all
@app.get("/{path:path}")
async def spa(path: str):
    return FileResponse("templates/index.html")
```

---

## 10. ClaudeSDKClient Usage Details

### Creating a Session

```python
async def _start_client(self, session: ManagedSession):
    options = ClaudeAgentOptions(
        permission_mode="default",           # always default — we handle permissions ourselves
        can_use_tool=lambda t, i, c: self._handle_permission(session, t, i),
        cwd=session.cwd,
        resume=session.sdk_session_id,       # None for new sessions
        include_partial_messages=True,        # stream partial text as it's generated
        allowed_tools=session.allowed_tools,
        disallowed_tools=session.disallowed_tools,
        system_prompt=session.system_prompt,
        max_turns=session.max_turns,
        mcp_servers=session.mcp_servers,
    )

    session.client = ClaudeSDKClient(options=options)
    await session.client.connect()
    session.reader_task = asyncio.create_task(self._read_messages(session))
    session.query_processor = asyncio.create_task(self._process_queries(session))
```

### Resuming After Server Restart

```python
async def restore(self, session_id: str) -> ManagedSession:
    row = await self._db.get_session(session_id)
    if not row:
        raise ValueError(f"Session {session_id} not found")

    session = ManagedSession(
        id=row["id"],
        cwd=row["cwd"],
        sdk_session_id=row["sdk_session_id"],
        permission_mode=row["permission_mode"],
        model=row["model"],
        allowed_tools=json.loads(row["allowed_tools"]) if row["allowed_tools"] else None,
        disallowed_tools=json.loads(row["disallowed_tools"]) if row["disallowed_tools"] else None,
        system_prompt=row["system_prompt"],
        total_cost=row["total_cost_usd"],
        total_turns=row["total_turns"],
    )

    # Load message history into memory buffer
    messages = await self._db.get_messages(session_id)
    session.message_log = [json.loads(m["data"]) for m in messages]
    session.message_seq = len(messages)

    # Start SDK client with resume
    await self._start_client(session)
    self._sessions[session.id] = session
    return session
```

### Runtime Config Changes

```python
async def update_config(self, session: ManagedSession, **changes):
    if "permission_mode" in changes:
        session.permission_mode = changes["permission_mode"]

    if "model" in changes and session.client:
        await session.client.set_model(changes["model"])
        session.model = changes["model"]

    if "allowed_tools" in changes:
        session.allowed_tools = changes["allowed_tools"]

    if "disallowed_tools" in changes:
        session.disallowed_tools = changes["disallowed_tools"]

    if "system_prompt" in changes:
        session.system_prompt = changes["system_prompt"]

    if "mcp_servers" in changes:
        session.mcp_servers = changes["mcp_servers"]
        # Note: MCP server changes require client restart
        # Queue a client restart after current query completes

    if "max_turns" in changes:
        session.max_turns = changes["max_turns"]

    if "max_budget_usd" in changes:
        session.max_budget_usd = changes["max_budget_usd"]

    # Persist to DB
    await self._db.update_session(session.id, **changes)

    # Notify attached browsers
    await self.broadcast(session, {
        "type": "config_updated",
        "config": self._get_config_dict(session),
    })
```

---

## 11. Agent SDK Features to Expose

### Priority 1 — Core (must have for v1)

| Feature | How |
|---|---|
| **Persistent sessions** | `ClaudeSDKClient` + `resume` + SQLite metadata |
| **All built-in tools** | `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebSearch`, `WebFetch`, `Agent` (subagents) |
| **Permission modes** | `acceptEdits` (default), `bypassPermissions`, `default`, `plan` — switchable via UI |
| **Tool allow/deny** | `allowed_tools` / `disallowed_tools` configurable per session |
| **Streaming** | SDK messages streamed via WebSocket as they arrive |
| **Interrupt** | `client.interrupt()` — stop mid-query |
| **Cost tracking** | `total_cost_usd` from `ResultMessage`, accumulated per session |
| **Model selection** | `client.set_model()` — switchable mid-session |
| **Custom system prompt** | Per-session `system_prompt` option |
| **Headless mode** | When no browser attached, auto-allow permissions so agent doesn't block |

### Priority 2 — Power features (v1.1)

| Feature | How |
|---|---|
| **Session resume/fork** | `resume=session_id`, `fork_session=True` — expose via REST API |
| **MCP servers** | Configurable per session. User adds servers from UI, passed to `ClaudeAgentOptions.mcp_servers` |
| **Subagents** | Expose via `AgentDefinition` in session config. Track `parent_tool_use_id` in message display |
| **Hooks** | `PreToolUse`/`PostToolUse` — at minimum for audit logging. Configurable block rules |
| **Turn/budget limits** | `max_turns`, `max_budget_usd` — safety rails |
| **AskUserQuestion** | Route to browser as a special message type, user responds via WebSocket |

### Priority 3 — Nice to have (v2)

| Feature | How |
|---|---|
| **Skills** | Load `.claude/skills/*/SKILL.md` via `setting_sources=["project"]` |
| **Slash commands** | Load `.claude/commands/*.md` |
| **CLAUDE.md loading** | `setting_sources=["project"]` |
| **File checkpointing** | Snapshot/revert file changes per query |
| **Session tagging/renaming** | `tag_session()`, `rename_session()` |
| **Notification hooks** | Forward agent notifications to the UI (permission prompts, idle, etc.) |

---

## 12. WebSocket Message Sequence Diagram

### Happy Path: New Session + Query

```
Browser                     Server                      Claude SDK
   |                           |                            |
   |-- ws connect ------------->|                            |
   |                           |-- create session            |
   |                           |-- start ClaudeSDKClient --->|
   |<-- session_info ----------|                            |
   |<-- status: idle ----------|                            |
   |                           |                            |
   |-- query: "Fix bug" ------>|                            |
   |                           |-- client.query("Fix bug")->|
   |<-- status: thinking ------|                            |
   |                           |                            |
   |                           |<-- AssistantMessage -------|
   |<-- assistant (text) ------|                            |
   |                           |<-- AssistantMessage -------|
   |<-- assistant (tool_use) --|                            |
   |                           |<-- (tool executes)         |
   |<-- assistant (tool_result)|                            |
   |                           |<-- AssistantMessage -------|
   |<-- assistant (text) ------|                            |
   |                           |<-- ResultMessage ----------|
   |<-- result ----------------|                            |
   |<-- status: idle ----------|                            |
```

### Reconnect After Browser Close

```
Browser                     Server                      Claude SDK
   |                           |                            |
   |  (browser was closed)     |   (session still running)  |
   |                           |<-- AssistantMessage -------|
   |                           |-- persist to DB + buffer   |
   |                           |<-- ResultMessage ----------|
   |                           |-- persist, status=idle     |
   |                           |                            |
   |-- ws connect (session_id)->|                           |
   |                           |-- attach browser           |
   |<-- session_info ----------|                            |
   |<-- replay_start ----------|                            |
   |<-- (all missed messages) -|  (from buffer / DB)        |
   |<-- replay_end ------------|                            |
   |<-- status: idle ----------|                            |
```

### Permission Request (Browser Open)

```
Browser                     Server                      Claude SDK
   |                           |                            |
   |                           |<-- can_use_tool("Bash")----|
   |                           |-- check permission_mode    |
   |                           |   (not auto-allowed)       |
   |<-- permission_request ----|                            |
   |<-- status: waiting -------|                            |
   |                           |                            |
   |-- permission_response --->|                            |
   |   (decision: "allow")     |-- PermissionResultAllow -->|
   |<-- status: thinking ------|                            |
   |                           |<-- (tool executes) --------|
```

### Permission Request (Browser Closed — Push Notification)

```
Phone/Desktop               Server                      Claude SDK
   |                           |                            |
   |  (browser closed)         |<-- can_use_tool("Bash")----|
   |                           |-- no WebSocket attached    |
   |                           |-- send push via pywebpush  |
   |<-- OS notification -------|                            |
   |   "Claude needs permission|                            |
   |    Run: npm install"      |                            |
   |                           |                            |
   | [User taps "Allow" on     |                            |
   |  notification action btn] |                            |
   |                           |                            |
   |-- POST /api/.../permission|                            |
   |   {"decision": "allow"}   |-- PermissionResultAllow -->|
   |                           |<-- (tool executes) --------|
   |                           |                            |
   |  (OR: user taps notif     |                            |
   |   body → browser opens    |                            |
   |   → WebSocket connects    |                            |
   |   → full UI permission)   |                            |
```

### Task Completes While Browser Closed

```
Phone/Desktop               Server                      Claude SDK
   |                           |                            |
   |  (browser closed)         |<-- ResultMessage ----------|
   |                           |-- persist to DB            |
   |                           |-- no WebSocket attached    |
   |                           |-- send push notification   |
   |<-- OS notification -------|                            |
   |   "Task complete:         |                            |
   |    Fixed 3 bugs ($0.04)"  |                            |
   |                           |                            |
   | [User taps notification]  |                            |
   |-- browser opens /session/x|                            |
   |-- ws connect (session_id)->|                           |
   |<-- replay all messages ---|                            |
```

---

## 13. Implementation Order

### Step 1: Foundation
1. `db.py` — schema + async CRUD functions (including push_subscriptions + vapid_keys tables)
2. `serializers.py` — keep existing, minor cleanup
3. `notifications.py` — NotificationManager + VAPID key generation
4. `session_manager.py` — ManagedSession + SessionManager core (with NotificationManager integration)
5. `server.py` — FastAPI app with lifespan (init DB, notifications, session manager)

### Step 2: Core Routes
6. `routes/sessions.py` — REST CRUD + quick-approve endpoint (`POST /:id/permission`)
7. `routes/claude_ws.py` — main Claude WebSocket
8. `routes/notifications.py` — push subscription endpoints + VAPID public key + test push
9. Test: create session, send query, stream response, close browser, reconnect, get replay

### Step 3: Supporting Routes
10. `routes/projects.py` — project browser + file reader
11. `routes/terminal_ws.py` — PTY shell (rewrite with ptyprocess)
12. `routes/watcher_ws.py` — filesystem watcher (watchfiles only)

### Step 4: Push Notifications
13. Service worker (`static/sw.js`) — push event handler + notification click handler
14. Frontend push subscription flow (request permission, subscribe, send to server)
15. Test: set permission mode to `default`, close browser, trigger tool → get OS notification → approve from notification

### Step 5: Power Features
16. Runtime config updates (permission mode, model, tools)
17. MCP server configuration
18. Session resume/fork via REST API
19. Cost tracking + budget limits
20. AskUserQuestion routing
21. Push notifications for task complete, errors, budget warnings

---

## 14. Key Design Decisions

| Decision | Rationale |
|---|---|
| **SQLite not Postgres** | Single-user internal tool. Zero ops. `aiosqlite` is async. Can migrate later if needed. |
| **In-memory buffer + DB persistence** | Buffer for fast broadcast to connected browsers. DB for replay after restart. Buffer is trimmed at 1000 messages; older ones are DB-only. |
| **Default mode = acceptEdits** | Autonomous for safe ops (file edits), asks for dangerous ones (Bash). Best middle ground. |
| **Push notifications over auto-allow** | Instead of blindly auto-allowing when browser is closed, send a push notification. User gets control without needing the browser open. Auto-allow is the fallback when push isn't configured or times out. |
| **Quick-approve from notification** | Service worker action buttons let users approve/deny directly from the OS notification without opening the browser. REST endpoint (`POST /api/sessions/:id/permission`) enables this since service workers can't use WebSocket. |
| **5-min timeout → auto-allow** | For internal use, blocking forever is worse than auto-allowing. If user doesn't respond in 5 min, assume they're okay with it. This timeout is configurable per session. |
| **permission_mode set to "default" in SDK, handled ourselves** | We pass `can_use_tool` callback and manage permission logic in our code. This gives us full control over the permission flow and lets us route to browser, push notification, or auto-allow based on our own rules. |
| **No auth** | Internal tool, explicit user requirement. |
| **watchfiles over raw inotify** | Already a dependency. Rust-based, efficient, cross-platform. No reason to use raw syscalls. |
| **Single process, no Celery/Redis** | Single user, single machine. asyncio is sufficient for concurrency. pywebpush calls are fast enough to run inline. |
| **VAPID keys stored in DB** | Single source of truth. Auto-generated on first run. No manual key management. |

---

## 15. Updated `pyproject.toml`

```toml
[project]
name = "claude-code-web"
version = "1.0.0"
description = "Remote Claude Code terminal — persistent, autonomous, mobile-friendly"
requires-python = ">=3.12"
dependencies = [
    "claude-agent-sdk>=0.1.50",
    "fastapi>=0.135.2",
    "uvicorn>=0.42.0",
    "aiosqlite>=0.21.0",
    "ptyprocess>=0.7.0",
    "watchfiles>=1.1.1",
    "pywebpush>=2.0.0",
    "cryptography>=44.0",
]
```
