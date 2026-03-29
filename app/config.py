"""Centralized configuration — all constants, env vars, defaults."""

import os
from pathlib import Path

# Load .env file if it exists
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.is_file():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            if key and value and key not in os.environ:
                os.environ[key] = value

# App metadata
APP_TITLE = "Claude Code Web"
APP_VERSION = "1.0.0"

# Server
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 9282))

# Database
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "claude-code-web.db")

# Project discovery
DEFAULT_PROJECT_ROOT = os.environ.get("PROJECT_DIR", os.path.expanduser("~/Project"))

# Session defaults
DEFAULT_PERMISSION_MODE = "acceptEdits"
DEFAULT_MAX_TURNS = None
DEFAULT_MAX_BUDGET_USD = None

# Permission timeout (seconds) — auto-allow after this if no response
PERMISSION_TIMEOUT = 300  # 5 minutes

# Message buffer — in-memory buffer size per session (older messages are DB-only)
MESSAGE_BUFFER_SIZE = 1000

# File explorer
IGNORE_DIRS = frozenset({
    "node_modules", ".git", "__pycache__", ".venv", "venv", ".next", "dist",
    "build", ".cache", ".tox", ".mypy_cache", ".pytest_cache", "target",
    ".idea", ".vscode", "coverage", ".turbo", ".parcel-cache", "egg-info",
})

IGNORE_EXTENSIONS = frozenset({
    ".pyc", ".pyo", ".so", ".dylib", ".o", ".a", ".class", ".jar",
})

IMAGE_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
})

BINARY_EXTENSIONS = frozenset({
    ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".wav",
})

MARKDOWN_EXTENSIONS = frozenset({
    ".md", ".mdx", ".markdown", ".rst",
})

# Terminal
DEFAULT_SHELL = os.environ.get("SHELL", "/bin/bash")
TERMINAL_ROWS = 30
TERMINAL_COLS = 120

# Push notifications
VAPID_CONTACT = "mailto:internal@localhost"

# Ntfy.sh — free push notifications for mobile
# Set a unique topic name (acts like a channel). Anyone with the topic can receive.
# Leave empty to disable ntfy.
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "claude-code-web-" + os.environ.get("USER", "default"))
NTFY_SERVER = os.environ.get("NTFY_SERVER", "https://ntfy.sh")

# Public URL for the app (used in ntfy notification links)
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://hemanth.tail50655e.ts.net")

# Discord bot
DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
DISCORD_GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "")  # Your server ID

# Serializer limits
MAX_TOOL_RESULT_LEN = 100_000
