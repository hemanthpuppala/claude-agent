"""
Persistent Claude SDK Session Manager.

Sessions survive browser disconnects. The browser is just a viewer
that attaches/detaches — like tmux for Claude Code.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from uuid import uuid4

import aiosqlite
from fastapi import WebSocket

from claude_agent_sdk import (
    ClaudeSDKClient, ClaudeAgentOptions, ResultMessage,
    PermissionResultAllow, PermissionResultDeny,
)

from app.config import (
    DEFAULT_PERMISSION_MODE, PERMISSION_TIMEOUT, MESSAGE_BUFFER_SIZE,
)
from app.core.serializers import serialize_message
from app.core.notifications import NotificationManager
from app.database.queries.sessions import (
    create_session as db_create_session,
    get_session as db_get_session,
    list_sessions as db_list_sessions,
    update_session as db_update_session,
)
from app.database.queries.messages import (
    append_message as db_append_message,
    get_messages as db_get_messages,
)

log = logging.getLogger(__name__)

# Tools auto-approved in acceptEdits mode
SAFE_TOOLS = frozenset({
    "Read", "Glob", "Grep", "Edit", "Write", "WebSearch", "WebFetch",
})

# Read-only tools auto-approved in default mode (headless)
READ_ONLY_TOOLS = frozenset({"Read", "Glob", "Grep", "WebSearch"})


@dataclass
class ManagedSession:
    """A persistent Claude SDK session that outlives browser connections."""

    id: str
    cwd: str

    # SDK client
    client: ClaudeSDKClient | None = None
    reader_task: asyncio.Task | None = None
    query_processor: asyncio.Task | None = None

    # State
    status: str = "idle"
    sdk_session_id: str | None = None
    total_cost: float = 0.0
    total_turns: int = 0

    # Config (mutable at runtime)
    permission_mode: str = DEFAULT_PERMISSION_MODE
    model: str | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    system_prompt: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    mcp_servers: dict | None = None

    # Connections
    attached_ws: set = field(default_factory=set)
    query_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    perm_futures: dict[str, asyncio.Future] = field(default_factory=dict)
    # Track tool_use IDs that already had permission resolved (prevent re-asking)
    resolved_tool_ids: set = field(default_factory=set)

    # In-memory message buffer (fast replay without DB)
    message_log: list[dict] = field(default_factory=list)
    message_seq: int = 0


class SessionManager:
    """Manages persistent Claude SDK sessions."""

    def __init__(self, db: aiosqlite.Connection, notifications: NotificationManager):
        self._sessions: dict[str, ManagedSession] = {}
        self._db = db
        self._notifications = notifications

    # --- Lifecycle ---

    async def create(self, cwd: str, name: str = "", **config) -> ManagedSession:
        """Create a new persistent session. Supports resume and fork."""
        session_id = str(uuid4())
        resume_sdk = config.pop("resume_sdk_session", None)
        is_fork = config.pop("fork", False)

        session = ManagedSession(
            id=session_id,
            cwd=cwd,
            sdk_session_id=resume_sdk,
            permission_mode=config.get("permission_mode", DEFAULT_PERMISSION_MODE),
            model=config.get("model"),
            allowed_tools=config.get("allowed_tools"),
            disallowed_tools=config.get("disallowed_tools"),
            system_prompt=config.get("system_prompt"),
            max_turns=config.get("max_turns"),
            max_budget_usd=config.get("max_budget_usd"),
            mcp_servers=config.get("mcp_servers"),
        )

        await db_create_session(self._db, session_id, cwd, name, **config)
        if resume_sdk:
            await db_update_session(self._db, session_id, sdk_session_id=resume_sdk)
        await self._start_client(session, fork=is_fork)
        self._sessions[session_id] = session
        action = "Forked" if is_fork else "Resumed" if resume_sdk else "Created"
        log.info("%s session %s for %s", action, session_id[:8], cwd)
        return session

    async def restore(self, session_id: str) -> ManagedSession:
        """Restore a session from DB and resume the SDK client."""
        if session_id in self._sessions:
            return self._sessions[session_id]

        row = await db_get_session(self._db, session_id)
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
            max_turns=row["max_turns"],
            max_budget_usd=row["max_budget_usd"],
            total_cost=row["total_cost_usd"],
            total_turns=row["total_turns"],
        )

        # Load message history into buffer
        messages = await db_get_messages(self._db, session_id)
        session.message_log = [json.loads(m["data"]) for m in messages]
        session.message_seq = len(messages)

        await self._start_client(session)
        self._sessions[session_id] = session
        log.info("Restored session %s", session_id[:8])
        return session

    async def destroy(self, session_id: str):
        """Destroy a session — kill client, remove from memory. DB record stays."""
        session = self._sessions.pop(session_id, None)
        if not session:
            return
        for fut in session.perm_futures.values():
            if not fut.done():
                fut.cancel()
        if session.reader_task:
            session.reader_task.cancel()
        if session.query_processor:
            session.query_processor.cancel()
        if session.client:
            try:
                await session.client.disconnect()
            except Exception:
                pass
        await db_update_session(self._db, session_id, status="dead")
        log.info("Destroyed session %s", session_id[:8])

    def get(self, session_id: str) -> ManagedSession | None:
        """Get an active in-memory session."""
        return self._sessions.get(session_id)

    def list_active(self) -> list[dict]:
        """List all active in-memory sessions."""
        return [{
            "id": s.id,
            "cwd": s.cwd,
            "sdk_session_id": s.sdk_session_id,
            "status": s.status,
            "permission_mode": s.permission_mode,
            "model": s.model,
            "total_cost": s.total_cost,
            "total_turns": s.total_turns,
            "message_count": len(s.message_log),
            "attached_clients": len(s.attached_ws),
        } for s in self._sessions.values()]

    # --- Client Setup ---

    async def _start_client(self, session: ManagedSession, fork: bool = False):
        """Start the SDK client for a session."""
        async def can_use_tool(tool_name, tool_input, context):
            return await self._handle_permission(session, tool_name, tool_input)

        options = ClaudeAgentOptions(
            permission_mode="default",
            can_use_tool=can_use_tool,
            cwd=session.cwd,
            resume=session.sdk_session_id,
            include_partial_messages=False,
            allowed_tools=session.allowed_tools,
            disallowed_tools=session.disallowed_tools,
            system_prompt=session.system_prompt,
            max_turns=session.max_turns,
            mcp_servers=session.mcp_servers,
            fork_session=fork if fork else None,
            setting_sources=["project"],
        )

        session.client = ClaudeSDKClient(options=options)
        await session.client.connect()
        session.reader_task = asyncio.create_task(self._read_messages(session))
        session.query_processor = asyncio.create_task(self._process_queries(session))

    # --- Query Processing ---

    async def send_query(self, session: ManagedSession, prompt: str):
        """Queue a query and persist the user message."""
        # Store user message so it survives refresh/replay
        user_msg = {"type": "user_echo", "content": prompt, "seq": session.message_seq}
        session.message_seq += 1
        session.message_log.append(user_msg)
        if len(session.message_log) > MESSAGE_BUFFER_SIZE:
            session.message_log = session.message_log[-MESSAGE_BUFFER_SIZE:]
        await db_append_message(
            self._db, session.id, user_msg["seq"],
            "user_echo", json.dumps(user_msg),
        )
        # Broadcast to all attached browsers (other tabs viewing this session)
        await self._broadcast(session, user_msg)
        await session.query_queue.put(prompt)

    async def _process_queries(self, session: ManagedSession):
        """Process queued queries sequentially."""
        while True:
            try:
                prompt = await asyncio.wait_for(session.query_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            session.status = "thinking"
            session.resolved_tool_ids.clear()  # Reset for new query turn
            await self._broadcast(session, {"type": "status", "status": "thinking"})
            await db_update_session(
                self._db, session.id,
                status="thinking",
                last_prompt=prompt[:200],
            )

            try:
                await session.client.query(prompt)
            except Exception as e:
                log.error("Query error in %s: %s", session.id[:8], e)
                await self._broadcast(session, {"type": "error", "message": str(e)})
                session.status = "error"
                await db_update_session(self._db, session.id, status="error")

    # --- Message Reading ---

    async def _read_messages(self, session: ManagedSession):
        """Read messages from SDK and broadcast to attached browsers + persist."""
        try:
            async for msg in session.client.receive_messages():
                serialized = serialize_message(msg, seq=session.message_seq)
                if serialized is None:
                    continue

                msg_type = serialized.get("type", "")

                # Stream events are ephemeral — broadcast but don't persist
                if msg_type == "stream":
                    await self._broadcast(session, serialized)
                    continue

                # System init/config messages are internal — don't persist or broadcast
                if msg_type == "system" and serialized.get("subtype") in ("init", "config"):
                    continue

                # Deduplicate: SDK re-emits assistant messages after permission.
                # If the last message in the buffer has the same type and content, replace it.
                is_dup = False
                if session.message_log and msg_type == "assistant":
                    last = session.message_log[-1]
                    if last.get("type") == "assistant":
                        last_content = json.dumps(last.get("content", []), sort_keys=True)
                        new_content = json.dumps(serialized.get("content", []), sort_keys=True)
                        if last_content == new_content:
                            is_dup = True
                            serialized["seq"] = last.get("seq", session.message_seq)
                            session.message_log[-1] = serialized

                if not is_dup:
                    serialized["seq"] = session.message_seq
                    session.message_seq += 1
                    session.message_log.append(serialized)
                    if len(session.message_log) > MESSAGE_BUFFER_SIZE:
                        session.message_log = session.message_log[-MESSAGE_BUFFER_SIZE:]

                await db_append_message(
                    self._db, session.id, serialized["seq"],
                    msg_type, json.dumps(serialized),
                )
                if not is_dup:
                    await self._broadcast(session, serialized)

                # Handle result messages
                if isinstance(msg, ResultMessage):
                    session.status = "idle"
                    session.sdk_session_id = getattr(msg, "session_id", session.sdk_session_id)
                    cost = getattr(msg, "total_cost_usd", 0) or 0
                    turns = getattr(msg, "num_turns", 0) or 0
                    session.total_cost += cost
                    session.total_turns += turns

                    await db_update_session(
                        self._db, session.id,
                        status="idle",
                        sdk_session_id=session.sdk_session_id,
                        total_cost_usd=session.total_cost,
                        total_turns=session.total_turns,
                    )
                    await self._broadcast(session, {"type": "status", "status": "idle"})

                    # Push notification if no browser attached
                    if not session.attached_ws:
                        project_name = session.cwd.split("/")[-1]
                        is_error = getattr(msg, "is_error", False)
                        if is_error:
                            title, body = "Task failed", str(getattr(msg, "result", "Unknown error"))
                        else:
                            title = "Task complete"
                            body = f"${cost:.4f} · {turns} turns" if cost else "Done"
                        await self._notifications.send_status_push(session.id, project_name, title, body)
                        await self._notifications.send_ntfy_status(session.id, project_name, title, body)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            log.error("Message reader error in %s: %s", session.id[:8], e)
            await self._broadcast(session, {"type": "error", "message": str(e)})

    # --- Permission Handling ---

    async def _handle_permission(self, session: ManagedSession,
                                 tool_name: str, tool_input) -> object:
        """Route permission: check mode, ask browser or push, or auto-allow."""
        mode = session.permission_mode

        if mode == "bypassPermissions":
            return PermissionResultAllow()

        if mode == "plan":
            return PermissionResultDeny(message="Plan mode: no tool execution")

        if mode == "acceptEdits" and tool_name in SAFE_TOOLS:
            return PermissionResultAllow()

        # Deduplicate: SDK may call can_use_tool twice for the same tool_use.
        # Use a simple fingerprint: tool_name + the primary argument value.
        safe_input = tool_input if isinstance(tool_input, dict) else {"raw": str(tool_input)}
        primary = ""
        if isinstance(tool_input, dict):
            primary = str(tool_input.get("command", tool_input.get("file_path",
                tool_input.get("pattern", tool_input.get("url",
                tool_input.get("query", ""))))))
        fingerprint = f"{tool_name}:{primary}"
        if fingerprint in session.resolved_tool_ids:
            log.debug("Dedup: auto-allowing %s (already resolved)", fingerprint[:60])
            return PermissionResultAllow()

        # Need human approval
        request_id = str(uuid4())
        future = asyncio.get_event_loop().create_future()
        session.perm_futures[request_id] = future

        perm_msg = {
            "type": "permission_request",
            "request_id": request_id,
            "tool_name": tool_name,
            "tool_input": safe_input,
        }

        if session.attached_ws:
            # Browser is open — ask via WebSocket
            session.message_log.append(perm_msg)
            session.message_seq += 1
            await db_append_message(
                self._db, session.id, session.message_seq,
                "permission_request", json.dumps(perm_msg),
            )
            await self._broadcast(session, perm_msg)
            session.status = "waiting_permission"
            await self._broadcast(session, {"type": "status", "status": "waiting_permission"})
        else:
            # No browser — send push notification
            session.message_log.append(perm_msg)
            session.message_seq += 1
            await db_append_message(
                self._db, session.id, session.message_seq,
                "permission_request", json.dumps(perm_msg),
            )
            # Send both web push AND ntfy (covers desktop + mobile)
            await self._notifications.send_permission_push(
                session_id=session.id,
                session_name=session.cwd.split("/")[-1],
                tool_name=tool_name,
                tool_input=safe_input,
                request_id=request_id,
            )
            await self._notifications.send_ntfy_permission(
                session_id=session.id,
                session_name=session.cwd.split("/")[-1],
                tool_name=tool_name,
                tool_input=safe_input,
            )

        try:
            result = await asyncio.wait_for(future, timeout=PERMISSION_TIMEOUT)
            # Mark as resolved so SDK re-ask gets auto-allowed
            session.resolved_tool_ids.add(fingerprint)
            return result
        except asyncio.TimeoutError:
            log.warning("Permission timeout in %s for %s — auto-allowing", session.id[:8], tool_name)
            session.resolved_tool_ids.add(fingerprint)
            return PermissionResultAllow()
        finally:
            session.perm_futures.pop(request_id, None)
            if session.status == "waiting_permission":
                session.status = "thinking"

    def resolve_permission(self, session: ManagedSession, request_id: str,
                           decision: str, message: str = "",
                           updated_permissions: list | None = None):
        """Resolve a pending permission from browser or push notification."""
        future = session.perm_futures.get(request_id)
        if not future or future.done():
            return

        if decision == "allow":
            kwargs = {}
            if updated_permissions:
                kwargs["updated_permissions"] = updated_permissions
            future.set_result(PermissionResultAllow(**kwargs))
        elif decision == "allow_always":
            session.permission_mode = "bypassPermissions"
            future.set_result(PermissionResultAllow())
        elif decision == "allow_session":
            session.permission_mode = "acceptEdits"
            future.set_result(PermissionResultAllow())
        else:
            future.set_result(PermissionResultDeny(message=message or "User denied"))

    # --- Interrupt ---

    async def interrupt(self, session: ManagedSession):
        """Interrupt a running query."""
        if session.status in ("thinking", "waiting_permission") and session.client:
            try:
                await session.client.interrupt()
                session.status = "idle"
                await self._broadcast(session, {"type": "status", "status": "interrupted"})
            except Exception as e:
                log.warning("Interrupt error: %s", e)

    # --- Runtime Config ---

    async def update_config(self, session: ManagedSession, **changes):
        """Update session config at runtime. Changes take effect immediately."""
        db_updates = {}

        if "permission_mode" in changes:
            session.permission_mode = changes["permission_mode"]
            db_updates["permission_mode"] = changes["permission_mode"]

        if "model" in changes and session.client:
            try:
                await session.client.set_model(changes["model"])
                session.model = changes["model"]
                db_updates["model"] = changes["model"]
            except Exception as e:
                log.warning("Model change failed: %s", e)

        if "allowed_tools" in changes:
            session.allowed_tools = changes["allowed_tools"]
            db_updates["allowed_tools"] = changes["allowed_tools"]

        if "disallowed_tools" in changes:
            session.disallowed_tools = changes["disallowed_tools"]
            db_updates["disallowed_tools"] = changes["disallowed_tools"]

        if "system_prompt" in changes:
            session.system_prompt = changes["system_prompt"]
            db_updates["system_prompt"] = changes["system_prompt"]

        if "max_turns" in changes:
            session.max_turns = changes["max_turns"]
            db_updates["max_turns"] = changes["max_turns"]

        if "max_budget_usd" in changes:
            session.max_budget_usd = changes["max_budget_usd"]
            db_updates["max_budget_usd"] = changes["max_budget_usd"]

        if "mcp_servers" in changes:
            session.mcp_servers = changes["mcp_servers"]

        if db_updates:
            await db_update_session(self._db, session.id, **db_updates)

        await self._broadcast(session, {
            "type": "config_updated",
            "config": self._get_config_dict(session),
        })

    # --- Browser Attach/Detach (tmux) ---

    def attach(self, session: ManagedSession, ws: WebSocket):
        """Attach a browser to a session."""
        session.attached_ws.add(ws)

    def detach(self, session: ManagedSession, ws: WebSocket):
        """Detach a browser from a session."""
        session.attached_ws.discard(ws)

    async def replay(self, session: ManagedSession, ws: WebSocket, after_seq: int = 0):
        """Replay buffered messages to a browser that just connected."""
        messages = [m for m in session.message_log if m.get("seq", 0) > after_seq]
        if not messages:
            return

        await ws.send_json({"type": "replay_start", "total": len(messages), "from_seq": after_seq})
        for msg in messages:
            try:
                await ws.send_json(msg)
            except Exception:
                break
        await ws.send_json({"type": "replay_end"})

    # --- Broadcasting ---

    async def _broadcast(self, session: ManagedSession, msg: dict):
        """Send to all attached browsers."""
        dead = set()
        for ws in session.attached_ws:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.add(ws)
        for ws in dead:
            session.attached_ws.discard(ws)

    # --- Helpers ---

    def _get_config_dict(self, session: ManagedSession) -> dict:
        return {
            "permission_mode": session.permission_mode,
            "model": session.model,
            "allowed_tools": session.allowed_tools,
            "disallowed_tools": session.disallowed_tools,
            "system_prompt": session.system_prompt,
            "max_turns": session.max_turns,
            "max_budget_usd": session.max_budget_usd,
            "mcp_servers": session.mcp_servers,
        }

    def _get_session_info(self, session: ManagedSession) -> dict:
        return {
            "type": "session_info",
            "session_id": session.id,
            "sdk_session_id": session.sdk_session_id,
            "cwd": session.cwd,
            "status": session.status,
            "total_cost": session.total_cost,
            "total_turns": session.total_turns,
            "message_count": len(session.message_log),
            "config": self._get_config_dict(session),
        }

    # --- Startup ---

    async def restore_active_sessions(self):
        """On server startup, mark stale sessions. Don't auto-reconnect."""
        rows = await db_list_sessions(self._db)
        for row in rows:
            if row["status"] in ("thinking", "waiting_permission"):
                await db_update_session(self._db, row["id"], status="idle")
        log.info("Checked %d sessions on startup", len(rows))
