"""
Discord bot for Claude Code Web.

Thin API client — calls the web server's REST API as single source of truth.
No SessionManager, no DB, no SDK connections. Just HTTP + WebSocket to the backend.

Run: uv run python -m app.discord.bot
"""

import asyncio
import json
import logging
import os
import re
import textwrap
import urllib.request
import urllib.error

import discord
from discord import app_commands

from app.config import (
    DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DEFAULT_PROJECT_ROOT, PUBLIC_URL,
)

log = logging.getLogger(__name__)
API_BASE = "http://localhost:9282"


# ===== HTTP helpers — calls to the web server API =====

def api_get(path: str) -> dict | list:
    req = urllib.request.Request(f"{API_BASE}{path}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict = None) -> dict:
    data = json.dumps(body or {}).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_patch(path: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}", data=data,
        headers={"Content-Type": "application/json"},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_delete(path: str) -> dict:
    req = urllib.request.Request(f"{API_BASE}{path}", method="DELETE")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# ===== WebSocket client — streams Claude responses =====

async def stream_session(session_id: str, prompt: str, on_message):
    """Connect to WebSocket, send query, stream messages until result."""
    import websockets
    url = f"ws://localhost:9282/ws/claude?session_id={session_id}"
    try:
        async with websockets.connect(url) as ws:
            # Wait for session_info
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            info = json.loads(raw)
            if info.get("type") == "error":
                await on_message({"type": "error", "message": info.get("message", "Connection error")})
                return

            # Skip replay + status
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                msg = json.loads(raw)
                if msg.get("type") == "status" and msg.get("status") == "idle":
                    break
                if msg.get("type") in ("replay_end", "error"):
                    break

            # Send query
            await ws.send(json.dumps({"type": "query", "prompt": prompt}))

            # Stream responses
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=180)
                    msg = json.loads(raw)

                    if msg.get("type") in ("assistant", "result", "permission_request", "error"):
                        await on_message(msg)

                    if msg.get("type") == "result":
                        break

                except asyncio.TimeoutError:
                    await on_message({"type": "error", "message": "Timeout — no response after 3 minutes"})
                    break

            # Send permission response if needed
            # (handled via buttons, not here)

    except Exception as e:
        await on_message({"type": "error", "message": str(e)})


# ===== Formatting helpers =====

def truncate(text: str, max_len: int = 1900) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len] + "\n... [truncated]"


def format_cost(usd: float) -> str:
    if usd == 0: return "$0.00"
    if usd < 0.01: return f"${usd:.4f}"
    return f"${usd:.2f}"


def tool_summary(name: str, inp: dict) -> str:
    if name == "Bash":
        return f"`$ {truncate(str(inp.get('command', '')), 200)}`"
    if name in ("Read", "Write", "Edit"):
        return f"`{inp.get('file_path', '')}`"
    if name == "Glob":
        return f"`{inp.get('pattern', '')}`"
    if name == "Grep":
        return f"`{inp.get('pattern', '')}` in `{inp.get('path', '.')}`"
    if name == "WebSearch":
        return f'"{inp.get("query", inp.get("prompt", ""))}"'
    return f"`{name}`"


def clean_markdown(text: str) -> str:
    """Convert markdown to Discord-compatible format."""
    lines = text.split("\n")
    result = []
    for line in lines:
        if line.startswith("####"):
            result.append(f"**{line.lstrip('#').strip()}**")
        elif line.startswith("###"):
            result.append(f"\n**{line.lstrip('#').strip()}**")
        elif line.startswith("##"):
            result.append(f"\n__**{line.lstrip('#').strip()}**__")
        elif line.startswith("#"):
            result.append(f"\n__**{line.lstrip('#').strip()}**__")
        elif re.match(r"^\|[\s\-:|]+\|$", line):
            continue
        elif "|" in line and line.strip().startswith("|") and line.strip().endswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            result.append("  ".join(c for c in cells if c))
        else:
            result.append(line)
    return "\n".join(result)


STATUS_EMOJI = {"idle": "🟢", "thinking": "🔵", "waiting_permission": "🟡", "error": "🔴", "dead": "⚫"}


# ===== Permission buttons =====

