"""Terminal WebSocket — PTY-based shell access via ptyprocess + tmux."""

import asyncio
import hashlib
import logging
import os
import shutil

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ptyprocess import PtyProcess

from app.config import DEFAULT_PROJECT_ROOT, TERMINAL_ROWS, TERMINAL_COLS

router = APIRouter(tags=["terminal"])
log = logging.getLogger(__name__)


def _tmux_session_name(cwd: str) -> str:
    """Generate a stable tmux session name from cwd."""
    short = cwd.rstrip("/").split("/")[-1] or "home"
    # Add hash suffix to avoid collisions between dirs with same name
    h = hashlib.md5(cwd.encode()).hexdigest()[:6]
    return f"web-{short}-{h}"


@router.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket):
    await websocket.accept()

    cwd = websocket.query_params.get("cwd", DEFAULT_PROJECT_ROOT)
    if not os.path.isdir(cwd):
        cwd = os.path.expanduser("~")

    tmux_bin = shutil.which("tmux")
    session_name = _tmux_session_name(cwd)

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"

    if tmux_bin:
        # tmux new-session -A -s <name> : attach if exists, create if not
        # This means terminal sessions persist across browser disconnects
        proc = PtyProcess.spawn(
            [tmux_bin, "new-session", "-A", "-s", session_name],
            cwd=cwd,
            env=env,
            dimensions=(TERMINAL_ROWS, TERMINAL_COLS),
        )
        log.info("Terminal: tmux session '%s' for %s", session_name, cwd)
    else:
        # Fallback: plain shell if tmux not installed
        shell = os.environ.get("SHELL", "/bin/bash")
        proc = PtyProcess.spawn(
            [shell, "--login"],
            cwd=cwd,
            env=env,
            dimensions=(TERMINAL_ROWS, TERMINAL_COLS),
        )
        log.info("Terminal: plain shell for %s (tmux not found)", cwd)

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
        # Don't kill the tmux session — it persists for reconnect.
        # Only kill if it's a plain shell (no tmux).
        if not tmux_bin and proc.isalive():
            proc.terminate(force=True)
