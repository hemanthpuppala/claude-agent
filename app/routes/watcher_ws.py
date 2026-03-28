"""File watcher WebSocket — realtime filesystem events via watchfiles."""

import asyncio
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from watchfiles import awatch, Change

from app.config import IGNORE_DIRS

router = APIRouter(tags=["watcher"])
log = logging.getLogger(__name__)


def _should_ignore(path: str) -> bool:
    """Check if a path is inside an ignored directory."""
    parts = path.replace("\\", "/").split("/")
    return any(p in IGNORE_DIRS or (p.startswith(".") and p != ".env.example") for p in parts)


@router.websocket("/ws/watch")
async def ws_watch(websocket: WebSocket):
    await websocket.accept()

    path = websocket.query_params.get("path", "")
    if not path or not os.path.isdir(path):
        await websocket.send_json({"type": "error", "message": f"Invalid directory: {path}"})
        await websocket.close()
        return

    await websocket.send_json({"type": "subscribed", "path": path})

    stop = asyncio.Event()

    async def watch_loop():
        try:
            async for changes in awatch(path, stop_event=stop):
                added, removed, modified = [], [], []
                for change_type, changed_path in changes:
                    rel = os.path.relpath(changed_path, path)
                    if _should_ignore(rel):
                        continue
                    if change_type == Change.added:
                        added.append(rel)
                    elif change_type == Change.deleted:
                        removed.append(rel)
                    elif change_type == Change.modified:
                        modified.append(rel)

                if added or removed or modified:
                    await websocket.send_json({
                        "type": "fs_change",
                        "added": sorted(added)[:50],
                        "removed": sorted(removed)[:50],
                        "modified": sorted(modified)[:50],
                    })
        except asyncio.CancelledError:
            pass

    watcher_task = asyncio.create_task(watch_loop())

    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        pass
    finally:
        stop.set()
        watcher_task.cancel()
