"""Terminal WebSocket — PTY-based shell access via ptyprocess + tmux."""

import asyncio
import logging
import os
import shutil
import subprocess

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ptyprocess import PtyProcess

from app.config import DEFAULT_PROJECT_ROOT, TERMINAL_ROWS, TERMINAL_COLS

router = APIRouter(tags=["terminal"])
log = logging.getLogger(__name__)


@router.get("/api/terminals")
async def api_list_terminals():
    """List all active tmux sessions created by this app."""
    tmux_bin = shutil.which("tmux")
    if not tmux_bin:
        return []
    try:
        result = subprocess.run(
            [tmux_bin, "list-sessions", "-F",
             "#{session_name}\t#{session_created}\t#{session_windows}\t#{pane_current_path}"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return []
        sessions = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            name = parts[0]
            created = int(parts[1]) if len(parts) > 1 else 0
            windows = int(parts[2]) if len(parts) > 2 else 1
            cwd = parts[3] if len(parts) > 3 else ""
            sessions.append({
                "name": name,
                "created_at": created,
                "windows": windows,
                "cwd": cwd,
                "project": cwd.rstrip("/").split("/")[-1] if cwd else "",
            })
        return sessions
    except Exception:
        return []


@router.post("/api/terminals/{name}/rename")
async def api_rename_terminal(name: str, new_name: str):
    """Rename a tmux session."""
    tmux_bin = shutil.which("tmux")
    if not tmux_bin:
        return {"error": "tmux not found"}
    try:
        subprocess.run(
            [tmux_bin, "rename-session", "-t", name, new_name],
            capture_output=True, timeout=5,
        )
        return {"renamed": True, "old": name, "new": new_name}
    except Exception as e:
        return {"error": str(e)}


@router.delete("/api/terminals/{name}")
async def api_kill_terminal(name: str):
    """Kill a tmux session."""
    tmux_bin = shutil.which("tmux")
    if not tmux_bin:
        return {"error": "tmux not found"}
    try:
        subprocess.run(
            [tmux_bin, "kill-session", "-t", name],
            capture_output=True, timeout=5,
        )
        return {"killed": True}
    except Exception as e:
        return {"error": str(e)}


@router.websocket("/ws/terminal")
async def ws_terminal(websocket: WebSocket):
    await websocket.accept()

    cwd = websocket.query_params.get("cwd", DEFAULT_PROJECT_ROOT)
    if not os.path.isdir(cwd):
        cwd = os.path.expanduser("~")

    tmux_bin = shutil.which("tmux")
    session_name = websocket.query_params.get("name", "")
    if not session_name:
        await websocket.send_text("Terminal name is required.")
        await websocket.close()
        return

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
