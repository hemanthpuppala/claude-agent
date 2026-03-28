"""Terminal WebSocket — PTY-based shell access via ptyprocess."""

import asyncio
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ptyprocess import PtyProcess

from app.config import DEFAULT_PROJECT_ROOT, DEFAULT_SHELL, TERMINAL_ROWS, TERMINAL_COLS

router = APIRouter(tags=["terminal"])
log = logging.getLogger(__name__)


@router.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket):
    await websocket.accept()

    cwd = websocket.query_params.get("cwd", DEFAULT_PROJECT_ROOT)
    if not os.path.isdir(cwd):
        cwd = os.path.expanduser("~")

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"

    proc = PtyProcess.spawn(
        [DEFAULT_SHELL, "--login"],
        cwd=cwd,
        env=env,
        dimensions=(TERMINAL_ROWS, TERMINAL_COLS),
    )

    stop = asyncio.Event()
    loop = asyncio.get_event_loop()

    async def read_output():
        """Read from PTY and send to browser."""
        try:
            while not stop.is_set():
                try:
                    data = await loop.run_in_executor(None, lambda: proc.read(16384))
                    if not data:
                        break
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
                except EOFError:
                    break
                except Exception:
                    await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass

    reader_task = asyncio.create_task(read_output())

    try:
        while True:
            msg = await websocket.receive_text()

            # Handle resize
            if msg.startswith("\x1b[resize:"):
                parts = msg[len("\x1b[resize:"):].split(",")
                if len(parts) == 2:
                    try:
                        cols, rows = int(parts[0]), int(parts[1])
                        proc.setwinsize(rows, cols)
                    except (ValueError, OSError):
                        pass
            else:
                try:
                    proc.write(msg.encode("utf-8"))
                except OSError:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.error("Terminal WS error: %s", e)
    finally:
        stop.set()
        reader_task.cancel()
        if proc.isalive():
            proc.terminate(force=True)
