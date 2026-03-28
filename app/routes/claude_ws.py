"""Claude WebSocket — main interaction channel for persistent sessions."""

import json
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import DEFAULT_PROJECT_ROOT

router = APIRouter(tags=["claude"])
log = logging.getLogger(__name__)


@router.websocket("/ws/claude")
async def ws_claude(websocket: WebSocket):
    await websocket.accept()

    manager = websocket.app.state.manager
    session_id = websocket.query_params.get("session_id")
    cwd = websocket.query_params.get("cwd", DEFAULT_PROJECT_ROOT)

    # Find or create session
    session = None
    if session_id:
        session = manager.get(session_id)
        if not session:
            try:
                session = await manager.restore(session_id)
            except ValueError:
                pass

    if not session:
        if not os.path.isdir(cwd):
            cwd = os.path.expanduser("~")
        session = await manager.create(cwd)

    # Attach browser
    manager.attach(session, websocket)

    try:
        # Send current state
        await websocket.send_json(manager._get_session_info(session))

        # Replay buffered messages
        await manager.replay(session, websocket)

        # Send current status
        await websocket.send_json({"type": "status", "status": session.status})

        # Main loop: read from browser
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "query":
                prompt = data.get("prompt", "").strip()
                if prompt:
                    await manager.send_query(session, prompt)

            elif msg_type == "permission_response":
                manager.resolve_permission(
                    session,
                    data.get("request_id", ""),
                    data.get("decision", "deny"),
                    data.get("message", ""),
                    data.get("updated_permissions"),
                )

            elif msg_type == "interrupt":
                await manager.interrupt(session)

            elif msg_type == "config":
                changes = {k: v for k, v in data.items() if k != "type" and v is not None}
                if changes:
                    await manager.update_config(session, **changes)

            elif msg_type == "attach":
                new_id = data.get("session_id", "")
                if new_id and new_id != session.id:
                    manager.detach(session, websocket)
                    new_session = manager.get(new_id)
                    if not new_session:
                        try:
                            new_session = await manager.restore(new_id)
                        except ValueError:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Session {new_id} not found",
                            })
                            continue
                    session = new_session
                    manager.attach(session, websocket)
                    await websocket.send_json(manager._get_session_info(session))
                    await manager.replay(session, websocket)
                    await websocket.send_json({"type": "status", "status": session.status})

            elif msg_type == "replay":
                after_seq = data.get("after_seq", 0)
                await manager.replay(session, websocket, after_seq=after_seq)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("Claude WS error: %s", e)
    finally:
        manager.detach(session, websocket)
