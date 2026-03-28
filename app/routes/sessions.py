"""Session REST API — CRUD, headless query, quick-approve."""

import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.database.queries.sessions import (
    get_session, list_sessions, update_session, delete_session,
)
from app.database.queries.messages import get_messages

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    cwd: str
    name: str = ""
    resume: str | None = None        # SDK session ID to resume
    fork_from: str | None = None     # our session ID to fork from
    permission_mode: str = "acceptEdits"
    model: str | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    system_prompt: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None


class HeadlessQueryRequest(BaseModel):
    prompt: str


class PermissionRequest(BaseModel):
    request_id: str
    decision: str  # allow | deny | allow_session | allow_always
    message: str = ""


class UpdateSessionRequest(BaseModel):
    name: str | None = None
    permission_mode: str | None = None
    model: str | None = None
    allowed_tools: list[str] | None = None
    disallowed_tools: list[str] | None = None
    system_prompt: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None


@router.get("")
async def api_list_sessions(request: Request, status: str | None = None,
                            cwd: str | None = None, limit: int = 50):
    return await list_sessions(request.app.state.db, status=status, cwd=cwd, limit=limit)


@router.post("")
async def api_create_session(request: Request, body: CreateSessionRequest):
    path = os.path.abspath(body.cwd)
    if not os.path.isdir(path):
        raise HTTPException(400, f"Directory not found: {path}")
    config = body.model_dump(exclude={"cwd", "name", "resume", "fork_from"}, exclude_none=True)

    manager = request.app.state.manager

    # Fork: create new session with copied config from existing
    if body.fork_from:
        source = await get_session(request.app.state.db, body.fork_from)
        if not source:
            raise HTTPException(404, f"Source session {body.fork_from} not found")
        # Use source's SDK session ID for resume + fork
        config["resume_sdk_session"] = source["sdk_session_id"]
        config["fork"] = True

    # Resume: pass SDK session ID to the session manager
    if body.resume:
        config["resume_sdk_session"] = body.resume

    session = await manager.create(path, name=body.name, **config)
    return manager._get_session_info(session)


@router.get("/{session_id}")
async def api_get_session(request: Request, session_id: str):
    row = await get_session(request.app.state.db, session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    return row


@router.patch("/{session_id}")
async def api_update_session(request: Request, session_id: str, body: UpdateSessionRequest):
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(400, "No changes provided")

    manager = request.app.state.manager
    session = manager.get(session_id)
    if session:
        await manager.update_config(session, **changes)
    else:
        await update_session(request.app.state.db, session_id, **changes)

    return await get_session(request.app.state.db, session_id)


@router.delete("/{session_id}")
async def api_delete_session(request: Request, session_id: str):
    manager = request.app.state.manager
    if manager.get(session_id):
        await manager.destroy(session_id)
    if not await delete_session(request.app.state.db, session_id):
        raise HTTPException(404, "Session not found")
    return {"deleted": True}


@router.get("/{session_id}/messages")
async def api_get_messages(request: Request, session_id: str,
                           after_seq: int = 0, limit: int = 100):
    return await get_messages(request.app.state.db, session_id,
                              after_seq=after_seq, limit=limit)


@router.post("/{session_id}/query")
async def api_headless_query(request: Request, session_id: str, body: HeadlessQueryRequest):
    """Send a query without a browser — runs headlessly."""
    manager = request.app.state.manager
    session = manager.get(session_id)
    if not session:
        try:
            session = await manager.restore(session_id)
        except ValueError:
            raise HTTPException(404, "Session not found")
    await manager.send_query(session, body.prompt)
    return {
        "session_id": session.id,
        "status": "query_sent",
        "message": "Query is running. Attach via WebSocket or poll messages to check status.",
    }


@router.post("/{session_id}/permission")
async def api_quick_approve(request: Request, session_id: str, body: PermissionRequest):
    """Quick-approve a permission from push notification service worker."""
    manager = request.app.state.manager
    session = manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not active")
    manager.resolve_permission(session, body.request_id, body.decision, body.message)
    return {"resolved": True}


@router.get("/{session_id}/cost")
async def api_session_cost(request: Request, session_id: str):
    row = await get_session(request.app.state.db, session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": session_id,
        "total_cost_usd": row["total_cost_usd"],
        "total_turns": row["total_turns"],
        "message_count": row["message_count"],
    }
