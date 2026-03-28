"""Slash commands + skills discovery routes."""

import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/api/commands", tags=["commands"])

# Native built-in commands that Claude Code supports
# These match the actual commands available in Claude Code's interactive terminal
NATIVE_COMMANDS = [
    # Session management
    {"name": "/resume", "description": "Resume a previous conversation by session ID or search", "scope": "builtin", "category": "session"},
    {"name": "/continue", "description": "Continue the most recent conversation in this directory", "scope": "builtin", "category": "session"},
    {"name": "/compact", "description": "Compact conversation context to free up space", "scope": "builtin", "category": "session"},
    {"name": "/clear", "description": "Clear conversation history and start fresh", "scope": "builtin", "category": "session"},
    {"name": "/status", "description": "Show session status, cost, and model info", "scope": "builtin", "category": "session"},

    # Model & config
    {"name": "/model", "description": "Switch the model (opus, sonnet, haiku)", "scope": "builtin", "category": "config"},
    {"name": "/permissions", "description": "Change permission mode (default, acceptEdits, bypass, plan)", "scope": "builtin", "category": "config"},
    {"name": "/fast", "description": "Toggle fast mode for faster output", "scope": "builtin", "category": "config"},

    # Memory & project
    {"name": "/init", "description": "Initialize Claude Code for this project (create CLAUDE.md)", "scope": "builtin", "category": "project"},
    {"name": "/memory", "description": "View and manage memory files", "scope": "builtin", "category": "project"},
    {"name": "/context", "description": "Show current context usage and breakdown", "scope": "builtin", "category": "project"},

    # Tools & integrations
    {"name": "/mcp", "description": "Show MCP server status and connected tools", "scope": "builtin", "category": "tools"},
    {"name": "/tools", "description": "Show available tools and their status", "scope": "builtin", "category": "tools"},
    {"name": "/skills", "description": "Show available skills", "scope": "builtin", "category": "tools"},

    # Code operations (sent as prompts with context)
    {"name": "/commit", "description": "Create a git commit with a generated message", "scope": "builtin", "category": "code"},
    {"name": "/pr", "description": "Create a pull request with generated title and description", "scope": "builtin", "category": "code"},
    {"name": "/review", "description": "Review code changes and suggest improvements", "scope": "builtin", "category": "code"},
    {"name": "/fix", "description": "Find and fix bugs in the codebase", "scope": "builtin", "category": "code"},
    {"name": "/test", "description": "Write or run tests for the codebase", "scope": "builtin", "category": "code"},
    {"name": "/explain", "description": "Explain how code works", "scope": "builtin", "category": "code"},
    {"name": "/refactor", "description": "Refactor code for better quality", "scope": "builtin", "category": "code"},
    {"name": "/docs", "description": "Generate or update documentation", "scope": "builtin", "category": "code"},

    # Help
    {"name": "/help", "description": "Show available commands and help", "scope": "builtin", "category": "help"},
    {"name": "/bug", "description": "Report a bug or issue", "scope": "builtin", "category": "help"},
]


def _discover_commands(project_dir: str | None = None) -> list[dict]:
    """Discover slash commands from .claude/commands/ directories."""
    commands = []
    search_dirs = []

    # Global commands
    global_dir = os.path.expanduser("~/.claude/commands")
    if os.path.isdir(global_dir):
        search_dirs.append(("global", global_dir))

    # Project commands
    if project_dir:
        project_cmd_dir = os.path.join(project_dir, ".claude", "commands")
        if os.path.isdir(project_cmd_dir):
            search_dirs.append(("project", project_cmd_dir))

    for scope, cmd_dir in search_dirs:
        for file in sorted(Path(cmd_dir).rglob("*.md")):
            rel = file.relative_to(cmd_dir)
            name = "/" + str(rel).removesuffix(".md").replace(os.sep, ":")
            try:
                content = file.read_text(errors="replace")
                # First line as description, rest as body
                lines = content.strip().split("\n", 1)
                description = lines[0].lstrip("# ").strip() if lines else name
                body = lines[1].strip() if len(lines) > 1 else ""
            except Exception:
                description = name
                body = ""

            commands.append({
                "name": name,
                "description": description,
                "body": body,
                "scope": scope,
                "path": str(file),
            })

    return commands


def _discover_skills(project_dir: str | None = None) -> list[dict]:
    """Discover skills from .claude/skills/ directories."""
    skills = []
    search_dirs = []

    if project_dir:
        skills_dir = os.path.join(project_dir, ".claude", "skills")
        if os.path.isdir(skills_dir):
            search_dirs.append(skills_dir)

    global_skills = os.path.expanduser("~/.claude/skills")
    if os.path.isdir(global_skills):
        search_dirs.append(global_skills)

    for skills_dir in search_dirs:
        for skill_dir in sorted(Path(skills_dir).iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_file = skill_dir / "SKILL.md"
            if not skill_file.is_file():
                continue
            try:
                content = skill_file.read_text(errors="replace")
                lines = content.strip().split("\n", 1)
                name = skill_dir.name
                description = lines[0].lstrip("# ").strip() if lines else name
            except Exception:
                name = skill_dir.name
                description = name

            skills.append({
                "name": name,
                "description": description,
                "path": str(skill_file),
            })

    return skills


@router.get("")
async def api_list_commands(cwd: str = ""):
    """List all available slash commands — native + user-defined."""
    user_commands = _discover_commands(cwd or None)
    return NATIVE_COMMANDS + user_commands


@router.get("/skills")
async def api_list_skills(cwd: str = ""):
    """List all available skills for a project."""
    return _discover_skills(cwd or None)


@router.get("/claude-md")
async def api_get_claude_md(cwd: str = ""):
    """Get CLAUDE.md content for a project (if it exists)."""
    locations = []
    if cwd:
        locations.append(os.path.join(cwd, "CLAUDE.md"))
        locations.append(os.path.join(cwd, ".claude", "CLAUDE.md"))
    locations.append(os.path.expanduser("~/.claude/CLAUDE.md"))

    for path in locations:
        if os.path.isfile(path):
            try:
                content = open(path, "r", errors="replace").read()
                return {"path": path, "content": content}
            except Exception:
                continue

    return {"path": None, "content": None}