class PermissionView(discord.ui.View):
    def __init__(self, session_id: str, request_id: str):
        super().__init__(timeout=300)
        self.session_id = session_id
        self.request_id = request_id

    async def _resolve(self, interaction, decision, label):
        try:
            api_post(f"/api/sessions/{self.session_id}/permission", {
                "request_id": self.request_id, "decision": decision,
            })
            await interaction.response.edit_message(
                content=interaction.message.content + f"\n\n{label}",
                view=None,
            )
        except Exception as e:
            await interaction.response.send_message(f"❌ {e}", ephemeral=True)

    @discord.ui.button(label="Allow", style=discord.ButtonStyle.success, emoji="✅")
    async def allow(self, interaction, button):
        await self._resolve(interaction, "allow", "✅ **Allowed**")

    @discord.ui.button(label="Allow All", style=discord.ButtonStyle.primary, emoji="🔓")
    async def allow_all(self, interaction, button):
        await self._resolve(interaction, "allow_always", "🔓 **All permissions bypassed**")

    @discord.ui.button(label="Deny", style=discord.ButtonStyle.danger, emoji="❌")
    async def deny(self, interaction, button):
        await self._resolve(interaction, "deny", "❌ **Denied**")

    @discord.ui.button(label="Accept Edits", style=discord.ButtonStyle.secondary, emoji="📝")
    async def accept_edits(self, interaction, button):
        await self._resolve(interaction, "allow_session", "📝 **Accept edits mode**")


# ===== Bot =====

class ClaudeCodeBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self._channel_projects: dict[int, str] = {}  # channel_id → project_path
        self._thread_sessions: dict[int, str] = {}   # thread_id → session_id
        self._category_id: int | None = None
        self._setup_commands()

    # ===== Channel/Project management =====

    async def _get_or_create_category(self, guild):
        if self._category_id:
            cat = guild.get_channel(self._category_id)
            if cat: return cat
        for cat in guild.categories:
            if cat.name.lower() in ("claude code", "claude-code", "claude code web"):
                self._category_id = cat.id
                return cat
        cat = await guild.create_category("Claude Code")
        self._category_id = cat.id
        return cat

    async def _get_or_create_channel(self, guild, name, path):
        for ch_id, p in self._channel_projects.items():
            if p == path:
                ch = guild.get_channel(ch_id)
                if ch: return ch
        category = await self._get_or_create_category(guild)
        ch_name = name.lower().replace(" ", "-").replace("_", "-")
        for ch in category.channels:
            if isinstance(ch, discord.TextChannel) and ch.name == ch_name:
                self._channel_projects[ch.id] = path
                return ch
        ch = await guild.create_text_channel(ch_name, category=category, topic=f"Claude Code · {path}")
        self._channel_projects[ch.id] = path
        return ch

    async def _discover_channels(self):
        for guild in self.guilds:
            for cat in guild.categories:
                if cat.name.lower() in ("claude code", "claude-code", "claude code web"):
                    self._category_id = cat.id
                    for ch in cat.channels:
                        if isinstance(ch, discord.TextChannel) and ch.topic:
                            parts = ch.topic.split("·")
                            if len(parts) >= 2:
                                path = parts[-1].strip()
                                if os.path.isdir(path):
                                    self._channel_projects[ch.id] = path
                                elif os.path.isdir(os.path.join(DEFAULT_PROJECT_ROOT, ch.name)):
                                    self._channel_projects[ch.id] = os.path.join(DEFAULT_PROJECT_ROOT, ch.name)
        print(f"[DISCORD] Discovered {len(self._channel_projects)} channel(s)")

    # ===== Commands =====

    def _setup_commands(self):

        @self.tree.command(name="projects", description="List available projects")
        async def cmd_projects(interaction: discord.Interaction):
            try:
                projects = api_get("/api/projects/discover")
                lines = [f"📁 **{p['name']}** — `{p['path']}`" for p in projects]
                embed = discord.Embed(title="📁 Projects", description="\n".join(lines), color=0x5EEAD4)
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                await interaction.response.send_message(f"❌ {e}", ephemeral=True)

        @self.tree.command(name="init", description="Create channels for all projects")
        async def cmd_init(interaction: discord.Interaction):
            await interaction.response.defer()
            try:
                projects = api_get("/api/projects/discover")
                created = []
                for p in projects:
                    ch = await self._get_or_create_channel(interaction.guild, p["name"], p["path"])
                    created.append(ch.mention)
                embed = discord.Embed(
                    title="⚡ Projects initialized",
                    description="\n".join(f"📁 {c}" for c in created) + "\n\n_Type in any channel to chat with Claude._",
                    color=0xD4845A,
                )
                await interaction.followup.send(embed=embed)
            except Exception as e:
                await interaction.followup.send(f"❌ {e}")

        @self.tree.command(name="status", description="Show all sessions")
        async def cmd_status(interaction: discord.Interaction):
            try:
                sessions = api_get("/api/sessions")
                if not sessions:
                    await interaction.response.send_message("No sessions.", ephemeral=True)
                    return
                lines = []
                for s in sessions[:15]:
                    emoji = STATUS_EMOJI.get(s.get("status", ""), "⚪")
                    project = s.get("cwd", "").split("/")[-1]
                    prompt = truncate(s.get("last_prompt") or "New session", 50)
                    cost = format_cost(s.get("total_cost_usd", 0))
                    lines.append(f"{emoji} **{project}**: {prompt} — {cost}")
                embed = discord.Embed(title="📊 Sessions", description="\n".join(lines), color=0xD4845A)
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                await interaction.response.send_message(f"❌ {e}", ephemeral=True)

        @self.tree.command(name="cost", description="Show total cost")
        async def cmd_cost(interaction: discord.Interaction):
            try:
                sessions = api_get("/api/sessions")
                total = sum(s.get("total_cost_usd", 0) for s in sessions)
                by_project = {}
                for s in sessions:
                    proj = s["cwd"].split("/")[-1]
                    by_project[proj] = by_project.get(proj, 0) + s.get("total_cost_usd", 0)
                lines = [f"**Total: {format_cost(total)}**\n"]
                for proj, cost in sorted(by_project.items(), key=lambda x: -x[1]):
                    lines.append(f"📁 {proj}: {format_cost(cost)}")
                embed = discord.Embed(title="💰 Cost", description="\n".join(lines), color=0x10B981)
                await interaction.response.send_message(embed=embed)
            except Exception as e:
                await interaction.response.send_message(f"❌ {e}", ephemeral=True)

        @self.tree.command(name="permissions", description="Change permission mode")
        @app_commands.choices(mode=[
            app_commands.Choice(name="Accept Edits", value="acceptEdits"),
            app_commands.Choice(name="Ask Everything", value="default"),
            app_commands.Choice(name="Bypass All", value="bypassPermissions"),
            app_commands.Choice(name="Plan Only", value="plan"),
        ])
        async def cmd_permissions(interaction: discord.Interaction, mode: str):
            try:
                sessions = api_get("/api/sessions")
                count = 0
                for s in sessions:
                    try:
                        api_patch(f"/api/sessions/{s['id']}", {"permission_mode": mode})
                        count += 1
                    except Exception:
                        pass
                labels = {"acceptEdits": "Accept Edits", "default": "Ask Everything",
                          "bypassPermissions": "⚠️ Bypass All", "plan": "Plan Only"}
                await interaction.response.send_message(f"🛡️ Set to **{labels.get(mode, mode)}** for {count} session(s).")
            except Exception as e:
                await interaction.response.send_message(f"❌ {e}", ephemeral=True)

    # ===== Message handling =====

    async def on_message(self, message: discord.Message):
        if message.author == self.user: return
        if message.content.startswith("/"): return
        if not message.content.strip(): return

        channel = message.channel
        print(f"[DISCORD] Message in {channel} ({type(channel).__name__}): {message.content[:60]}")

        try:
            await self._handle_message(message, channel)
        except Exception as e:
            print(f"[DISCORD] Error: {e}")
            import traceback; traceback.print_exc()
            try:
                await channel.send(f"❌ Error: {e}")
            except Exception:
                pass

    async def _handle_message(self, message, channel):
        # Thread → continue session
        if isinstance(channel, discord.Thread):
            session_id = self._thread_sessions.get(channel.id)
            parent_id = channel.parent_id
            project_path = self._channel_projects.get(parent_id) if parent_id else None
            if not project_path: return

            if not session_id:
                # Orphan thread — create new session via API
                result = api_post("/api/sessions", {"cwd": project_path})
                session_id = result.get("session_id")
                self._thread_sessions[channel.id] = session_id
                print(f"[DISCORD] New session {session_id[:8]} for orphan thread")

            await self._query_and_post(channel, session_id, message.content)
            return

        # Project channel → create thread + session
        if isinstance(channel, discord.TextChannel):
            project_path = self._channel_projects.get(channel.id)
            if not project_path: return

            # Create session via API
            result = api_post("/api/sessions", {"cwd": project_path})
            session_id = result.get("session_id")

            # Create thread
            thread = await channel.create_thread(
                name=truncate(message.content, 95),
                type=discord.ChannelType.public_thread,
            )
            self._thread_sessions[thread.id] = session_id
            print(f"[DISCORD] Thread '{message.content[:30]}' → session {session_id[:8]}")

            await self._query_and_post(thread, session_id, message.content)

    async def _query_and_post(self, channel, session_id: str, prompt: str):
        """Send query via WebSocket and post formatted response."""
        tool_lines = []
        text_parts = []
        result_info = None
        permission_posted = False

        async def on_message(msg):
            nonlocal result_info, permission_posted

            if msg.get("type") == "assistant":
                for block in msg.get("content", []):
                    btype = block.get("type", "")
                    if btype == "tool_use":
                        name = block.get("name", "")
                        if name in ("ToolSearch", "ListMcpResourcesTool", "ReadMcpResourceTool"):
                            continue
                        emoji = "📖" if name in ("Read", "Glob", "Grep") else \
                                "✏️" if name in ("Edit", "Write") else \
                                "▶️" if name == "Bash" else "🔧"
                        tool_lines.append(f"{emoji} **{name}** {tool_summary(name, block.get('input', {}))}")
                    elif btype == "text":
                        text = block.get("text", "").strip()
                        if text: text_parts.append(text)

            elif msg.get("type") == "permission_request" and not permission_posted:
                permission_posted = True
                tool_name = msg.get("tool_name", "Unknown")
                tool_input = msg.get("tool_input", {})
                request_id = msg.get("request_id", "")
                embed = discord.Embed(
                    title=f"🔔 Claude wants to use {tool_name}",
                    description=tool_summary(tool_name, tool_input),
                    color=0xF59E0B,
                )
                view = PermissionView(session_id, request_id)
                await channel.send(embed=embed, view=view)

            elif msg.get("type") == "result":
                result_info = msg

            elif msg.get("type") == "error":
                await channel.send(f"❌ {msg.get('message', 'Unknown error')}")

        # Stream the response
        async with channel.typing():
            await stream_session(session_id, prompt, on_message)

        # Post tool summary
        if tool_lines:
            embed = discord.Embed(
                description="\n".join(tool_lines[:15]),
                color=0x353431,
            )
            embed.set_author(name="🔧 Tools used")
            await channel.send(embed=embed)

        # Post text response
        if text_parts:
            project = "project"
            try:
                session = api_get(f"/api/sessions/{session_id}")
                project = session.get("cwd", "").split("/")[-1]
            except Exception:
                pass

            full_text = clean_markdown("\n\n".join(text_parts))
            chunks = [full_text[i:i+1900] for i in range(0, len(full_text), 1900)]
            total = min(len(chunks), 8)

            for i, chunk in enumerate(chunks[:8]):
                embed = discord.Embed(description=chunk, color=0xD4845A)
                if i == 0:
                    embed.set_author(name=f"Claude · {project}")
                if i == total - 1 and result_info:
                    cost = format_cost(result_info.get("total_cost_usd", 0))
                    turns = result_info.get("num_turns", 0)
                    dur = result_info.get("duration_ms", 0)
                    err = result_info.get("is_error", False)
                    footer = f"{'❌' if err else '✅'} {cost} · {turns} turns"
                    if dur: footer += f" · {dur/1000:.1f}s"
                    embed.set_footer(text=footer)
                await channel.send(embed=embed)

        elif result_info:
            cost = format_cost(result_info.get("total_cost_usd", 0))
            turns = result_info.get("num_turns", 0)
            err = result_info.get("is_error", False)
            embed = discord.Embed(
                description=f"{'❌ Error' if err else '✅ Done'} — {cost} · {turns} turns",
                color=0xEF4444 if err else 0x10B981,
            )
            await channel.send(embed=embed)

    # ===== Lifecycle =====

    async def setup_hook(self):
        if DISCORD_GUILD_ID:
            guild = discord.Object(id=int(DISCORD_GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            print(f"[DISCORD] Synced commands to guild {DISCORD_GUILD_ID}")
        else:
            await self.tree.sync()
        print("[DISCORD] Bot ready!")

    async def on_ready(self):
        print(f"[DISCORD] Logged in as {self.user}")
        await self._discover_channels()


def run_bot():
    if not DISCORD_BOT_TOKEN:
        print("[DISCORD] No DISCORD_BOT_TOKEN set.")
        return
    bot = ClaudeCodeBot()
    bot.run(DISCORD_BOT_TOKEN, log_handler=None)


if __name__ == "__main__":
    run_bot()
